from apps.course.models import Course , Lecture
from apps.authentication.models import StudentProfile, InstructorProfile
from apps.progress.models import LectureProgress
from .models import Review
from django.db.models import Avg, Count , Q
from django.db import transaction
from django.db.models import QuerySet
from datetime import timezone as dt_timezone
from django.utils import timezone

class RatingComputing:

    def __init__(self , course : Course):
        self.course = course

    def __recalculate_course_rating(self) -> dict:
        reviews_stats = Review.objects.filter(course = self.course).aggregate(avg_rating=Avg('rating') , reviews_count=Count('id'))
        return reviews_stats
    
    def update_course_rating(self) :
        reviews_stats = self.__recalculate_course_rating()
        avg_rating , reviews_count = reviews_stats.values()

        with transaction.atomic():
            self.course.rating = round(avg_rating , 1) if avg_rating is not None else 0.0
            self.course.reviews_count = reviews_count
            self.course.save(update_fields=["reviews_count" , "rating"])

class StudentCoursesRating:
    def __init__(self , student_profile : StudentProfile , course : Course):
        self.student_profile = student_profile
        self.course = course

    def has_completed_course(self) -> bool :
        total = Lecture.objects.filter(section__course = self.course).aggregate(total_lectures= Count('id'))
        total_lectures = total['total_lectures']

        completed = LectureProgress.objects.filter(user=self.student_profile ,is_completed=True , lecture__section__course = self.course ).aggregate(completed_lectures= Count('id'))
        completed_lectures = completed['completed_lectures']

        if total_lectures > 0:
            return total_lectures == completed_lectures
        else :
            return False


def get_instructor_rating(instructor: InstructorProfile) -> dict:
    stats = Review.objects.filter(
        course__instructor=instructor,
        course__is_published=True,
    ).aggregate(avg_rating=Avg('rating'), reviews_count=Count('id'))

    avg = stats['avg_rating']
    return {
        'avg_rating': round(avg, 1) if avg is not None else None,
        'reviews_count': stats['reviews_count'],
    }

def build_instructor_review_stats(queryset:QuerySet[Review]) -> dict:
    """The four summary figures of the instructor reviews feed (spec 012).

    Takes a QUERYSET, not an instructor, on purpose: the caller has already applied
    ownership and any ?course= narrowing, so this function never re-derives scope and
    cannot widen it by accident. The flip side is that it trusts its input completely —
    handed an unscoped Review.objects.all() it returns platform-wide stats.

    The queryset must NOT carry the rating filter. These figures describe the whole
    scope and must not move when the instructor picks a chip (FR-007), which is why the
    view computes them from get_queryset() and paginates filter_queryset() separately.

    Deliberately different from get_instructor_rating above: that one counts PUBLISHED
    courses only (it backs the public profile and 008's dashboard tile), this one counts
    every owned course. An instructor who unpublishes a reviewed course will see the two
    averages disagree, and that is expected — research follow-up F3.
    """
    # UTC, not settings.TIME_ZONE: FR-011 names UTC so two instructors in different zones
    # reading the same feed see the same number.
    month_start = timezone.now().astimezone(dt_timezone.utc).replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    # One query, not four. `filter=` compiles to Postgres COUNT(*) FILTER (WHERE ...),
    # so all four figures arrive in a single pass over the scope.
    stats = queryset.aggregate(
        avg_rating = Avg('rating'),
        total_reviews=Count('id'),
        five_star_count=Count('id' , filter=Q(rating=5)),
        # created_at, NOT updated_at. The feed is ORDERED by updated_at, so both fields
        # are in play here and picking the wrong one is silent: the count is simply
        # wrong and nothing raises. A review written last month and edited today is not
        # a review from this month.
        this_month_count=Count('id' , filter=Q(created_at__gte= month_start)),
    )

    avg = stats['avg_rating']
    # One decimal (FR-008), and None — never 0.0 — for an empty scope, so the client can
    # tell "no reviews yet" from "rated zero" (FR-012). The guard is required: round()
    # raises TypeError on None.
    stats['avg_rating'] = round(avg, 1) if avg is not None else None
    return stats