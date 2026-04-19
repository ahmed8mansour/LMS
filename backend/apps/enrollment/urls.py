from django.urls import path, include
from .views import CreatePaymentIntentView, StripeWebhookView, GetOrderDetailsView

urlpatterns = [
    path('create-payment-intent/', CreatePaymentIntentView.as_view(), name="create_intent"),
    path('get-order-details/', GetOrderDetailsView.as_view(), name="get_order_details"),
    path('payment-webhook/', StripeWebhookView.as_view(), name="intent_webhook"),
]

