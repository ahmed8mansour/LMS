"""
InstructorDashboardService — builds one instructor's dashboard snapshot (spec 008).

The snapshot is read-only and computed on every request (research R5, R6):

- The service takes only the caller's InstructorProfile and never an id from the
  client, so every query below is scoped to that profile (data-model §7, I1).
- The query count doesn't grow with the number of courses: one course query that
  reuses 007's READINESS_PREFETCH, then aggregates and LIMIT 5 reads (I8).
- Every section is built before anything is serialized, so a failure anywhere
  surfaces as one error in the view, never a partial snapshot (FR-028).
"""
from decimal import Decimal

from django.db.models import Count, Q, Sum

from apps.authentication.models import CustomUser, InstructorProfile
from apps.course.models import Course
from apps.course.publishing import READINESS_PREFETCH, PublishReadinessService
from apps.enrollment.models import Enrollment, Order
from apps.reviews.models import Review
from apps.reviews.utils import get_instructor_rating
from .attention import MAX_ITEMS, classify, rank
from .dto import (
    CourseCounts,
    CourseRef,
    DashboardSnapshot,
    Earnings,
    NeedsAttention,
    OnboardingProgress,
    PersonRef,
    Rating,
    RecentEnrollment,
    RecentReview,
    StudentCounts,
)

RECENT_LIMIT = 5


class InstructorDashboardService:

    def build(self, profile: InstructorProfile) -> DashboardSnapshot:
        courses = _load_courses(profile)
        return DashboardSnapshot(
            mode='onboarding' if not courses else 'full',
            instructor_name=person_name(profile.user),
            courses=self._course_counts(courses),
            students=self._student_counts(profile),
            rating=self._rating(profile),
            earnings=self._earnings(profile),
            recent_enrollments=self._recent_enrollments(profile),
            recent_reviews=self._recent_reviews(profile),
            needs_attention=self._needs_attention(courses),
            onboarding=self._onboarding(profile, courses),
        )

    def _course_counts(self, courses: list[Course]) -> CourseCounts:
        # Derived from the already-loaded course list: no query.
        return CourseCounts(
            total=len(courses),
            published=sum(1 for course in courses if course.is_published),
        )

    def _student_counts(self, profile: InstructorProfile) -> StudentCounts:
        # Not InstructorProfile.students_count / Course.subscribers_count: those
        # denormalized counters are bumped once per enrollment, so they count
        # enrollments rather than people. FR-005 needs distinct people (research R5).
        # A refund deactivates the enrollment, so is_active excludes it.
        counts = Enrollment.objects.filter(
            course__instructor=profile,
            is_active=True,
        ).aggregate(
            distinct=Count('user', distinct=True),
            enrollments=Count('id'),
        )
        return StudentCounts(distinct=counts['distinct'], enrollments=counts['enrollments'])

    def _rating(self, profile: InstructorProfile) -> Rating:
        # Reuse the public-profile computation rather than copying it: that is what
        # guarantees the home tile and the public instructor rating never differ
        # (SC-003). It counts published courses only.
        stats = get_instructor_rating(profile)
        avg = stats['avg_rating']
        return Rating(
            avg_rating=None if avg is None else float(avg),
            reviews_count=stats['reviews_count'],
        )

    def _earnings(self, profile: InstructorProfile) -> Earnings:
        # Gross sales: paid orders only. Refunds flip the order to 'refunded', and
        # pending/failed orders never paid, so all three are excluded. Free
        # enrollments are paid orders of 0.00 (FR-007, research R6).
        total = Order.objects.filter(
            course__instructor=profile,
            status='paid',
        ).aggregate(total=Sum('amount'))['total']
        return Earnings(amount=total or Decimal('0'))

    def _needs_attention(self, courses: list[Course]) -> NeedsAttention:
        # evaluate() reads only the relations _load_courses prefetched, so this loop
        # adds no queries however many courses there are (research R5).
        readiness = PublishReadinessService()
        items = []
        for course in courses:
            item = classify(course, readiness.evaluate(course), course.active_students)
            if item is not None:
                items.append(item)
        ranked = rank(items)
        return NeedsAttention(total=len(ranked), items=tuple(ranked[:MAX_ITEMS]))

    def _recent_enrollments(self, profile: InstructorProfile) -> tuple[RecentEnrollment, ...]:
        # Active only: a refunded student is no longer enrolled (FR-009).
        enrollments = (
            Enrollment.objects
            .filter(course__instructor=profile, is_active=True)
            .select_related('user', 'course')
            .order_by('-enrolled_at', '-id')[:RECENT_LIMIT]
        )
        return tuple(
            RecentEnrollment(
                id=enrollment.id,
                enrolled_at=enrollment.enrolled_at,
                student=person_ref(enrollment.user),
                course=CourseRef(id=enrollment.course.id, title=enrollment.course.title),
            )
            for enrollment in enrollments
        )

    def _recent_reviews(self, profile: InstructorProfile) -> tuple[RecentReview, ...]:
        # Any of the instructor's courses, published or not — unlike the rating tile,
        # which matches the public profile. An instructor still wants to read feedback
        # on a course they've since unpublished (spec Assumptions).
        reviews = (
            Review.objects
            .filter(course__instructor=profile)
            .select_related('user__user', 'course')
            .order_by('-created_at', '-id')[:RECENT_LIMIT]
        )
        return tuple(
            RecentReview(
                id=item.id,
                rating=item.rating,
                comment=item.comment or '',
                created_at=item.created_at,
                reviewer=person_ref(item.user.user),
                course=CourseRef(id=item.course.id, title=item.course.title),
            )
            for item in reviews
        )

    def _onboarding(self, profile: InstructorProfile, courses: list[Course]) -> OnboardingProgress:
        # Read only through .all() on the relations _load_courses prefetched. A
        # .filter() or .exists() here would bypass the prefetch and add queries per
        # course. This is the one place that reads video_status directly: it tracks
        # progress ("have you uploaded anything yet?"), not publish readiness.
        sections = [section for course in courses for section in course.section_set.all()]
        lectures = [lecture for section in sections for lecture in section.lectures.all()]
        return OnboardingProgress(
            profile_complete=bool(profile.title.strip() and profile.about.strip()),
            has_course=bool(courses),
            has_curriculum=any(section.lectures.all() for section in sections),
            has_ready_video=any(lecture.video_status == 'COMPLETED' for lecture in lectures),
            has_published_course=any(course.is_published for course in courses),
        )


def _load_courses(profile: InstructorProfile) -> list[Course]:
    """
    Fetches all courses for a specific instructor, annotates each course
    with the count of its active students, and prefetches related data.
    """
    # Only ONE reverse-relation Count can go on this query: a second one (orders,
    # reviews) would join another table and multiply both counts. Students and
    # earnings are separate aggregate queries for that reason (research R5).
    courses_queryset = Course.objects.filter(
        instructor=profile
    ).annotate(
        active_students=Count(
            'enrollment',
            filter=Q(enrollment__is_active=True),
            distinct=True
        )
    ).prefetch_related(
        # Exactly the relations PublishReadinessService reads, so evaluating
        # readiness for every course adds no queries.
        *READINESS_PREFETCH
    ).order_by(
        '-created_at',
        '-id'
    )

    # Evaluate the queryset immediately into a Python list
    return list(courses_queryset)


def person_name(user: CustomUser) -> str:
    # Public, not _private: the roster (spec 010) imports this so a student's displayed
    # name is derived in exactly one place. If the fallback changes, both surfaces change
    # together (008 FR-012, 010 FR-007).
    return f"{user.first_name} {user.last_name}".strip() or user.username


def person_ref(user: CustomUser) -> PersonRef:
    # Never read user.email: the dashboard exposes no contact details (FR-012).
    return PersonRef(name=person_name(user), avatar=user.profile_picture or None)
