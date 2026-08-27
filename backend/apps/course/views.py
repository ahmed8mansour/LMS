from django.shortcuts import render
from django.http import HttpResponse
from rest_framework.response import Response
from datetime import datetime, timedelta
from dataclasses import asdict
import logging
from rest_framework import serializers

from rest_framework import mixins, permissions , generics
from rest_framework.views import APIView

from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework import status

from django.conf import settings
from .serializers import CourseSerializer , SectionSerializer , QuizSerializer , LectureSerializer , InstructorCourseSerializer
from .models import Course , Section , Quiz , Lecture

from rest_framework.viewsets import ModelViewSet , ReadOnlyModelViewSet

from .permissions import isAdmin , isInstructor
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.authentication.utils import CookieJWTAuthentication
from apps.authentication.models import InstructorProfile

from rest_framework.serializers import ValidationError
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework import filters
from .pagination import CourseCursorPagination

from rest_framework.generics import ListAPIView
from apps.enrollment.models import Enrollment
from .video.service import VideoUploadService, VideoWebhookService
# Create your views here.

logger = logging.getLogger(__name__)


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
    serializer_class = InstructorCourseSerializer
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
    # الحقول اللي بيديرها السيرفر (read-only) لازم ندي لها قيم افتراضية عند الإنشاء
    # لأن الموديل مفيهاش default → من غير كده الـ create هيكسر بـ IntegrityError
    def perform_create(self, serializer):
        try:
            serializer.save(
                instructor=self.request.user.instructor_profile,
                rating=0,
                subscribers_count=0,
                reviews_count=0,
                is_published=False,
            )
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
            raise ValidationError({"error": "You don't have access to this section"})
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
            raise ValidationError({"error": "You don't have access to this section"})
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
            raise ValidationError({"error": "You don't have access to this section"})
        serializer.save()



class StudentCourseViewSet(ReadOnlyModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'instructor__title', 'instructor__user__first_name']
    pagination_class = CourseCursorPagination
    authentication_classes = [CookieJWTAuthentication]

    def get_queryset(self):
        queryset = Course.objects.all()
        categories = self.request.query_params.getlist('category')
        level = self.request.query_params.get('level')
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        rating = self.request.query_params.get('rating')

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

        return queryset

    def get_enrolled_course_ids(self, user, course_ids):
        """Get set of course IDs where user is enrolled"""
        if not user.is_authenticated:
            return set()
        enrolled = Enrollment.objects.filter(
            user=user,
            course_id__in=course_ids,
            is_active=True
        ).values_list('course_id', flat=True)
        return set(enrolled)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        if request.user.is_authenticated:
            course_ids = [item['id'] for item in response.data['results']]
            enrolled_ids = self.get_enrolled_course_ids(request.user, course_ids)

            for item in response.data['results']:
                item['enrolled_status'] = item['id'] in enrolled_ids

        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)

        if request.user.is_authenticated:
            enrollment = Enrollment.objects.filter(
                user=request.user,
                course_id=kwargs['pk'],
                is_active=True
            ).exists()
            response.data['enrolled_status'] = enrollment
        else:
            response.data['enrolled_status'] = False

        return response

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
        return queryset

    def get_enrolled_course_ids(self, user, course_ids):
        """Get set of course IDs where user is enrolled"""
        if not user.is_authenticated:
            return set()
        enrolled = Enrollment.objects.filter(
            user=user,
            course_id__in=course_ids,
            is_active=True
        ).values_list('course_id', flat=True)
        return set(enrolled)

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)

        if request.user.is_authenticated:
            course_ids = [item['id'] for item in response.data['results']]
            enrolled_ids = self.get_enrolled_course_ids(request.user, course_ids)

            for item in response.data['results']:
                item['enrolled_status'] = item['id'] in enrolled_ids

        return response


class VideoUploadSignatureView(APIView):
    """
    POST /courses/video/upload-signature/

    Returns signed Cloudinary upload params so the browser can upload
    directly to Cloudinary (chunked), never through this server.

    body: { "lecture_id": <int> }  -> binds the upload to that lecture: the
           generated public_id is saved on the lecture up front, so the
           completion webhook always finds the row (no upload/webhook race).
    body: {}                       -> generic upload, not bound to a lecture.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, (isInstructor | isAdmin)]

    def post(self, request):
        lecture = None
        lecture_id = request.data.get('lecture_id')
        if lecture_id is not None:
            lecture = self._get_owned_lecture(request, lecture_id)

        credentials = VideoUploadService().credentials_for(lecture)
        return Response(asdict(credentials), status=status.HTTP_200_OK)

    def _get_owned_lecture(self, request, lecture_id):
        lecture = (
            Lecture.objects
            .select_related('section__course__instructor')
            .filter(id=lecture_id)
            .first()
        )
        if not lecture:
            raise NotFound("Lecture not found")
        if not request.user.is_superuser and lecture.section.course.instructor.user_id != request.user.id:
            raise PermissionDenied("You don't have access to this lecture")
        return lecture


class VideoWebhookView(APIView):
    """
    POST /courses/video/webhook/

    Called by Cloudinary (not the frontend) when eager HLS transcoding
    finishes. Verified via Cloudinary's signature headers, not JWT auth.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        signature = request.headers.get('X-Cld-Signature', '')
        timestamp = request.headers.get('X-Cld-Timestamp', '')

        success = VideoWebhookService().handle(request.body, signature, timestamp)
        if not success:
            logger.error("Rejected video webhook: invalid signature")
            return Response({'error': 'Invalid webhook signature'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'message': 'ok'}, status=status.HTTP_200_OK)