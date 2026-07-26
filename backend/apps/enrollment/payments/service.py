import logging
from datetime import timedelta
from django.conf import settings
from django.db import transaction, IntegrityError
from django.utils import timezone

from .dto import PaymentRequest, PaymentEvent
from .exceptions import RefundNotAllowedError, DuplicatePaymentError
from .factory import get_payment_gateway
from . import fulfillment

logger = logging.getLogger(__name__)

REFUND_WINDOW_DAYS = 14


class CheckoutService:
    """
    Creates an Order and initiates payment through the configured gateway.

    Idempotent per (user, course): the Order.idempotency_key unique constraint
    (T050b) is the actual guard against a double-submitted checkout request
    racing this service — the existence check below is just the fast path,
    not the source of truth.
    """

    def __init__(self, gateway=None, gateway_name=None):
        self.gateway_name = gateway_name or getattr(settings, 'PAYMENT_GATEWAY', 'stripe')
        self.gateway = gateway or get_payment_gateway(self.gateway_name)

    def start_checkout(self, user, course):
        from apps.enrollment.models import Order

        idempotency_key = f"user:{user.id}:course:{course.id}"

        try:
            with transaction.atomic():
                order = Order.objects.create(
                    user=user,
                    course=course,
                    status='pending',
                    amount=course.price,
                    currency='USD',
                    payment_gateway=self.gateway_name,
                    idempotency_key=idempotency_key,
                )

                attempt = self.gateway.initiate_payment(PaymentRequest(
                    amount=course.price,
                    currency='USD',
                    order_id=str(order.id),
                    idempotency_key=idempotency_key,
                    metadata={
                        'order_id': str(order.id),
                        'course_id': str(course.id),
                        'user_id': str(user.id),
                    },
                ))

                order.stripe_payment_intent_id = attempt.reference
                order.save()
        except IntegrityError:
            existing = Order.objects.filter(idempotency_key=idempotency_key, status='pending').first()
            raise DuplicatePaymentError(
                'A checkout for this course is already in progress',
                order_id=existing.id if existing else None,
            )

        return order, attempt


class RefundService:
    """
    Processes admin-initiated refunds: validates eligibility, delegates the
    provider call and idempotent finalization (order/enrollment/counters/email)
    to fulfillment.deactivate_enrollment — the same function the
    `charge.refunded` webhook handler uses, so a refund issued directly from
    the provider's dashboard is finalized identically to one issued here,
    whichever reaches the order first.
    """

    def __init__(self, order, gateway=None):
        self.order = order
        self.gateway = gateway or get_payment_gateway(order.payment_gateway)

    def process_refund(self):
        order = self.order

        if order.status != 'paid':
            raise RefundNotAllowedError('Order is not eligible for refund')

        if order.created_at < timezone.now() - timedelta(days=REFUND_WINDOW_DAYS):
            raise RefundNotAllowedError(
                'Refund window expired. Refunds are only allowed within 14 days of purchase.'
            )

        result = self.gateway.refund(order.stripe_payment_intent_id)

        # Not a real webhook delivery, so there's no provider event id to dedupe
        # against — this path never touches ProcessedWebhookEvent (that's the
        # webhook dispatcher's job); the `order.status == 'refunded'` guard
        # inside fulfillment.deactivate_enrollment is what makes this call
        # idempotent (e.g. an admin double-clicking refund).
        event = PaymentEvent(
            event_id=f"refund:{order.id}:{result.reference}",
            event_type='charge.refunded',
            reference=order.stripe_payment_intent_id,
            charge_id=result.charge_id,
            receipt_url=None,
            payment_method_type='refund',
            amount=result.amount_refunded,
            currency=order.currency,
        )
        fulfillment.deactivate_enrollment(order, event)

        return result
