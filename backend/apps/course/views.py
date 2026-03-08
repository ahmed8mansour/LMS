from django.shortcuts import render
from django.http import HttpResponse
from rest_framework.response import Response
from datetime import datetime, timedelta
from rest_framework import serializers

from rest_framework import mixins, permissions , generics
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication

from rest_framework import status

from django.conf import settings
from .serializers import CourseSerializer
from .models import Course

from rest_framework.viewsets import ModelViewSet


# Create your views here.

class CourseView(APIView):
    """
        get specific course 
    """
    def get(self, request , *args, **kwargs):
        course_id = kwargs['id']
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return Response({"error":"Course not found"} , status = status.HTTP_404_NOT_FOUND)
        serializer = CourseSerializer(course , context={"id":course_id})
        return Response(data=serializer.data , status = status.HTTP_200_OK)


class CourseViewSet(ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer