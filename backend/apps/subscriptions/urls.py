from django.urls import path

from .views import CreateCheckoutView, SubscriptionStatusView, paymongo_webhook

urlpatterns = [
    path('status/', SubscriptionStatusView.as_view(), name='subscription-status'),
    path('checkout/create/', CreateCheckoutView.as_view(), name='subscription-checkout-create'),
    # Webhook — exempt from CSRF and JWT auth; verified via HMAC signature
    path('webhook/paymongo/', paymongo_webhook, name='subscription-webhook-paymongo'),
]
