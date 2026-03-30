from rest_framework.response import Response
from datetime import datetime, timedelta
from rest_framework.views import APIView

from rest_framework import status
from django.conf import settings
from rest_framework.permissions import IsAuthenticated

from apps.authentication.utils import CookieJWTAuthentication


from rest_framework.generics import ListAPIView
from .serializers import OrderSerializer , CreatePaymentSerializer

from django.db import transaction
from apps.course.models import Course
from .models import Order , Transaction , Enrollment
import stripe


from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator

# ==========================================
# ==========================================
# ==========================================

stripe.api_key = settings.STRIPE_SECRET_KEY



class CreatePaymentIntentView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreatePaymentSerializer(data = request.data  , context={'request':request})
        if not serializer.is_valid():
            return Response(serializer.errors , status=status.HTTP_400_BAD_REQUEST)
        
        course = Course.objects.get(id = serializer.validated_data['course'])
        try:
            with transaction.atomic():
                order = Order.objects.create(
                    user = request.user,
                    course = course , 
                    status = 'pending',
                    amount = course.price,
                    currency = 'USD'
                )

                intent = stripe.PaymentIntent.create(
                    amount=int(course.price * 100), # in cents
                    currency='usd',
                    automatic_payment_methods={
                        'enabled': True,
                        'allow_redirects': 'never'   
                    },
                    metadata={
                        'order_id' : order.id,
                        'course_id' : course.id,
                        'user_id' : request.user.id,
                    }
                )
                order.stripe_payment_intent_id = intent.id
                order.save()

        except stripe.error.StripeError as e:
            return Response(
                {'error': 'something went wrong with stripe , try later'},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            return Response(
                {'error': 'something went wrong'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        return Response({
            'client_secret' : intent.client_secret,
            'order_id' : order.id,
        } , status=status.HTTP_200_OK)
    


# stripe payment_intents confirm pi_3TDL3cEzoqWKETIS0kmfPgwN --payment-method pm_card_visa
@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    def post(self , request):
        payload = request.body 
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE")      
        
        try : 
            # التحقق من صحة الويبهوك 
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=sig_header,
                secret=settings.STRIPE_WEBHOOK_SECRET
            ) 
        except ValueError : 
            return Response({'error': 'Invalid payload'}, status=400)
        except stripe.error.SignatureVerificationError:
            return Response({'error': 'Invalid signature'}, status=400)
        
        print(event['data'])
        print(event['data']['object'])
        print(event['data']['object']['metadata'])
        if event['type'] == 'payment_intent.succeeded':
            self.handle_payment_succeeded(event['data']['object'])

        elif event['type'] == 'payment_intent.payment_failed':
            self.handle_payment_failed(event['data']['object'])

        # لازم ترجع 200 دايماً — حتى Stripe ما يعيد الإرسال
        return Response({'status': 'received'}, status=200)
    
    def handle_payment_succeeded(self , payment_intent):

        order_id = payment_intent['metadata'].get('order_id')
        if not order_id:
            return
        try :
            with transaction.atomic(): # 3 عمليات 
                order = Order.objects.select_for_update().get(id = order_id)

                if order.status == 'paid':
                    return
                # 1 خلي الاوردر مدفوع 
                order.status = 'paid'
                order.save()

                # 2 سجل عملية الدفع 
                Transaction.objects.create(
                    order = order,
                    status = 'paid',
                    amount=payment_intent['amount'] / 100,  # رجّع من cents
                    currency=payment_intent['currency'],
                    stripe_payment_intent_id=payment_intent['id'],
                    )
                
                # 3 سجل اليوزر في الكورس
                Enrollment.objects.get_or_create(
                    user = order.user,
                    course = order.course,
                    order = order,
                    is_active= True,
                )
                
        except Order.DoesNotExist:
        # سجّل الخطأ بدون ما ترجع 400
        # لأن 400 بيخلي Stripe يعيد الإرسال
            pass

    def handle_payment_failed(self, payment_intent):
        order_id = payment_intent['metadata'].get('order_id')

        if not order_id:
            return

        try:
            order = Order.objects.get(id=order_id)
            order.status = 'failed'
            order.save()

            Transaction.objects.create(
                order=order,
                stripe_payment_intent_id=payment_intent['id'],
                amount=payment_intent['amount'] / 100,
                currency=payment_intent['currency'],
                status='failed',
            )

        except Order.DoesNotExist:
            pass