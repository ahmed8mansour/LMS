"""
CourseAnalyticsService — one analytics snapshot for a list of courses (spec 009).

- The caller passes courses it has already scoped to the signed-in instructor
  (get_object() or the profile's own course list). This service never looks a course
  up by an id from the client (data-model I1).
- The query count is fixed no matter how many courses are passed: cohort, curriculum,
  lecture progress grouped per student per section, and quiz attempts grouped per
  student per quiz (research R6). Pinned by a test.
- Enrollment points at CustomUser, while LectureProgress / QuizAttempt point at
  StudentProfile; every grouped row is keyed through `user__user_id` so both sides
  share CustomUser.id with no per-student lookups.
- Nothing is serialized here. The view builds and serializes in one try, so a failure
  anywhere is a single error, never a partial snapshot (FR-020, FR-022).
"""
from collections import defaultdict
from datetime import timezone as dt_timezone
from typing import Literal, Sequence

from django.db.models import Count, Q
from django.utils import timezone

from apps.course.models import Course, Section
from apps.enrollment.models import Enrollment
from apps.progress.models import LectureProgress, QuizAttempt
from . import metrics
from .dto import AnalyticsSnapshot, CompletionStat, QuizPassStat
from .metrics import CourseShape, SectionShape, StudentCourseProgress
from .periods import Period, build_buckets, cohort_start, window_for

Scope = Literal['course', 'instructor']


class CourseAnalyticsService:

    def build(self, courses: Sequence[Course], period: Period, scope: Scope) -> AnalyticsSnapshot:
        today = timezone.now().date()
        course_ids = [course.id for course in courses]

        pairs, enrolled_dates = _cohort(course_ids, cohort_start(period, today))
        shapes = _curriculum(courses)
        progresses = _progress_by_pair(pairs, shapes)

        completed_by_course = defaultdict(int)
        total_by_course = defaultdict(int)
        for (_, course_id), progress in progresses.items():
            total_by_course[course_id] += 1
            if metrics.course_completed(shapes[course_id], progress):
                completed_by_course[course_id] += 1

        completed = sum(completed_by_course.values())
        total = len(pairs)
        passed, attempted = metrics.quiz_pair_counts(progresses.values())

        # Per course, one person holds at most one enrollment, so pairs == students.
        # Across courses, a student in several counts once (FR-018).
        active_students = total if scope == 'course' else len({user_id for user_id, _ in pairs})

        earliest = min(enrolled_dates) if enrolled_dates else None
        window = window_for(period, today, earliest)
        buckets = build_buckets(period, window, enrolled_dates)

        snapshot = dict(
            scope=scope,
            course=None,
            period=period,
            window=window,
            completion=CompletionStat(metrics.rate(completed, total), completed, total),
            quiz_pass=QuizPassStat(
                metrics.rate(passed, attempted), passed, attempted,
                has_quizzes=any(shape.quiz_ids for shape in shapes.values()),
            ),
            active_students=active_students,
            enrollments_over_time=tuple(buckets),
        )

        if scope == 'course':
            (course,) = courses
            shape = shapes[course.id]
            course_progresses = [p for (_, cid), p in progresses.items() if cid == course.id]
            snapshot.update(
                course={'id': course.id, 'title': course.title},
                section_drop_off=tuple(metrics.section_drop_off(shape, course_progresses)),
            )
        else:
            snapshot.update(
                course_drop_off=tuple(metrics.course_drop_off(
                    (shapes[cid], completed_by_course[cid], total_by_course[cid]) for cid in course_ids
                )),
                courses_count=len(courses),
            )

        return AnalyticsSnapshot(**snapshot)


def _cohort(course_ids, start):
    """Query 1: the (user_id, course_id) pairs with an active enrollment in the window."""
    enrollments = Enrollment.objects.filter(course_id__in=course_ids, is_active=True)
    if start is not None:
        enrollments = enrollments.filter(enrolled_at__gte=start)
    pairs = set()
    enrolled_dates = []
    for user_id, course_id, enrolled_at in enrollments.values_list('user_id', 'course_id', 'enrolled_at'):
        pairs.add((user_id, course_id))
        # Bucketed by UTC calendar date (FR-011a).
        enrolled_dates.append(enrolled_at.astimezone(dt_timezone.utc).date())
    return pairs, enrolled_dates


def _curriculum(courses) -> dict[int, CourseShape]:
    """Query 2: every current section of every course, with its lecture count and quiz."""
    sections_by_course = defaultdict(list)
    rows = (
        Section.objects
        .filter(course_id__in=[course.id for course in courses])
        .select_related('quiz')
        .annotate(lecture_count=Count('lectures'))
        .order_by('course_id', 'order')
    )
    for section in rows:
        quiz = getattr(section, 'quiz', None)
        sections_by_course[section.course_id].append(SectionShape(
            section_id=section.id,
            title=section.title,
            order=section.order,
            lecture_count=section.lecture_count,
            quiz_id=quiz.id if quiz is not None else None,
        ))
    # Courses with no sections still get a shape (they can never be completed).
    return {
        course.id: CourseShape(course.id, course.title, tuple(sections_by_course[course.id]))
        for course in courses
    }


def _progress_by_pair(pairs, shapes) -> dict[tuple[int, int], StudentCourseProgress]:
    """Queries 3 and 4, matched back to cohort pairs."""
    if not pairs:
        return {}

    course_ids = list(shapes)
    user_ids = list({user_id for user_id, _ in pairs})
    section_course = {s.section_id: c.course_id for c in shapes.values() for s in c.sections}
    quiz_course = {q: c.course_id for c in shapes.values() for q in c.quiz_ids}

    done = defaultdict(dict)
    # Grouped per student per section (not per lecture): rows stay bounded by
    # students × sections. unique_together (user, lecture) makes Count('id') exact.
    progress_rows = (
        LectureProgress.objects
        .filter(
            is_completed=True,
            lecture__section__course_id__in=course_ids,
            user__user_id__in=user_ids,
        )
        .values('user__user_id', 'lecture__section_id')
        .annotate(done=Count('id'))
    )
    for row in progress_rows:
        course_id = section_course.get(row['lecture__section_id'])
        done[(row['user__user_id'], course_id)][row['lecture__section_id']] = row['done']

    passed = defaultdict(set)
    attempted = defaultdict(set)
    # Grouped per (student, quiz): retakes collapse into one pair in the database (FR-009).
    quiz_rows = (
        QuizAttempt.objects
        .filter(quiz__section__course_id__in=course_ids, user__user_id__in=user_ids)
        .values('user__user_id', 'quiz_id')
        .annotate(passed=Count('id', filter=Q(passed=True)))
    )
    for row in quiz_rows:
        key = (row['user__user_id'], quiz_course.get(row['quiz_id']))
        attempted[key].add(row['quiz_id'])
        if row['passed']:
            passed[key].add(row['quiz_id'])

    # Only cohort pairs are kept: a student who enrolled in course A this month and
    # course B last year contributes A's progress to "Last 30 days", but not B's.
    return {
        pair: StudentCourseProgress(
            done_by_section=done.get(pair, {}),
            passed_quiz_ids=frozenset(passed.get(pair, ())),
            attempted_quiz_ids=frozenset(attempted.get(pair, ())),
        )
        for pair in pairs
    }
