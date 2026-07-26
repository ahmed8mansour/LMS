# factory.py (Factory — provider selection by config)

from django.core.exceptions import ImproperlyConfigured
from django.conf import settings
from .base import PaymentGateway
from .stripe_gateway import StripeGateway


def get_payment_gateway(name: str = None) -> PaymentGateway:
    gateway = name or getattr(settings, "PAYMENT_GATEWAY", "stripe")
    if gateway == "stripe":
        return StripeGateway()
    raise ImproperlyConfigured(f"Unknown PAYMENT_GATEWAY: {gateway}")
