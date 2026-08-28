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
from django.db import transaction
from .serializers import (
    CourseSerializer , SectionSerializer , QuizSerializer , LectureSerializer ,
    InstructorCourseSerializer , InstructorQuizSerializer , QuestionSerializer , ChoiceSerializer ,
    InstructorSectionSerializer , InstructorLectureSerializer
)
from .models import Course , Section , Quiz , Lecture , Question , Choice
from .reorder import reorder_within_parent

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

def _next_order(model, **parent_filter):
    #  الترتيب الجديد = آخر ترتيب + 1 (يتضاف في نهاية الأب)
    last = model.objects.filter(**parent_filter).order_by('-order').first()
    return (last.order + 1) if last else 0


class InstructorSectionViewSet(ModelViewSet):
    serializer_class = InstructorSectionSerializer
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
        order = serializer.validated_data.get('order')
        #  لو العميل ما بعتش order نحطه في النهاية تلقائيًا
        if order is None:
            serializer.save(order=_next_order(Section, course=course))
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        new_order = serializer.validated_data.get('order')
        #  لو الترتيب اتغير: نحفظ باقي الحقول عادي، وبعدين نعمل ترقيم آمن للـ order
        if new_order is not None and new_order != instance.order:
            serializer.validated_data.pop('order')
            serializer.save()
            reorder_within_parent(Section, {'course': instance.course}, instance, new_order)
        else:
            serializer.save()


class InstructorLectureViewSet(ModelViewSet):
    serializer_class = InstructorLectureSerializer
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
        order = serializer.validated_data.get('order')
        if order is None:
            serializer.save(order=_next_order(Lecture, section=section))
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = serializer.instance
        new_section = serializer.validated_data.get('section')
        #  نقل المحاضرة لسيكشن تاني خارج نطاق هذه الميزة
        if new_section is not None and new_section != instance.section:
            raise ValidationError(
                {"error": "Moving a lecture to another section isn't supported."}
            )
        new_order = serializer.validated_data.get('order')
        if new_order is not None and new_order != instance.order:
            serializer.validated_data.pop('order')
            serializer.save()
            reorder_within_parent(Lecture, {'section': instance.section}, instance, new_order)
        else:
            serializer.save()


class InstructorQuizViewSet(ModelViewSet):
    serializer_class = InstructorQuizSerializer
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
        #  سيكشن واحد = كويز واحد: نرجّع 400 واضحة بدل الـ 500
        if Quiz.objects.filter(section=section).exists():
            raise ValidationError({"error": "This section already has a quiz."})
        serializer.save(questions_count=0)


class InstructorQuestionViewSet(ModelViewSet):
    serializer_class = QuestionSerializer
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]

    def get_queryset(self):
        try:
            qs = Question.objects.filter(
                quiz__section__course__instructor=self.request.user.instructor_profile
            )
        except InstructorProfile.DoesNotExist:
            return Question.objects.none()
        #  فلترة أسئلة كويز معيّن للمحرّر
        quiz_id = self.request.query_params.get('quiz')
        if quiz_id:
            qs = qs.filter(quiz_id=quiz_id)
        return qs.order_by('order')

    def perform_create(self, serializer):
        quiz = serializer.validated_data.get('quiz')
        if quiz.section.course.instructor != self.request.user.instructor_profile:
            raise ValidationError({"error": "You don't have access to this quiz"})
        order = serializer.validated_data.get('order')
        if order is None:
            serializer.save(order=_next_order(Question, quiz=quiz))
        else:
            serializer.save()
        self._sync_count(quiz)

    def perform_update(self, serializer):
        instance = serializer.instance
        new_order = serializer.validated_data.get('order')
        #  ترتيب الأسئلة مافيهوش قيد فريد، بس نستخدم نفس الهيلبر للحفاظ على تسلسل بدون فجوات
        if new_order is not None and new_order != instance.order:
            serializer.validated_data.pop('order')
            serializer.save()
            reorder_within_parent(Question, {'quiz': instance.quiz}, instance, new_order)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        quiz = instance.quiz
        instance.delete()
        self._sync_count(quiz)

    def _sync_count(self, quiz):
        #  العدّاد يديره السيرفر: يُعاد حسابه بعد كل إضافة/حذف سؤال (FR-009a)
        Quiz.objects.filter(pk=quiz.pk).update(questions_count=quiz.question.count())


class InstructorChoiceViewSet(ModelViewSet):
    serializer_class = ChoiceSerializer
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]

    def get_queryset(self):
        try:
            qs = Choice.objects.filter(
                question__quiz__section__course__instructor=self.request.user.instructor_profile
            )
        except InstructorProfile.DoesNotExist:
            return Choice.objects.none()
        question_id = self.request.query_params.get('question')
        if question_id:
            qs = qs.filter(question_id=question_id)
        return qs

    def perform_create(self, serializer):
        question = serializer.validated_data.get('question')
        if question.quiz.section.course.instructor != self.request.user.instructor_profile:
            raise ValidationError({"error": "You don't have access to this question"})
        with transaction.atomic():
            choice = serializer.save()
            self._enforce_single_correct(choice)

    def perform_update(self, serializer):
        with transaction.atomic():
            choice = serializer.save()
            self._enforce_single_correct(choice)

    def _enforce_single_correct(self, choice):
        #  إجابة صحيحة واحدة لكل سؤال: تعليم واحدة صح يلغي أي واحدة كانت صح قبلها
        if choice.is_correct:
            Choice.objects.filter(question=choice.question).exclude(pk=choice.pk).update(
                is_correct=False
            )



class StudentCourseViewSet(ReadOnlyModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'instructor__title', 'instructor__user__first_name']
    pagination_class = CourseCursorPagination
    authentication_classes = [CookieJWTAuthentication]

    def get_queryset(self):
        #  الطلاب يشوفوا الكورسات المنشورة فقط — المسودّات مخفية تمامًا (FR-018)
        queryset = Course.objects.filter(is_published=True)
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
    #  محتوى الكورسات المنشورة فقط — لا تسريب لمناهج المسودّات (FR-018)
    serializer_class = SectionSerializer

    def get_queryset(self):
        return Section.objects.filter(course__is_published=True)

class StudentLectureViewSet(ReadOnlyModelViewSet):
    serializer_class = LectureSerializer

    def get_queryset(self):
        return Lecture.objects.filter(section__course__is_published=True)

class StudentQuizViewSet(ReadOnlyModelViewSet):
    serializer_class = QuizSerializer

    def get_queryset(self):
        return Quiz.objects.filter(section__course__is_published=True)



# not requierd pagination >> for homepage
class StudentCourseView(ListAPIView):
    serializer_class = CourseSerializer

    def get_queryset(self):
        #  الهوم بيج كمان: كورسات منشورة فقط (FR-018)
        queryset = Course.objects.filter(is_published=True)
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