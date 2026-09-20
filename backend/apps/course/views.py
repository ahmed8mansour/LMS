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
from rest_framework.decorators import action
from rest_framework.throttling import ScopedRateThrottle

from .publishing import READINESS_PREFETCH, CoursePublishingService, PublishReadinessService
from .analytics import CourseAnalyticsService, InvalidPeriod, parse_period

from rest_framework.serializers import ValidationError
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework import filters
from .pagination import CourseCursorPagination

from rest_framework.generics import ListAPIView
from apps.enrollment.models import Enrollment
from .video.service import (
    VideoUploadService, VideoWebhookService, VideoLifecycleService, VideoAssetError,
)
from .dashboard import InstructorDashboardService
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
            # READINESS_PREFETCH covers exactly the relations PublishReadinessService
            # reads, so the is_publishable / needs_attention fields add no queries
            # per course on the list. Drop it and readiness alone becomes an N+1.
            # (research R5)
            return (
                Course.objects
                .filter(instructor=self.request.user.instructor_profile)
                .prefetch_related(*READINESS_PREFETCH)
            )
        except InstructorProfile.DoesNotExist:
            # Also what makes publishing safe for a staff account with no
            # profile: every @action resolves through here, so it gets a clean
            # 404 rather than an AttributeError (FR-029).
            return Course.objects.none()

    def get_throttles(self):
        # Publishing is a student-visible catalog change; the CRUD routes stay on
        # the project default. throttle_scope can't be passed via @action (it isn't
        # an APIView attribute, so DRF's initkwargs validation rejects it) and must
        # not be set at class level, which would throttle list/retrieve/create/
        # destroy too. Safe to assign on self: DRF builds a new view per request.
        # (research R10)
        if self.action in ('publish', 'unpublish'):
            self.throttle_scope = 'course_publish'
            return [ScopedRateThrottle()]
        if self.action == 'analytics':
            self.throttle_scope = 'instructor_analytics'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    # ---- Analytics (spec 009) -------------------------------------------------

    @action(detail=True, methods=['get'])
    def analytics(self, request, pk=None):
        # get_object() IS the ownership check: another instructor's course, a missing
        # course, and a caller without an instructor profile (empty queryset) all 404
        # here, identically, before any analytics code runs (FR-026).
        course = self.get_object()

        try:
            period = parse_period(request.query_params.get('days'))
        except InvalidPeriod:
            return Response(
                {'error': 'days must be one of 30, 90, all.', 'code': 'invalid_period'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build AND serialize inside one try: all-or-nothing, never a partial body (FR-022).
        try:
            data = CourseAnalyticsService().build([course], period, 'course').to_dict()
        except Exception:
            logger.exception('Course analytics failed for course %s', course.id)
            return Response(
                {'error': "We couldn't load analytics. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(data, status=status.HTTP_200_OK)

    # ---- Publishing (spec 007) ------------------------------------------------
    # Each action resolves the course through self.get_object(), i.e. inside
    # get_queryset(): another instructor's course is a 404 before any code here
    # runs (research R2). Keep these thin — every rule lives in publishing/.

    @action(detail=True, methods=['get'])
    def readiness(self, request, pk=None):
        # Read-only: computes the verdict from current content and writes nothing.
        # get_object() carries the queryset's prefetch, so this costs no queries
        # beyond the ones get_queryset() already makes.
        report = PublishReadinessService().evaluate(self.get_object())
        return Response(report.to_dict(), status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        course = self.get_object()
        try:
            result, report = CoursePublishingService().publish(course)
        except Course.DoesNotExist:
            # Deleted between get_object() and the row lock.
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)

        if result.refused:
            # Additive `blockers` beside the required `error` message (research R7).
            return Response(
                {'error': result.detail, 'blockers': [asdict(item) for item in result.blockers]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(_transition_payload(result, report), status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        # No refusal path: readiness is never a condition for unpublishing
        # (FR-016). Enrollments, orders, progress, and reviews are untouched — the
        # service writes is_published and nothing else (FR-031).
        course = self.get_object()
        try:
            result, report = CoursePublishingService().unpublish(course)
        except Course.DoesNotExist:
            return Response({'error': 'Course not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_transition_payload(result, report), status=status.HTTP_200_OK)

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

def _transition_payload(result, report):
    # One shape for both publish and unpublish: the fresh readiness report plus
    # what happened, so the client refreshes a single cache entry.
    return {**report.to_dict(), 'changed': result.changed, 'detail': result.detail}


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


def _get_owned_lecture(request, lecture_id):
    """Fetch a lecture and enforce that the requester owns its course."""
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


class VideoUploadSignatureView(APIView):
    """
    POST /courses/video/upload-signature/

    Returns signed Cloudinary upload params so the browser can upload the file
    directly to Cloudinary, never through this server.

    body: { "lecture_id": <int> }  -> required. Every signed upload is bound to a
           lecture the caller owns; there is no unbound mode, because minting
           uncapped upload credentials against our own storage for anyone past
           the instructor gate is a cost and abuse vector with no caller.

    The generated public_id is reserved on the lecture as *pending*. The
    lecture's live video, status, and duration are untouched — signing an upload
    is not a commitment to it, and an abandoned one must leave the lecture
    exactly as it was.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, (isInstructor | isAdmin)]
    throttle_scope = 'video_signature'

    def post(self, request):
        lecture_id = request.data.get('lecture_id')
        if lecture_id in (None, ''):
            return Response(
                {'error': 'lecture_id is required.'}, status=status.HTTP_400_BAD_REQUEST
            )

        lecture = _get_owned_lecture(request, lecture_id)
        credentials = VideoUploadService().credentials_for(lecture)
        return Response(asdict(credentials), status=status.HTTP_200_OK)


class VideoConfirmView(APIView):
    """
    POST /courses/video/<lecture_id>/confirm/

    Called once Cloudinary has accepted the upload. Promotes the pending asset
    to be the lecture's live video and moves it to PROCESSING, destroying the
    superseded asset only after the new one is in place.

    body: { "public_id": "<the id that was uploaded>" }

    Not required for correctness — the completion webhook performs the same
    promotion if this call never arrives. It exists so the instructor sees the
    lecture move to "processing" immediately instead of waiting on the transcode.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, (isInstructor | isAdmin)]
    throttle_scope = 'video_signature'

    def post(self, request, lecture_id):
        lecture = _get_owned_lecture(request, lecture_id)

        public_id = request.data.get('public_id')
        if not public_id:
            return Response(
                {'error': 'public_id is required.'}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            VideoLifecycleService().promote(lecture, public_id)
        except VideoAssetError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = LectureSerializer(lecture, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class VideoDeleteView(APIView):
    """
    DELETE /courses/video/<lecture_id>/

    Removes the lecture's video: destroys the live asset and any in-flight one,
    then resets the lecture to "no video". The lecture's own fields (title,
    order, duration) are left alone.

    Available from every status, PROCESSING included — refusing to remove a
    still-processing video is how an instructor ends up stranded with a stuck
    lecture and no way out.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, (isInstructor | isAdmin)]
    throttle_scope = 'video_signature'

    def delete(self, request, lecture_id):
        lecture = _get_owned_lecture(request, lecture_id)
        VideoLifecycleService().remove(lecture)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VideoWebhookView(APIView):
    """
    POST /courses/video/webhook/

    Called by Cloudinary (not the frontend) when eager HLS transcoding
    finishes. Verified via Cloudinary's signature headers, not JWT auth.

    A 200 means "handled, don't retry" — which covers duplicates, notifications
    that carry no transcode verdict, and notifications for assets we no longer
    track. Only a failed authenticity check is a 400.
    """
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = 'video_webhook'

    def post(self, request):
        signature = request.headers.get('X-Cld-Signature', '')
        timestamp = request.headers.get('X-Cld-Timestamp', '')

        success = VideoWebhookService().handle(request.body, signature, timestamp)
        if not success:
            logger.error("Rejected video webhook: invalid signature")
            return Response({'error': 'Invalid webhook signature'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'message': 'ok'}, status=status.HTTP_200_OK)



class InstructorDashboardView(APIView):
    # An APIView, not an @action on InstructorCourseViewSet: the dashboard spans all of
    # an instructor's courses, so there is no single owning row for get_object() to
    # scope. Ownership comes from the session's profile, which is the only input the
    # service accepts — this endpoint reads no ids (spec 008 research R2, R8).
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]
    # Class-level scope is correct here (unlike the viewset in 007): this view has one
    # action, and it is the heaviest instructor read (research R10).
    throttle_scope = 'instructor_dashboard'

    def get(self, request):
        try:
            profile = request.user.instructor_profile
        except InstructorProfile.DoesNotExist:
            # 403, not 401: the caller is authenticated. The additive `code` lets the
            # client show a handled state instead of a retryable error (FR-032).
            return Response(
                {'error': 'No instructor profile is associated with this account.', 'code': 'no_instructor_profile'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Build AND serialize inside one try: the snapshot is all-or-nothing, so a
        # failure in any section — readiness included — returns a single error and
        # never a partial response (FR-027, FR-028).
        try:
            data = InstructorDashboardService().build(profile).to_dict()
        except Exception:
            logger.exception('Instructor dashboard snapshot failed for profile %s', profile.id)
            return Response(
                {'error': "We couldn't load your dashboard. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(data, status=status.HTTP_200_OK)


class InstructorAnalyticsView(APIView):
    # An APIView, not an @action: the aggregate spans all of an instructor's courses,
    # so there is no single owning row for get_object() to scope. Ownership comes from
    # the session's profile; this endpoint reads no ids from the client (FR-025,
    # spec 009 research R1).
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isInstructor]
    throttle_scope = 'instructor_analytics'

    def get(self, request):
        try:
            profile = request.user.instructor_profile
        except InstructorProfile.DoesNotExist:
            return Response(
                {'error': 'No instructor profile is associated with this account.', 'code': 'no_instructor_profile'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            period = parse_period(request.query_params.get('days'))
        except InvalidPeriod:
            return Response(
                {'error': 'days must be one of 30, 90, all.', 'code': 'invalid_period'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # The only ownership filter: every later query is scoped to these course ids.
        courses = list(Course.objects.filter(instructor=profile).only('id', 'title'))

        try:
            data = CourseAnalyticsService().build(courses, period, 'instructor').to_dict()
        except Exception:
            logger.exception('Instructor analytics failed for profile %s', profile.id)
            return Response(
                {'error': "We couldn't load analytics. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(data, status=status.HTTP_200_OK)
