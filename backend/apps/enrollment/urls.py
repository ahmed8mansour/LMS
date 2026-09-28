from django.urls import path, include
from .views import CreatePaymentIntentView, PaymentWebhookView, GetOrderDetailsView, FreeEnrollmentView, StudentBillingSummaryView, StudentOrderHistoryView, AdminRefundOrderView, InstructorEarningsView

urlpatterns = [
    path('create-payment-intent/', CreatePaymentIntentView.as_view(), name="create_intent"),
    path('get-order-details/', GetOrderDetailsView.as_view(), name="get_order_details"),
    path('webhook/<str:gateway>/', PaymentWebhookView.as_view(), name="payment_webhook"),
    # Alias for the pre-refactor URL — remove once the Stripe dashboard's
    # webhook endpoint is updated to webhook/stripe/ (T050n).
    path('payment-webhook/', PaymentWebhookView.as_view(), name="intent_webhook"),
    path('enroll-free/', FreeEnrollmentView.as_view(), name="free_enrollment"),
    path('student/billing/summary/', StudentBillingSummaryView.as_view(), name="student_billing_summary"),
    path('student/orders/', StudentOrderHistoryView.as_view(), name="student_orders"),
    path('refund-order/', AdminRefundOrderView.as_view(), name="refund_order"),
    # 013 — the instructor earnings snapshot. It lives in `enrollment/`, not under
    # `courses/instructor/` with the other instructor reads, because orders live here
    # and the student money reads above are its mirror image; 012 set the precedent by
    # putting the instructor reviews feed in the reviews app (research P1).
    # A plain path(), not the router: this is an APIView, not a viewset.
    path('instructor/earnings/', InstructorEarningsView.as_view(), name='instructor_earnings'),
]

