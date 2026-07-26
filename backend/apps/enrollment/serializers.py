from rest_framework import serializers
from .models import Order , Transaction , Enrollment
# from apps.authentication.models import CustomUser
from rest_framework.response import Response
from django.conf import settings
from rest_framework import status
from apps.course.models import Course




class CreatePaymentSerializer(serializers.Serializer):
    course = serializers.IntegerField()

    def validate_course(self, value):
        try:
            course = Course.objects.get(id=value, is_published=True)
        except Course.DoesNotExist:
            raise serializers.ValidationError("There is no course with this data")
        return value

    def validate(self, data):
        user = self.context['request'].user
        course = Course.objects.get(id=data['course'])

        already_enrolled = Enrollment.objects.filter(
            user=user,
            course=course,
            is_active=True
        ).exists()

        if already_enrolled:
            raise serializers.ValidationError("You already enrolled this course before")

        return data


class GetOrderDetailsSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()

    def validate_order_id(self, value):
        try:
            order = Order.objects.get(id=value)
        except Order.DoesNotExist:
            raise serializers.ValidationError("Order not found")
        return value


class FreeEnrollmentSerializer(serializers.Serializer):
    course_id = serializers.IntegerField()


class RefundOrderSerializer(serializers.Serializer):
    """Validates the request shape only; existence/eligibility checks happen in the view so a missing order can return 404 instead of a 400 field error."""
    order_id = serializers.IntegerField()


class OrderDetailsResponseSerializer(serializers.Serializer):
    order_id = serializers.IntegerField()
    client_secret = serializers.CharField()
    status = serializers.CharField()
    course = serializers.SerializerMethodField()
    amount = serializers.DecimalField(max_digits=6, decimal_places=2)
    currency = serializers.CharField()

    def get_course(self, obj):
        return {
            'id': obj.course.id,
            'title': obj.course.title,
            'thumbnail': obj.course.thumbnail.url if obj.course.thumbnail else None,
            'instructor_name': obj.course.instructor.get_full_name() or obj.course.instructor.email,
            'price': str(obj.course.price)
        }


class OrderSummarySerializer(serializers.ModelSerializer):
    """Serializer for order summary in payment intent response."""
    class Meta:
        model = Order
        fields = ['id', 'currency', 'amount', 'status']
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = '__all__'





class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'


class EnrollmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        fields = '__all__'


class BillingSummarySerializer(serializers.Serializer):
    total_spent = serializers.DecimalField(max_digits=10, decimal_places=2)
    courses_purchased = serializers.IntegerField()
    last_payment_date = serializers.DateTimeField(allow_null=True)


class StudentOrderHistorySerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    course_name = serializers.CharField(source='course.title')
    method = serializers.SerializerMethodField()
    receipt_url = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source='created_at')

    class Meta:
        model = Order
        fields = ['id', 'course_name', 'amount', 'currency', 'status', 'method', 'receipt_url', 'date']

    def get_id(self, obj):
        return f"ORD-{obj.id}"

    def _latest_transaction(self, obj):
        transactions = list(obj.transaction_set.all())
        if not transactions:
            return None
        return max(transactions, key=lambda t: t.created_at)

    def get_method(self, obj):
        transaction = self._latest_transaction(obj)
        return transaction.payment_method_type if transaction else "card"

    def get_receipt_url(self, obj):
        transaction = self._latest_transaction(obj)
        return transaction.receipt_url if transaction else None