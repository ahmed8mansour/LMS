from decimal import Decimal
from django.conf import settings
import stripe

from .base import PaymentGateway
from .dto import PaymentRequest, PaymentAttempt, PaymentStatus, RefundResult, PaymentEvent
from .exceptions import GatewayError, PaymentDeclinedError, PaymentNotFoundError, WebhookVerificationError

stripe.api_key = settings.STRIPE_SECRET_KEY

_STATUS_MAP = {
    'succeeded': PaymentStatus.SUCCEEDED,
    'processing': PaymentStatus.PENDING,
    'requires_payment_method': PaymentStatus.FAILED,
    'requires_action': PaymentStatus.PENDING,
    'requires_confirmation': PaymentStatus.PENDING,
    'requires_capture': PaymentStatus.PENDING,
    'canceled': PaymentStatus.FAILED,
}


class StripeGateway(PaymentGateway):
    """
    Adapter over Stripe's PaymentIntents API — not the separate Stripe Checkout
    Session product (see the design-decision table in tasks.md Phase 7: the
    embedded PaymentElement flow already built is preserved as-is).

    The only module in this codebase allowed to import `stripe`.
    """

    def initiate_payment(self, payment_request: PaymentRequest) -> PaymentAttempt:
        try:
            intent = stripe.PaymentIntent.create(
                amount=int(payment_request.amount * 100),
                currency=payment_request.currency.lower(),
                automatic_payment_methods={
                    'enabled': True,
                    'allow_redirects': 'never',
                },
                metadata=payment_request.metadata,
                idempotency_key=payment_request.idempotency_key,
            )
        except stripe.error.CardError as e:
            raise PaymentDeclinedError(str(e)) from e
        except stripe.error.StripeError as e:
            raise GatewayError(str(e)) from e

        return PaymentAttempt(
            reference=intent.id,
            client_secret=intent.client_secret,
            approval_url=None,
        )

    def retrieve_attempt(self, reference: str) -> PaymentAttempt:
        try:
            intent = stripe.PaymentIntent.retrieve(reference)
        except stripe.error.InvalidRequestError as e:
            raise PaymentNotFoundError(str(e)) from e
        except stripe.error.StripeError as e:
            raise GatewayError(str(e)) from e

        return PaymentAttempt(
            reference=intent.id,
            client_secret=intent.client_secret,
            approval_url=None,
            raw_status=intent.status,
        )

    def get_status(self, reference: str) -> PaymentStatus:
        try:
            intent = stripe.PaymentIntent.retrieve(reference)
        except stripe.error.InvalidRequestError as e:
            raise PaymentNotFoundError(str(e)) from e
        except stripe.error.StripeError as e:
            raise GatewayError(str(e)) from e

        return _STATUS_MAP.get(intent.status, PaymentStatus.PENDING)

    def refund(self, reference: str) -> RefundResult:
        try:
            refund = stripe.Refund.create(payment_intent=reference)
        except stripe.error.InvalidRequestError as e:
            raise PaymentNotFoundError(str(e)) from e
        except stripe.error.StripeError as e:
            raise GatewayError(str(e)) from e

        return RefundResult(
            reference=refund.id,
            charge_id=refund.get('charge'),
            amount_refunded=Decimal(refund.amount) / 100,
            status=PaymentStatus.REFUNDED,
        )

    def parse_and_verify(self, payload: bytes, signature: str) -> PaymentEvent:
        try:
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=signature,
                secret=settings.STRIPE_WEBHOOK_SECRET,
            )
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            raise WebhookVerificationError(str(e)) from e

        obj = event['data']['object']
        event_type = event['type']

        if event_type.startswith('payment_intent.'):
            return self._payment_intent_event(event['id'], event_type, obj)
        if event_type == 'charge.refunded':
            return self._charge_refunded_event(event['id'], obj)

        # Unrecognized event types still normalize to a PaymentEvent so the
        # dispatcher can log-and-ignore, rather than the gateway raising.
        return PaymentEvent(
            event_id=event['id'],
            event_type=event_type,
            reference=obj.get('id', ''),
            charge_id=None,
            receipt_url=None,
            payment_method_type='unknown',
            amount=Decimal(0),
            currency='',
        )

    def _payment_intent_event(self, event_id: str, event_type: str, payment_intent: dict) -> PaymentEvent:
        charge_id = payment_intent.get('latest_charge')
        receipt_url = None
        payment_method_type = 'card'

        if charge_id and event_type == 'payment_intent.succeeded':
            try:
                charge = stripe.Charge.retrieve(charge_id)
                receipt_url = charge.get('receipt_url')
                payment_method_type = self._extract_payment_method_type(charge)
            except stripe.error.StripeError as e:
                raise GatewayError(str(e)) from e

        return PaymentEvent(
            event_id=event_id,
            event_type=event_type,
            reference=payment_intent['id'],
            charge_id=charge_id,
            receipt_url=receipt_url,
            payment_method_type=payment_method_type,
            amount=Decimal(payment_intent['amount']) / 100,
            currency=payment_intent['currency'],
        )

    def _charge_refunded_event(self, event_id: str, charge: dict) -> PaymentEvent:
        return PaymentEvent(
            event_id=event_id,
            event_type='charge.refunded',
            reference=charge.get('payment_intent', ''),
            charge_id=charge.get('id'),
            receipt_url=charge.get('receipt_url'),
            payment_method_type=self._extract_payment_method_type(charge),
            amount=Decimal(charge['amount_refunded']) / 100,
            currency=charge['currency'],
        )

    @staticmethod
    def _extract_payment_method_type(charge: dict) -> str:
        """Resolve a human-relevant payment method, unwrapping wallets (Apple Pay/Google Pay) that Stripe reports as card sub-types."""
        details = charge.get('payment_method_details') or {}
        method_type = details.get('type', 'card')
        if method_type == 'card':
            wallet = (details.get('card') or {}).get('wallet')
            if wallet and wallet.get('type'):
                return wallet['type']
        return method_type
