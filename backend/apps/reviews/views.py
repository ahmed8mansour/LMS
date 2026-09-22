import logging

from rest_framework.response import Response
from rest_framework import status, mixins, viewsets
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import get_object_or_404 , ListAPIView
from django.db import transaction

from apps.authentication.utils import CookieJWTAuthentication
from apps.authentication.models import StudentProfile , InstructorProfile
from apps.course.models import Course
from apps.enrollment.models import Enrollment
from apps.course.permissions import isAdmin, isInstructor

from .models import Review
from .serializers import ReviewSerializer, ReviewableCourseSerializer , PublicReviewSerializer , InstructorReviewSerializer
from .utils import RatingComputing, StudentCoursesRating, build_instructor_review_stats
from .pagination import ReviewPageNumberPagination , InstructorReviewsPagination

logger = logging.getLogger(__name__)

class StudentReviewViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def get_queryset(self):
        student_profile = get_object_or_404(StudentProfile, user=self.request.user)
        return Review.objects.filter(user=student_profile).select_related('course')

    def perform_update(self, serializer):
        instance = serializer.save()
        RatingComputing(instance.course).update_course_rating()

    def perform_destroy(self, instance):
        course = instance.course
        instance.delete()
        RatingComputing(course).update_course_rating()

    def create(self, request, *args, **kwargs):
        course_id = request.data.get('course_id')
        if not course_id:
            return Response({"course_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        course = get_object_or_404(Course, pk=course_id)

        try:
            student_profile = StudentProfile.objects.get(user=request.user)
        except StudentProfile.DoesNotExist:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        if not Enrollment.objects.filter(user=request.user, course=course, is_active=True).exists():
            return Response({"error": "You are not enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)

        if not StudentCoursesRating(student_profile, course).has_completed_course():
            return Response({"error": "Finish the course before reviewing it."}, status=status.HTTP_403_FORBIDDEN)

        if hasattr(request.user, 'instructor_profile') and course.instructor_id == request.user.instructor_profile.id:
            return Response({"error": "You cannot review your own course."}, status=status.HTTP_403_FORBIDDEN)

        existing_review = Review.objects.filter(user=student_profile, course=course).first()
        if existing_review:
            return Response(
                {"error": "You already reviewed this course.", "review_id": existing_review.id},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            serializer.save(user=student_profile, course=course)
            RatingComputing(course).update_course_rating()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ReviewableCoursesView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            student_profile = StudentProfile.objects.get(user=request.user)
        except StudentProfile.DoesNotExist:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        enrolled_course_ids = Enrollment.objects.filter(
            user=request.user, is_active=True
        ).values_list('course_id', flat=True)

        reviewed_course_ids = Review.objects.filter(
            user=student_profile
        ).values_list('course_id', flat=True)

        candidate_courses = Course.objects.filter(
            id__in=list(enrolled_course_ids)
        ).exclude(id__in=list(reviewed_course_ids)).select_related('instructor__user')

        reviewable = [
            course for course in candidate_courses
            if StudentCoursesRating(student_profile, course).has_completed_course()
        ]

        serializer = ReviewableCourseSerializer(reviewable, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class CourseReviewsView(ListAPIView):
    pagination_class = ReviewPageNumberPagination
    serializer_class = PublicReviewSerializer

    # no need to add the average
    # because already this data will be read from the course data (rating , reviews_count)

    def get_queryset(self):
        course_id = self.kwargs['course_id']
        course = get_object_or_404(Course, id=course_id)
        return Review.objects.filter(course=course)


class AdminReviewDeleteView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isAdmin]

    def delete(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        course = review.course
        review.delete()
        RatingComputing(course).update_course_rating()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstructorReviewsView(ListAPIView):
    """The instructor reviews feed (spec 012).

    One endpoint, two scopes: with `?course=<id>` it is a single course's reviews (the
    workspace Reviews tab), without it every course the caller owns (the sidebar Reviews
    page). A ListAPIView, not a ReadOnlyModelViewSet — there is no `retrieve` (a single
    review has no page of its own), and this is the base class that gives
    PageNumberPagination for free.

    GET /reviews/instructor/reviews/?course=&rating=&page=
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated , isInstructor]
    # `throttle_scope`, NOT `throttle_classes`: the latter wants a list of throttle
    # CLASSES, and a string there makes DRF iterate the characters and try to call each
    # one ("'str' object is not callable" on every request).
    #
    # 60/min, matching the dashboard and analytics rather than the roster's 120: this
    # read is driven by filter chips and page arrows, not a debounced search box. A
    # ceiling against a runaway client loop, not a security boundary — ownership is the
    # boundary.
    throttle_scope = 'instructor_reviews'
    serializer_class= InstructorReviewSerializer
    pagination_class=InstructorReviewsPagination
    # No filter_backends: `?rating=` is parsed by hand below, because an unrecognised
    # value has to fall back silently rather than 400 (FR-027).
    filter_backends = []

    def _resolve_owned_course(self, raw):
        """`?course=` resolved against the caller's own courses, or None.

        Every failure mode returns None so that list() answers all of them with one
        identical 404: another instructor's course, a course that does not exist, and an
        unparseable id. A different response for any of them would turn this endpoint
        into a probe for which course ids exist (FR-038).

        The int() parse is the part that is easy to leave out. Without it, `?course=abc`
        reaches the ORM and raises ValueError -> 500, which is itself a distinguishing
        signal.

        This is the second copy of this method — `InstructorStudentsView` in
        apps/course/views.py has the first. Extracting a shared ownership mixin is
        research follow-up F1, deliberately deferred so this read-only feature does not
        edit 010's shipped view.
        """
        try:
            course_id = int(raw)
        except (TypeError, ValueError):
            return None
        if course_id < 1:
            return None
        return Course.objects.filter(instructor=self._profile, id=course_id).first()

    def _resolve_rating(self, raw):
        """`?rating=` as 5, 4, or None (no filter).

        Anything else is None: absent, 'all', 'abc', '0', and notably '3'. The page has
        exactly three chips, so honouring 3 would leave the UI in a state it cannot
        display or clear (FR-021, FR-027).

        Never 400. The address is the least trustworthy input on the page — a stale
        bookmark, a hand-edited URL — and FR-027 requires a silent fallback. The parse
        must also happen HERE rather than in the queryset: `filter(rating='abc')` raises
        ValueError -> 500.
        """
        if raw in ('5', '4'):
            return int(raw)
        return None

    def get_queryset(self):
        """The ownership-scoped queryset — and the one `stats` is computed from.

        Built from ownership OUTWARD, so scoping is a filter rather than a check someone
        can forget. A course id from the client never widens this — it can only narrow
        it, and only after list() has resolved it against the owned set.

        Deliberately does NOT apply the rating filter: `stats` describes the whole scope
        (FR-007). filter_queryset() below adds the filter for the list only.
        """
        queryset = Review.objects.filter(course__instructor=self._profile)
        if self._course is not None:
            queryset = queryset.filter(course=self._course)
        return queryset

    def filter_queryset(self, queryset):
        if self._rating is not None:
            queryset = queryset.filter(rating=self._rating)

        return (
            queryset
            # Keeps name, avatar and course title off the N+1 path. Two hops on the
            # reviewer: Review.user is a StudentProfile, the person is one further on.
            .select_related('user__user', 'course')
            # Mandatory, not optional. Review.Meta.ordering is ['-created_at'], so a
            # queryset that stays silent here is sorted by CREATION date — which
            # contradicts FR-020 and makes the displayed date disagree with the row's
            # position.
            #
            # The '-id' is not cosmetic either. updated_at is auto_now, and a bulk edit
            # or two simultaneous submissions write identical timestamps; with
            # '-updated_at' alone the order among tied rows is unspecified, so pages can
            # repeat AND skip reviews with no writes happening at all.
            .order_by('-updated_at', '-id')
        )

    def list(self, request, *args, **kwargs):
        try:
            self._profile = request.user.instructor_profile
        except InstructorProfile.DoesNotExist:
            # A staff account that passed isInstructor but has no profile. Refused
            # explicitly rather than served an empty page: an empty feed already means
            # "no reviews yet", and a broken account must not look like a new instructor
            # (FR-035, FR-040). Same shape as 009 and 010, so the client's existing
            # no-profile state handles it.
            return Response(
                {'error': 'No instructor profile is associated with this account.',
                 'code': 'no_instructor_profile'},
                status=status.HTTP_403_FORBIDDEN,
            )

        self._course = None
        raw_course = request.query_params.get('course')
        if raw_course is not None:
            self._course = self._resolve_owned_course(raw_course)
            if self._course is None:
                return Response(
                    {'error': 'Course not found.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        self._rating = self._resolve_rating(request.query_params.get('rating'))

        base = self.get_queryset()
        # From `base`, NOT from the filtered queryset. This is the single most
        # reversible mistake in the feature: computing stats after the rating filter
        # makes ?rating=5 report a 5.0 average and a 100% 5-star rate, which is exactly
        # what FR-007 and SC-004 forbid. The paginator reads this back in
        # get_paginated_response.
        self.paginator.stats = build_instructor_review_stats(base)

        # Outside the catch-all below on purpose: a NotFound raised here is a genuine
        # 404 and must not be reported as a server error.
        page = self.paginate_queryset(self.filter_queryset(base))

        try:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        except Exception:
            logger.exception('Instructor reviews failed for profile %s', self._profile.id)
            return Response(
                {'error': "We couldn't load the reviews. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )