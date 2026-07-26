import logging
from abc import ABC, abstractmethod
from django.core.mail import send_mail
from django.conf import settings
from anymail.exceptions import AnymailRequestsAPIError, AnymailRecipientsRefused

logger = logging.getLogger(__name__)


class Sender(ABC):

    @abstractmethod
    def send(self) -> bool:
        pass
 

class EmailService:
    """
    Context class for the Strategy pattern.
    Orchestrates email delivery and centralizes exception handling
    so concrete senders stay focused on message composition only.
    """

    def __init__(self, sender: Sender):
        self.sender = sender

    def process_sending(self) -> bool:
        try:
            return self.sender.send()
        except AnymailRecipientsRefused as e:
            logger.error(
                "Recipient refused [%s]: %s",
                type(self.sender).__name__,
                e,
            )
            return False
        except AnymailRequestsAPIError as e:
            logger.error(
                "SendGrid API error [%s]: status=%s, %s",
                type(self.sender).__name__,
                getattr(e, 'status_code', 'unknown'),
                e,
            )
            return False
        except Exception as e:
            logger.error(
                "Unexpected email error [%s]: %s",
                type(self.sender).__name__,
                e,
            )
            return False


class OTPEmailSender(Sender):
    subject_map = {
        'registration': 'Verify Your Email - OTP Code',
        'password_reset': 'Reset Your Password - OTP Code',
        'forget_password': 'Reset Your Password - OTP Code',
        'google_set_password': 'Set Your Password - OTP Code',
        'login': 'Two-Factor Authentication - OTP Code',
    }

    def __init__(self, user, otp_code: str, purpose: str):
        self.user = user
        self.otp_code = otp_code
        self.purpose = purpose

    def send(self) -> bool:
        subject = self.subject_map.get(self.purpose, 'Your OTP Code')
        name = self.user.first_name or self.user.username

        message = (
            f"Hello {name},\n\n"
            f"Your verification code is: {self.otp_code}\n\n"
            f"This code will expire in {settings.OTP_EXPIRY_MINUTES} minutes.\n"
            f"If you did not request this code, please ignore this email."
        )

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[self.user.email],
            fail_silently=False,
        )
        return True


class PaymentConfirmationEmailSender(Sender):

    def __init__(self, user, order, receipt_url: str):
        self.user = user
        self.order = order
        self.receipt_url = receipt_url

    def send(self) -> bool:
        name = self.user.first_name or self.user.username
        course_title = self.order.course.title

        message = (
            f"Hello {name},\n\n"
            f"Your payment for \"{course_title}\" has been processed successfully.\n\n"
            f"Order ID: {self.order.id}\n"
            f"Amount: ${self.order.amount} {self.order.currency}\n\n"
            f"View your receipt: {self.receipt_url}\n\n"
            f"You now have full access to the course. Happy learning!"
        )

        send_mail(
            subject=f"Payment Confirmed - {course_title}",
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[self.user.email],
            fail_silently=False,
        )
        return True


class RefundConfirmationEmailSender(Sender):

    def __init__(self, user, order, refund_amount):
        self.user = user
        self.order = order
        self.refund_amount = refund_amount

    def send(self) -> bool:
        name = self.user.first_name or self.user.username
        course_title = self.order.course.title

        message = (
            f"Hello {name},\n\n"
            f"Your refund for \"{course_title}\" has been processed.\n\n"
            f"Order ID: {self.order.id}\n"
            f"Refund Amount: ${self.refund_amount} {self.order.currency}\n\n"
            f"The refund will appear on your original payment method within 5-10 business days.\n"
            f"Your access to the course has been deactivated.\n\n"
            f"If you have any questions, please contact our support team."
        )

        send_mail(
            subject=f"Refund Processed - {course_title}",
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[self.user.email],
            fail_silently=False,
        )
        return True
