"""
Course-completion summary.

One read, assembled from records the platform already holds: no new model, no
migration. It answers "did this student finish this course, and what did that
look like" for the completion screen at the end of the learning flow.

Lives in its own package for the same reason `course/publishing/` and
`enrollment/earnings/` do — the rules below are product rules, not view logic,
and they are worth testing directly.
"""

from decimal import Decimal

from django.db.models import Max, Sum

from apps.course.models import Lecture, Quiz
from apps.reviews.models import Review

from ..models import LectureProgress, QuizAttempt


def build_course_completion(user_profile, course):
    """
    Return the completion summary for one student on one course.

    The caller has already established that the student is enrolled; this
    function neither checks nor enforces access.
    """
    lecture_ids = list(
        Lecture.objects.filter(section__course=course).values_list('id', flat=True)
    )
    quiz_ids = list(
        Quiz.objects.filter(section__course=course).values_list('id', flat=True)
    )

    completed_lectures = LectureProgress.objects.filter(
        user=user_profile,
        is_completed=True,
        lecture_id__in=lecture_ids,
    )
    lecture_totals = completed_lectures.aggregate(
        minutes=Sum('lecture__duration'),
        last_at=Max('completed_at'),
    )
    lectures_completed = completed_lectures.count()
    total_minutes = lecture_totals['minutes'] or Decimal('0')
    last_lecture_at = lecture_totals['last_at']

    attempts = QuizAttempt.objects.filter(user=user_profile, quiz_id__in=quiz_ids)
    passed_quiz_ids = set(
        attempts.filter(passed=True).values_list('quiz_id', flat=True)
    )
    last_quiz_at = attempts.filter(passed=True).aggregate(last=Max('attempted_at'))['last']

    # The best attempt per quiz, averaged over the quizzes this student has
    # actually sat. A passed quiz cannot be retaken, so on a completed course
    # the best attempt is always the passing one — a failed first try never
    # drags down the figure for a quiz the student went on to pass.
    best_per_quiz = [
        row['best']
        for row in attempts.values('quiz_id').annotate(best=Max('score'))
    ]
    quiz_average = (
        round(float(sum(best_per_quiz) / len(best_per_quiz)), 1)
        if best_per_quiz
        else None
    )

    # An empty course cannot be completed: there is nothing to have done.
    # A course with no quizzes is completed on its lectures alone.
    is_completed = (
        bool(lecture_ids)
        and lectures_completed == len(lecture_ids)
        and len(passed_quiz_ids) == len(quiz_ids)
    )

    return {
        'course': course,
        'is_completed': is_completed,
        'lectures_completed': lectures_completed,
        'total_lectures': len(lecture_ids),
        'quizzes_passed': len(passed_quiz_ids),
        'total_quizzes': len(quiz_ids),
        'total_minutes': int(round(total_minutes)),
        'quiz_average': quiz_average,
        # Only meaningful once the course is actually finished: the moment the
        # last requirement was met, whichever kind it was.
        'completed_at': (
            max(filter(None, [last_lecture_at, last_quiz_at]), default=None)
            if is_completed
            else None
        ),
        'has_reviewed': Review.objects.filter(user=user_profile, course=course).exists(),
    }
