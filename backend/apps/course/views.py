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
from .serializers import CourseSerializer , SectionSerializer , QuizSerializer , LectureSerializer
from .models import Course , Section , Quiz , Lecture

from rest_framework.viewsets import ModelViewSet , ReadOnlyModelViewSet

from .permissions import isAdmin , isInstructor
from rest_framework.permissions import IsAuthenticated

from apps.authentication.utils import CookieJWTAuthentication
from apps.authentication.models import InstructorProfile

from rest_framework.serializers import ValidationError
from rest_framework import filters
from .pagination import CourseCursorPagination

from rest_framework.generics import ListAPIView
from apps.enrollment.models import Enrollment
# Create your views here.


class AdminCourseViewSet(ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated , isAdmin]
    authentication_classes = [CookieJWTAuthentication]

class AdminSectionViewSet(ModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated , isAdmin]
    authentication_classes = [CookieJWTAuthentication]


class AdminQuizViewSet(ModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated , isAdmin]
    authentication_classes = [CookieJWTAuthentication]

class AdminLectureViewSet(ModelViewSet):
    queryset = Lecture.objects.all()
    serializer_class = LectureSerializer
    permission_classes = [IsAuthenticated , isAdmin]
    authentication_classes = [CookieJWTAuthentication]



class InstructorCourseViewSet(ModelViewSet):
    serializer_class = CourseSerializer
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated , isInstructor]

    # هيمنع الانستراكتور التانيين من الوصول لكورسات الانستراكتور الاصلي : 
    # retrieve , list  , update , delete , partial update 

    def get_queryset(self):
        try:
            return Course.objects.filter(instructor=self.request.user.instructor_profile)
        except InstructorProfile.DoesNotExist:
            return Course.objects.none()
    
    # نربط الكورس مع الانستراكتور الاصلي 
    def perform_create(self, serializer):
        try:
            serializer.save(instructor=self.request.user.instructor_profile)
        except InstructorProfile.DoesNotExist:
            raise ValidationError("There is no Instructor Profile for this user ")

class InstructorSectionViewSet(ModelViewSet):
    serializer_class = SectionSerializer
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]

    def get_queryset(self):
        try:
            #  نفلتر السيكشن عبر كورسات الإنستراكتور فقط
            return Section.objects.filter(
                course__instructor=self.request.user.instructor_profile
            )
        except InstructorProfile.DoesNotExist:
            return Section.objects.none()

    def perform_create(self, serializer):
        course = serializer.validated_data.get('course')
        #  نتأكد إن الكورس تبعه هو
        if course.instructor != self.request.user.instructor_profile:
            raise ValidationError({"detail":"You don't have access on this Section"})
        serializer.save()


class InstructorLectureViewSet(ModelViewSet):
    serializer_class = LectureSerializer
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]

    def get_queryset(self):
        try:
            return Lecture.objects.filter(
                section__course__instructor=self.request.user.instructor_profile
            )
        except InstructorProfile.DoesNotExist:
            return Lecture.objects.none()

    def perform_create(self, serializer):
        section = serializer.validated_data.get('section')
        #  نتأكد إن السيكشن تبع كورس له
        if section.course.instructor != self.request.user.instructor_profile:
            raise ValidationError({"detail":"You don't have access on this Section"})
        serializer.save()


class InstructorQuizViewSet(ModelViewSet):
    serializer_class = QuizSerializer
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]

    def get_queryset(self):
        try:
            return Quiz.objects.filter(
                section__course__instructor=self.request.user.instructor_profile
            )
        except InstructorProfile.DoesNotExist:
            return Quiz.objects.none()

    def perform_create(self, serializer):
        section = serializer.validated_data.get('section')
        if section.course.instructor != self.request.user.instructor_profile:
            raise ValidationError({"detail":"You don't have access on this Section"})
        serializer.save()



class StudentCourseViewSet(ReadOnlyModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    # applying search filters using DRF filters (filters_backed) >> no external library needed
    filter_backends =[filters.SearchFilter]
    search_fields = ['title', 'description','instructor__title' ,'instructor__user__first_name' ]
    pagination_class = CourseCursorPagination
    authentication_classes=[CookieJWTAuthentication]

    def retrieve(self, request, *args, **kwargs):
        user=request.user
        id= kwargs['pk']
        enrollment = Enrollment.objects.filter(user=request.user, course=id, is_active=True).first()
        enrolled_status = True
        if not enrollment:
            enrolled_status = False
        
        response = super().retrieve(request, *args, **kwargs)
        response.data['enrolled_status'] = enrolled_status
        return response

    def get_queryset(self):
        queryset   = Course.objects.all()
        categories = self.request.query_params.getlist('category')
        level      = self.request.query_params.get('level')
        min_price  = self.request.query_params.get('min_price')
        max_price  = self.request.query_params.get('max_price')
        rating     = self.request.query_params.get('rating')

        if categories:
            queryset = queryset.filter(category__in=categories)
        if level:
            queryset = queryset.filter(level=level)
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)
        if rating:
            queryset = queryset.filter(rating__gte=rating)

        # ─── Sort ─────────────────────────────────
        # sort = self.request.query_params.get('sort', 'newest')  # default: newest

        # sort_map = {
        #     'newest':  '-last_updated',
        #     'popular': '-subscribers_count',
        #     'system':  'id',           
        # }

        # order_by = sort_map.get(sort, '-last_updated')  # default (fallback): newest
        # queryset = queryset.order_by(order_by)
        return queryset

class StudentSectionViewSet(ReadOnlyModelViewSet):
    queryset = Section.objects.all()
    serializer_class = SectionSerializer

class StudentLectureViewSet(ReadOnlyModelViewSet):
    queryset = Lecture.objects.all()
    serializer_class = LectureSerializer

class StudentQuizViewSet(ReadOnlyModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer



# not requierd pagination >> for homepage 
class StudentCourseView(ListAPIView):
    serializer_class = CourseSerializer

    def get_queryset(self):
        queryset = Course.objects.all()
        data = self.request.data
        return queryset