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