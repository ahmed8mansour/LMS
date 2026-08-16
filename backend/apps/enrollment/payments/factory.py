# factory.py (Factory — provider selection by config)

from django.core.exceptions import ImproperlyConfigured
from django.conf import settings
from .base import PaymentGateway
from .stripe_gateway import StripeGateway

# simple factory

GATEWAYS = {
    "stripe": StripeGateway,
}


def get_payment_gateway(name=None) -> PaymentGateway:
    gateway_name = name or getattr(
        settings,
        "PAYMENT_GATEWAY",
        "stripe"
    )

    gateway_class = GATEWAYS.get(gateway_name)

    if not gateway_class:
        raise ImproperlyConfigured(
            f"Unknown gateway: {gateway_name}"
        )

    return gateway_class()