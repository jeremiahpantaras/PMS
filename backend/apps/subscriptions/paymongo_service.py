"""
PayMongo API service — backend-only, no secret keys exposed to frontend.

Uses stdlib urllib to avoid adding external dependencies.
All PayMongo API calls go through _paymongo_request().
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any

logger = logging.getLogger(__name__)

PAYMONGO_BASE_URL = 'https://api.paymongo.com'


def _auth_header() -> str:
    """Basic-auth header value using the secret key."""
    secret_key = os.getenv('PAYMONGO_SECRET_KEY', '')
    if not secret_key:
        raise ValueError('PAYMONGO_SECRET_KEY is not configured.')
    encoded = base64.b64encode(f'{secret_key}:'.encode()).decode()
    return f'Basic {encoded}'


def _paymongo_request(method: str, endpoint: str, payload: dict | None = None) -> dict:
    """
    Perform an authenticated request to the PayMongo API.
    Raises PayMongoError on HTTP/network failures.
    """
    url = f'{PAYMONGO_BASE_URL}{endpoint}'
    data = json.dumps(payload).encode() if payload else None

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Authorization': _auth_header(),
            'Content-Type': 'application/json',
        },
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors='replace')
        logger.error('PayMongo HTTP %s for %s %s — %s', exc.code, method, endpoint, body)
        raise PayMongoError(f'PayMongo HTTP {exc.code}: {body}') from exc
    except urllib.error.URLError as exc:
        logger.error('PayMongo network error for %s %s — %s', method, endpoint, exc.reason)
        raise PayMongoError(f'PayMongo network error: {exc.reason}') from exc


class PayMongoError(Exception):
    """Raised on any PayMongo API or configuration error."""


def create_checkout_session(user, frontend_url: str | None = None) -> dict[str, Any]:
    """
    Create a PayMongo Checkout Session for the monthly subscription plan.

    Returns:
        {
            'checkout_id': 'cs_xxxx',
            'checkout_url': 'https://checkout.paymongo.com/...',
        }
    """
    base = (frontend_url or os.getenv('FRONTEND_URL', 'http://localhost:3000')).rstrip('/')
    amount = int(os.getenv('SUBSCRIPTION_PRICE', 39900))  # centavos (₱399.00)
    amount_pesos = amount / 100

    payload = {
        'data': {
            'attributes': {
                'line_items': [
                    {
                        'currency': 'PHP',
                        'amount': amount,
                        'description': 'Full access to Malasakit PMS for 30 days',
                        'name': 'Malasakit Monthly Subscription',
                        'quantity': 1,
                    }
                ],
                'payment_method_types': ['card', 'gcash', 'paymaya'],
                'success_url': f'{base}/setup/account/subscription?payment=success',
                'cancel_url': f'{base}/setup/account/subscription?payment=cancelled',
                'description': f'Malasakit PMS Monthly Plan — ₱{amount_pesos:.0f}/month',
                'send_email_receipt': True,
                'show_description': True,
                'show_line_items': True,
                'metadata': {
                    # Stored in webhook payload so backend can identify the user
                    # without trusting any frontend-submitted value.
                    'user_id': str(user.pk),
                },
            }
        }
    }

    response = _paymongo_request('POST', '/v1/checkout_sessions', payload)
    data = response.get('data', {})
    attrs = data.get('attributes', {})

    checkout_id = data.get('id', '')
    checkout_url = attrs.get('checkout_url', '')

    if not checkout_url:
        raise PayMongoError('PayMongo did not return a checkout_url.')

    logger.info('Created checkout session %s for user %s', checkout_id, user.pk)
    return {'checkout_id': checkout_id, 'checkout_url': checkout_url}


def verify_webhook_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """
    Verify a PayMongo webhook signature.

    PayMongo sends: Paymongo-Signature: t=<timestamp>,te=<test_hmac>,li=<live_hmac>

    Signed message: "<timestamp>.<raw_body>"
    HMAC: SHA-256 keyed with PAYMONGO_WEBHOOK_SECRET
    """
    if not signature_header:
        logger.warning('PayMongo webhook received without signature header.')
        return False

    webhook_secret = os.getenv('PAYMONGO_WEBHOOK_SECRET', '')
    if not webhook_secret:
        logger.error('PAYMONGO_WEBHOOK_SECRET is not configured.')
        return False

    # Parse t=...,te=...,li=...
    parts: dict[str, str] = {}
    for part in signature_header.split(','):
        if '=' in part:
            key, _, value = part.partition('=')
            parts[key.strip()] = value.strip()

    timestamp = parts.get('t', '')
    test_sig = parts.get('te', '')
    live_sig = parts.get('li', '')

    if not timestamp:
        logger.warning('PayMongo webhook signature missing timestamp.')
        return False

    signed_payload = f'{timestamp}.'.encode() + raw_body
    expected = hmac.new(
        webhook_secret.encode(),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()

    # Accept test or live signature depending on environment
    candidate = live_sig if live_sig else test_sig
    if not candidate:
        logger.warning('PayMongo webhook signature header has no te/li value.')
        return False

    return hmac.compare_digest(expected, candidate)


def extract_checkout_metadata(payload: dict) -> dict[str, Any]:
    """
    Extract metadata from a PayMongo webhook payload.

    Supports both:
      - checkout_session.payment.paid
      - payment.paid  (legacy / payment-intent flow)
    """
    try:
        attrs = payload['data']['attributes']
        event_type: str = attrs.get('type', '')
        inner_attrs = attrs.get('data', {}).get('attributes', {})

        metadata: dict = inner_attrs.get('metadata') or {}
        checkout_id: str = attrs.get('data', {}).get('id', '')

        # For payment.paid the checkout_session_id may live inside payments[]
        if not checkout_id and event_type == 'payment.paid':
            checkout_id = inner_attrs.get('source', {}).get('id', '')

        # Amount from first payment if available
        payments = inner_attrs.get('payments', [])
        amount: int = 0
        payment_id: str = ''
        currency: str = 'PHP'
        if payments:
            first_payment_attrs = payments[0].get('attributes', {})
            amount = first_payment_attrs.get('amount', 0)
            currency = first_payment_attrs.get('currency', 'PHP')
            payment_id = payments[0].get('id', '')

        return {
            'event_type': event_type,
            'checkout_id': checkout_id,
            'payment_id': payment_id,
            'amount': amount,
            'currency': currency,
            'metadata': metadata,
        }
    except (KeyError, TypeError, AttributeError) as exc:
        logger.error('Failed to extract PayMongo webhook metadata: %s', exc)
        return {}
