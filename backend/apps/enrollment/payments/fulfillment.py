import logging
from django.db import transaction
from django.db.models import F

from apps.enrollment.service import EmailService, PaymentConfirmationEmailSender, RefundConfirmationEmailSender
from .dto import PaymentEvent

logger = logging.getLogger(__name__)


class FulfillmentFacade:

    def activate_enrollment(self, order, event: PaymentEvent) -> None:
        from apps.enrollment.models import Order, Enrollment

        with transaction.atomic():
            order = Order.objects.select_for_update().get(id=order.id)
            if order.status == 'paid':
                return

            order.status = 'paid'
            order.save()

            self._record_transaction(order, event, status='paid')

            Enrollment.objects.get_or_create(
                user=order.user,
                course=order.course,
                order=order,
                is_active=True,
            )

        self._send_email(
            PaymentConfirmationEmailSender(order.user, order, event.receipt_url or ''),
            order.id,
            'payment confirmation',
        )

    def record_failed_payment(self, order, event: PaymentEvent) -> None:
        order.status = 'failed'
        order.save()
        self._record_transaction(order, event, status='failed')

    def deactivate_enrollment(self, order, event: PaymentEvent) -> None:
        from apps.enrollment.models import Order, Enrollment
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

            self._record_transaction(order, event, status='refunded')

        self._send_email(
            RefundConfirmationEmailSender(order.user, order, event.amount),
            order.id,
            'refund confirmation',
        )

    def _record_transaction(self, order, event: PaymentEvent, *, status: str) -> None:
        from apps.enrollment.models import Transaction

        Transaction.objects.create(
            order=order,
            status=status,
            amount=event.amount,
            currency=event.currency,
            gateway_reference=event.reference,
            gateway_charge_id=event.charge_id,
            receipt_url=event.receipt_url,
            payment_method_type=event.payment_method_type,
        )

    def _send_email(self, sender, order_id, label: str) -> None:
        success = EmailService(sender).process_sending()
        if not success:
            logger.error("Failed to send %s email for order %s", label, order_id)
