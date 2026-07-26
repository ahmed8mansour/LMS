from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Optional, Dict, Any


class PaymentStatus(str, Enum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


@dataclass(frozen=True)
class PaymentRequest:
    amount: Decimal
    currency: str
    order_id: str
    customer_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PaymentAttempt:
    reference: str
    client_secret: Optional[str]
    approval_url: Optional[str]
    raw_status: Optional[str] = None


@dataclass(frozen=True)
class RefundResult:
    reference: str                  # the refund's own id (e.g. Stripe re_xxx) — reported back to the admin caller
    charge_id: Optional[str]        # the charge that was refunded, for Transaction record-keeping
    amount_refunded: Decimal
    status: PaymentStatus


@dataclass(frozen=True)
class PaymentEvent:
    event_id: str        # provider's unique event id (e.g. Stripe evt_xxx) — used to dedupe re-delivered webhooks
    event_type: str
    reference: str        # the payment/order-level reference (e.g. PaymentIntent id) — shared across multiple events
    charge_id: Optional[str]
    receipt_url: Optional[str]
    payment_method_type: str
    amount: Decimal
    currency: str
