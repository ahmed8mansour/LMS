class PaymentException(Exception):
    pass


class GatewayError(PaymentException):
    """Provider unreachable, misconfigured, or returned an unexpected error."""
    pass


class PaymentDeclinedError(PaymentException):
    """Card declined / funding failure — provider-specific reasons collapse to this one case."""
    pass


class RefundNotAllowedError(PaymentException):
    pass


class WebhookVerificationError(PaymentException):
    pass


class PaymentNotFoundError(PaymentException):
    """The gateway does not recognize the given reference (e.g. stale/invalid id)."""
    pass


class DuplicatePaymentError(PaymentException):
    """Raised when an idempotency key collision is caught, so views never see a raw IntegrityError."""

    def __init__(self, message: str, order_id=None):
        self.order_id = order_id
        super().__init__(message)
