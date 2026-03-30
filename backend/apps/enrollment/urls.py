from django.urls import path, include
from .views import CreatePaymentIntentView ,  StripeWebhookView

urlpatterns = [
    path('create-payment-intent/' , CreatePaymentIntentView.as_view(), name="create_intent"),
    path('payment-webhook/' , StripeWebhookView.as_view(), name="intent_webhook"),

]

