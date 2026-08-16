# webhooks.py — event_type -> handler dict (Strategy), no Protocol/registry ceremony.
# Adding an event type is one dict entry + one function; no class hierarchy.

import logging
from django.conf import settings

from .dto import PaymentEvent
from .factory import get_payment_gateway
from .fulfillment import FulfillmentFacade

logger = logging.getLogger(__name__)

_fulfillment = FulfillmentFacade()


def _handle_succeeded(order, event: PaymentEvent) -> None:
    _fulfillment.activate_enrollment(order, event)


def _handle_failed(order, event: PaymentEvent) -> None:
    _fulfillment.record_failed_payment(order, event)


def _handle_refunded(order, event: PaymentEvent) -> None:
    _fulfillment.deactivate_enrollment(order, event)


_HANDLERS = {
    'payment_intent.succeeded': _handle_succeeded,
    'payment_intent.payment_failed': _handle_failed,
    'charge.refunded': _handle_refunded,
}


class WebhookDispatcher:
    """
    Verifies and dispatches a provider webhook. Dedupes on the provider's
    event id (ProcessedWebhookEvent, FR-020c) before handing off to a
    fulfillment function; each handler is independently idempotent too
    (guarded by order-status checks), so at-least-once delivery is safe even
    if the dedupe record fails to write.
    """

    def __init__(self, gateway=None, gateway_name=None):
        self.gateway_name = gateway_name or getattr(settings, 'PAYMENT_GATEWAY', 'stripe')
        self.gateway = gateway or get_payment_gateway(self.gateway_name)

    def dispatch(self, payload: bytes, signature: str) -> None:
        from apps.enrollment.models import Order, ProcessedWebhookEvent

        event = self.gateway.parse_and_verify(payload, signature)

        if ProcessedWebhookEvent.objects.filter(event_id=event.event_id).exists():
            logger.info("Ignoring already-processed webhook event %s", event.event_id)
            return

        handler = _HANDLERS.get(event.event_type)
        if handler is None:
            logger.warning("Unhandled webhook event type: %s", event.event_type)
            ProcessedWebhookEvent.objects.create(event_id=event.event_id, gateway=self.gateway_name)
            return

        try:
            order = Order.objects.get(stripe_payment_intent_id=event.reference)
        except Order.DoesNotExist:
            logger.warning(
                "Webhook event %s (%s) references unknown order reference=%s",
                event.event_id, event.event_type, event.reference,
            )
            return

        handler(order, event)

        ProcessedWebhookEvent.objects.get_or_create(
            event_id=event.event_id,
            defaults={'gateway': self.gateway_name},
        )
