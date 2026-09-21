"""010 — Instructor student roster: the progress figure for one page of enrolments.

Progress is computed **after** pagination, not in the queryset, and that is the whole
design. Nothing in this feature sorts or filters by progress — the order is fixed
(`-enrolled_at, -id`) and search matches names only — so progress never needs to exist in
SQL. Two consequences:

- the naive version (a `SerializerMethodField` counting per row: ~40 queries a page) is
  unnecessary, and
- the clever one (correlated `Subquery` annotations over the filtered set) is unnecessary
  too.

What is left is two flat, grouped queries over the ids that are actually on screen.

Total cost of a roster request, flat in the number of rows:

- **aggregate scope: 4** — DRF's `COUNT(*)`, the page, and these two.
- **course scope: 5** — the same four, plus resolving `?course=` against the caller's own
  courses. That one is the ownership check (FR-032) and cannot be folded into the main
  queryset: an owned course with no students must stay distinguishable from a course the
  caller does not own, and an empty result cannot tell those apart.

`RosterPerformanceTests` pins both numbers.

See specs/010-instructor-students/research.md R7, R8.
"""
from django.db.models import Count

from apps.course.models import Lecture
from apps.progress.models import LectureProgress


def build_progress_map(enrollments):
    """Map `(user_id, course_id) -> percent | None` for one page of enrolments.

    `enrollments` is the list DRF's paginator returned, so the two queries below are
    bounded by the page: at most 20 courses and 20 students.

    A value is `None` when the course currently has no lectures. That is deliberately not
    `0.0`: a course nobody can progress through yet is not a course nobody has progressed
    through, and SC-007 forbids showing 0% where there is no denominator. The client
    renders `None` as an em dash.
    """
    if not enrollments:
        # Neither query is worth issuing for an empty page.
        return {}

    course_ids = {enrollment.course_id for enrollment in enrollments}
    user_ids = {enrollment.user_id for enrollment in enrollments}

    # Denominator: how many lectures each course currently has. "Currently" matters — a
    # lecture deleted after a student completed it leaves both this count and the
    # numerator below, so progress can never exceed 100%.
    totals = dict(
        Lecture.objects
        .filter(section__course_id__in=course_ids)
        .values_list('section__course_id')
        .annotate(total=Count('id'))
    )

    # Numerator: completions per (student, course).
    #
    # `user__user_id`, not `user_id`. Enrollment.user is a CustomUser, but
    # LectureProgress.user is a StudentProfile, so the join has to cross the profile to
    # get back to the user. Written as `user_id__in=<CustomUser ids>` this query matches
    # nothing at all and every row silently reads 0% — it does not raise.
    #
    # `is_completed=True` is required: LectureProgress rows exist in the unfinished state
    # (the field defaults to False). The student-facing code filters the same way, in
    # apps/progress/views.py.
    completed_rows = (
        LectureProgress.objects
        .filter(
            user__user_id__in=user_ids,
            lecture__section__course_id__in=course_ids,
            is_completed=True,
        )
        .values('user__user_id', 'lecture__section__course_id')
        .annotate(done=Count('id'))
    )
    # The filter above is a cross-product of the page's students and courses, so it can
    # return pairs that aren't on this page (at most 20 x 20). Keying by the exact pair
    # means those extras are simply never looked up.
    completed = {
        (row['user__user_id'], row['lecture__section__course_id']): row['done']
        for row in completed_rows
    }

    progress = {}
    for enrollment in enrollments:
        pair = (enrollment.user_id, enrollment.course_id)
        total = totals.get(enrollment.course_id, 0)
        if total == 0:
            progress[pair] = None
            continue
        done = completed.get(pair, 0)
        # Percent to one decimal, matching get_student_sorted_courses in
        # apps/progress/utils.py exactly, so the instructor reads the same number the
        # student sees for the same course (FR-010). ProgressAgreementTests pins this.
        progress[pair] = round(done / total * 100, 1)

    return progress
