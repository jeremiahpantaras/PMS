import json
import logging

from django.conf import settings
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PayMongoPaymentLog, Subscription
from .paymongo_service import (
    PayMongoError,
    create_checkout_session,
    extract_checkout_metadata,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)


class SubscriptionBaseView(APIView):
    permission_classes = [IsAuthenticated]

    @staticmethod
    def ensure_subscription(user):
        subscription, created = Subscription.objects.get_or_create(user=user)
        if created:
            subscription.start_trial()
        return subscription


class SubscriptionStatusView(SubscriptionBaseView):
    def get(self, request):
        sub = self.ensure_subscription(request.user)

        now = timezone.now()
        if sub.status == Subscription.STATUS_ACTIVE and sub.end_date < now:
            sub.expire()

        return Response(
            {
                'plan': sub.plan,
                'status': sub.status,
                'is_trial': sub.is_trial,
                'start_date': sub.start_date,
                'end_date': sub.end_date,
                'days_remaining': max((sub.end_date - now).days, 0),
            }
        )


class CreateCheckoutView(SubscriptionBaseView):
    """
    POST /api/subscription/checkout/create/

    Creates a PayMongo Checkout Session and returns the checkout URL.
    The frontend redirects the user to that URL to complete payment.
    Secret keys never leave the backend.
    """

    def post(self, request):
        sub = self.ensure_subscription(request.user)

        # Idempotency: if already on an active monthly plan, reject new checkout
        if sub.is_active() and sub.plan == Subscription.PLAN_MONTHLY:
            return Response(
                {'error': 'Your subscription is already active.'},
                status=400,
            )

        try:
            result = create_checkout_session(
                user=request.user,
                frontend_url=settings.FRONTEND_URL,
            )
        except PayMongoError as exc:
            logger.error('Failed to create PayMongo checkout for user %s: %s', request.user.pk, exc)
            return Response(
                {'error': 'Payment service unavailable. Please try again later.'},
                status=503,
            )

        # Persist checkout ID so we can correlate the webhook
        sub.paymongo_checkout_id = result['checkout_id']
        sub.save(update_fields=['paymongo_checkout_id', 'updated_at'])

        return Response(
            {
                'checkout_url': result['checkout_url'],
                'checkout_id': result['checkout_id'],
            }
        )


# ── Webhook (no auth, no CSRF — server-to-server from PayMongo) ───────────────

@csrf_exempt
@require_POST
def paymongo_webhook(request):
    """
    POST /api/subscription/webhook/paymongo/

    Receives PayMongo webhook events, verifies the signature, and activates
    the user's subscription on payment.paid / checkout_session.payment.paid.

    Security:
    - HMAC-SHA256 signature verification (constant-time comparison)
    - User ID sourced exclusively from webhook metadata (never from frontend)
    - Idempotent: duplicate events for the same checkout are ignored
    """
    raw_body: bytes = request.body
    signature_header: str | None = request.headers.get('Paymongo-Signature')

    # ── 1. Verify signature ───────────────────────────────────────────────────
    if not verify_webhook_signature(raw_body, signature_header):
        logger.warning('PayMongo webhook rejected — invalid signature.')
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    # ── 2. Parse payload ──────────────────────────────────────────────────────
    try:
        payload: dict = json.loads(raw_body)
    except json.JSONDecodeError:
        logger.error('PayMongo webhook — malformed JSON body.')
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    extracted = extract_checkout_metadata(payload)
    if not extracted:
        # Unparseable payload — acknowledge to prevent infinite retries
        logger.error('PayMongo webhook — could not extract metadata from payload.')
        return JsonResponse({'status': 'ignored', 'reason': 'unparseable'}, status=200)

    event_type: str = extracted.get('event_type', '')
    checkout_id: str = extracted.get('checkout_id', '')
    metadata: dict = extracted.get('metadata', {})

    # ── 3. Only handle paid events ────────────────────────────────────────────
    PAID_EVENTS = {'payment.paid', 'checkout_session.payment.paid'}
    if event_type not in PAID_EVENTS:
        logger.debug('PayMongo webhook — ignoring event type: %s', event_type)
        return JsonResponse({'status': 'ignored', 'event': event_type}, status=200)

    # ── 4. Resolve user from metadata (never trust frontend) ──────────────────
    user_id = metadata.get('user_id')
    if not user_id:
        logger.error('PayMongo webhook %s — no user_id in metadata.', event_type)
        return JsonResponse({'status': 'ignored', 'reason': 'no user_id'}, status=200)

    from django.contrib.auth import get_user_model
    User = get_user_model()

    try:
        user = User.objects.select_related('subscription').get(pk=user_id)
    except User.DoesNotExist:
        logger.error('PayMongo webhook — user_id %s not found.', user_id)
        return JsonResponse({'status': 'ignored', 'reason': 'user not found'}, status=200)

    # ── 5. Activate / renew subscription ─────────────────────────────────────
    subscription, _ = Subscription.objects.get_or_create(user=user)
    subscription.activate_from_webhook(checkout_id=checkout_id)
    logger.info(
        'Subscription activated via webhook — user=%s checkout=%s event=%s',
        user.pk, checkout_id, event_type,
    )

    # ── 6. Persist audit log ──────────────────────────────────────────────────
    PayMongoPaymentLog.objects.create(
        user=user,
        event_type=event_type,
        checkout_id=checkout_id,
        payment_id=extracted.get('payment_id', ''),
        amount=extracted.get('amount', 0),
        currency=extracted.get('currency', 'PHP'),
        raw_payload=payload,
    )

    return JsonResponse({'status': 'ok'}, status=200)

