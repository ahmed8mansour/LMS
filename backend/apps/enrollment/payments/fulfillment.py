import logging
from django.db import transaction
from django.db.models import F

from apps.enrollment.service import EmailService, PaymentConfirmationEmailSender, RefundConfirmationEmailSender
from .dto import PaymentEvent

logger = logging.getLogger(__name__)


def activate_enrollment(order, event: PaymentEvent) -> None:
    """
    Marks the order paid, records the Transaction, activates the enrollment,
    and emails a payment confirmation.

    Idempotent: re-delivered `payment_intent.succeeded` webhooks for an
    already-paid order are a no-op, guarded under a row lock.
    """
    from apps.enrollment.models import Order, Transaction, Enrollment

    with transaction.atomic():
        order = Order.objects.select_for_update().get(id=order.id)
        if order.status == 'paid':
            return

        order.status = 'paid'
        order.save()

        Transaction.objects.create(
            order=order,
            status='paid',
            amount=event.amount,
            currency=event.currency,
            gateway_reference=event.reference,
            gateway_charge_id=event.charge_id,
            receipt_url=event.receipt_url,
            payment_method_type=event.payment_method_type,
        )

        Enrollment.objects.get_or_create(
            user=order.user,
            course=order.course,
            order=order,
            is_active=True,
        )

    success = EmailService(
        PaymentConfirmationEmailSender(order.user, order, event.receipt_url or '')
    ).process_sending()
    if not success:
        logger.error("Failed to send payment confirmation email for order %s", order.id)


def record_failed_payment(order, event: PaymentEvent) -> None:
    """Marks the order failed and records the failed Transaction attempt. No enrollment/email side effects."""
    from apps.enrollment.models import Transaction

    order.status = 'failed'
    order.save()

    Transaction.objects.create(
        order=order,
        status='failed',
        amount=event.amount,
        currency=event.currency,
        gateway_reference=event.reference,
        gateway_charge_id=event.charge_id,
        receipt_url=event.receipt_url,
        payment_method_type=event.payment_method_type,
    )


def deactivate_enrollment(order, event: PaymentEvent) -> None:
    """
    Marks the order refunded, records the Transaction, deactivates the
    enrollment, decrements course/instructor counters, and emails a refund
    confirmation.

    Idempotent under a row lock — safe to call from both RefundService
    (admin-initiated refund) and the `charge.refunded` webhook handler (e.g. a
    refund issued directly from the Stripe dashboard), whichever reaches the
    order first.
    """
    from apps.enrollment.models import Order, Transaction, Enrollment
    from apps.authentication.models import InstructorProfile
    from apps.course.models import Course

    with transaction.atomic():
        order = Order.objects.select_for_update().get(id=order.id)
        if order.status == 'refunded':
            return

        order.status = 'refunded'
        order.save()

        deactivated = Enrollment.objects.filter(order=order, is_active=True).update(is_active=False)
        if deactivated:
            Course.objects.filter(id=order.course_id).update(
                subscribers_count=F('subscribers_count') - 1
            )
            InstructorProfile.objects.filter(user=order.course.instructor.user).update(
                students_count=F('students_count') - 1
            )

        Transaction.objects.create(
            order=order,
            status='refunded',
            amount=event.amount,
            currency=event.currency,
            gateway_reference=event.reference,
            gateway_charge_id=event.charge_id,
            receipt_url=event.receipt_url,
            payment_method_type=event.payment_method_type,
        )

    success = EmailService(
        RefundConfirmationEmailSender(order.user, order, event.amount)
    ).process_sending()
    if not success:
        logger.error("Failed to send refund confirmation email for order %s", order.id)
