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