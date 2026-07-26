from rest_framework.response import Response
from rest_framework.views import APIView

from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from apps.authentication.utils import CookieJWTAuthentication


from rest_framework.generics import ListAPIView
from .serializers import CreatePaymentSerializer, GetOrderDetailsSerializer, OrderSummarySerializer, BillingSummarySerializer, StudentOrderHistorySerializer, RefundOrderSerializer, FreeEnrollmentSerializer

from django.db.models import Sum
from apps.course.models import Course
from apps.course.permissions import isAdmin
from .models import Order, Enrollment
from .pagination import BillingPageNumberPagination
from .payments.exceptions import PaymentException, DuplicatePaymentError, WebhookVerificationError
from .payments.factory import get_payment_gateway
from .payments.service import CheckoutService, RefundService
from .payments.webhooks import WebhookDispatcher
import logging

from apps.course.serializers import CourseSerializer
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

logger = logging.getLogger(__name__)


_EXCEPTION_STATUS = {
    'PaymentDeclinedError': status.HTTP_402_PAYMENT_REQUIRED,
    'RefundNotAllowedError': status.HTTP_400_BAD_REQUEST,
    'WebhookVerificationError': status.HTTP_400_BAD_REQUEST,
    'PaymentNotFoundError': status.HTTP_404_NOT_FOUND,
    'DuplicatePaymentError': status.HTTP_409_CONFLICT,
    'GatewayError': status.HTTP_502_BAD_GATEWAY,
}


def _map_payment_exception(exc: PaymentException) -> Response:
    """Single place mapping every payments-domain exception to an HTTP response, so no view branches on exception type itself."""
    status_code = _EXCEPTION_STATUS.get(type(exc).__name__, status.HTTP_502_BAD_GATEWAY)
    body = {'error': str(exc)}
    if isinstance(exc, DuplicatePaymentError) and exc.order_id:
        body['order_id'] = exc.order_id
    return Response(body, status=status_code)


class CreatePaymentIntentView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreatePaymentSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        course = Course.objects.get(id=serializer.validated_data['course'])

        try:
            order, attempt = CheckoutService().start_checkout(request.user, course)
        except PaymentException as e:
            return _map_payment_exception(e)

        order_serializer = OrderSummarySerializer(order)

        return Response({
            'client_secret': attempt.client_secret,
            'order': order_serializer.data,
        }, status=status.HTTP_200_OK)


class GetOrderDetailsView(APIView):
    """
    Retrieve order details for state recovery after page refresh or payment retry.
    Accepts pending and failed orders. Checks the PaymentIntent's actual status
    and handles three cases:
      - succeeded: reconcile (activate enrollment) and tell frontend to redirect
      - canceled: mint a fresh PaymentIntent on the same order
      - anything else: return the existing client_secret (PI is still live)
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = GetOrderDetailsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        order_id = serializer.validated_data['order_id']

        try:
            order = Order.objects.select_related('course', 'course__instructor').get(id=order_id)
        except Order.DoesNotExist:
            return Response(
                {'error': 'Order not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if order.user_id != request.user.id:
            return Response(
                {'error': 'You do not have permission to access this order'},
                status=status.HTTP_403_FORBIDDEN
            )

        if order.status not in ('pending', 'failed'):
            return Response(
                {'error': f'Order is {order.status}, cannot proceed with payment'},
                status=status.HTTP_400_BAD_REQUEST
            )

        gateway = get_payment_gateway(order.payment_gateway)

        try:
            attempt = gateway.retrieve_attempt(order.stripe_payment_intent_id)
        except PaymentException as e:
            return _map_payment_exception(e)

        if attempt.raw_status == 'succeeded':
            from .payments import fulfillment
            from .payments.dto import PaymentEvent
            event = PaymentEvent(
                event_id=f"recovery:{order.id}",
                event_type='payment_intent.succeeded',
                reference=attempt.reference,
                charge_id=None,
                receipt_url=None,
                payment_method_type='card',
                amount=order.amount,
                currency=order.currency,
            )
            fulfillment.activate_enrollment(order, event)
            return Response({
                'already_paid': True,
                'order_id': order.id,
                'message': 'Payment already completed. Redirecting to course.',
            }, status=status.HTTP_200_OK)

        if attempt.raw_status == 'canceled':
            from .payments.dto import PaymentRequest
            try:
                new_attempt = gateway.initiate_payment(PaymentRequest(
                    amount=order.amount,
                    currency=order.currency,
                    order_id=str(order.id),
                    metadata={
                        'order_id': str(order.id),
                        'course_id': str(order.course_id),
                        'user_id': str(order.user_id),
                    },
                ))
            except PaymentException as e:
                return _map_payment_exception(e)

            order.stripe_payment_intent_id = new_attempt.reference
            order.status = 'pending'
            order.save()
            attempt = new_attempt

        if order.status == 'failed':
            order.status = 'pending'
            order.save()

        response_data = {
            'order_id': order.id,
            'client_secret': attempt.client_secret,
            'status': order.status,
            'amount': str(order.amount),
            'currency': order.currency,
            'course': CourseSerializer(order.course).data,
        }

        return Response(response_data, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class PaymentWebhookView(APIView):
    """
    Verifies and dispatches a provider webhook. `gateway` is a URL kwarg
    (default 'stripe') so a second provider gets its own endpoint
    (`webhook/paypal/`) without a new view class — see WebhookDispatcher.

    Signature header extraction is currently Stripe-specific (Stripe-Signature);
    when a second gateway is added its own signature header(s) will need
    reading here too, since providers don't agree on a header name/shape.
    """

    def post(self, request, gateway='stripe'):
        payload = request.body
        signature = request.META.get("HTTP_STRIPE_SIGNATURE", "")

        try:
            WebhookDispatcher(gateway_name=gateway).dispatch(payload, signature)
        except PaymentException as e:
            # WebhookVerificationError is the one case worth telling the
            # caller about; every other domain failure is logged and still
            # answered 200 so the provider does not endlessly retry (matches
            # the pre-refactor behavior of this endpoint).
            if isinstance(e, WebhookVerificationError):
                return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
            logger.error("Webhook processing error (gateway=%s): %s", gateway, e)

        return Response({'status': 'received'}, status=status.HTTP_200_OK)


class FreeEnrollmentView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FreeEnrollmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        course_id = serializer.validated_data['course_id']

        try:
            course = Course.objects.get(id=course_id, is_published=True)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        if course.price != 0:
            return Response({'error': 'This course is not free'}, status=status.HTTP_400_BAD_REQUEST)

        if Enrollment.objects.filter(user=request.user, course=course, is_active=True).exists():
            return Response({'error': 'Already enrolled in this course'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction as db_transaction
        with db_transaction.atomic():
            order = Order.objects.create(
                user=request.user,
                course=course,
                status='paid',
                amount=0,
                currency='USD',
                stripe_payment_intent_id='free_enrollment',
                payment_gateway='free',
            )

            enrollment = Enrollment.objects.create(
                user=request.user,
                course=course,
                order=order,
                is_active=True,
            )

        return Response({
            'message': 'Successfully enrolled',
            'enrollment_id': enrollment.id,
            'course_id': course.id,
        }, status=status.HTTP_201_CREATED)


class StudentBillingSummaryView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        paid_orders = Order.objects.filter(user=request.user, status='paid')

        total_spent = paid_orders.aggregate(total=Sum('amount'))['total'] or 0
        courses_purchased = paid_orders.count()
        last_payment_date = paid_orders.order_by('-created_at').values_list('created_at', flat=True).first()

        serializer = BillingSummarySerializer({
            'total_spent': total_spent,
            'courses_purchased': courses_purchased,
            'last_payment_date': last_payment_date,
        })

        return Response(serializer.data, status=status.HTTP_200_OK)


class StudentOrderHistoryView(ListAPIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = StudentOrderHistorySerializer
    pagination_class = BillingPageNumberPagination

    def get_queryset(self):
        return Order.objects.filter(
            user=self.request.user,
            status__in=['paid', 'refunded']
        ).select_related('course').prefetch_related('transaction_set').order_by('-created_at')


class AdminRefundOrderView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [isAdmin]

    def post(self, request):
        serializer = RefundOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        order_id = serializer.validated_data['order_id']

        try:
            order = Order.objects.select_related('course').get(id=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = RefundService(order).process_refund()
        except PaymentException as e:
            return _map_payment_exception(e)

        return Response({
            'message': 'Refund processed successfully',
            'order_id': order.id,
            'refund_amount': str(result.amount_refunded),
            'stripe_refund_id': result.reference,
        }, status=status.HTTP_200_OK)
