"""009 — Instructor analytics. Pure definition tests first, then API tests grouped by user story."""
import json
from datetime import date, datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser, InstructorProfile
from apps.course.analytics import AnalyticsSnapshot, InvalidPeriod, Period, parse_period
from apps.course.analytics.dto import CompletionStat, QuizPassStat
from apps.course.analytics.metrics import (
    CourseShape, SectionShape, StudentCourseProgress, course_completed, course_drop_off,
    quiz_pair_counts, rate, section_completed, section_drop_off, stuck_section,
)
from apps.course.analytics.periods import Bucket, Window, build_buckets, cohort_start, window_for
from apps.course.models import Lecture, Quiz, Section
from apps.course.tests import make_course, make_instructor
from apps.course.tests_dashboard import enroll, make_student
from apps.enrollment.models import Enrollment
from apps.progress.models import LectureProgress, QuizAttempt
from apps.progress.utils import is_section_unlocked


# --------------------------------------------------------------------------
# Fixtures (T004)
# --------------------------------------------------------------------------

# A Thursday. Bucket tests (90-day weeks, month edges) are written against this date.
FIXED_NOW = datetime(2026, 9, 17, 12, 0, tzinfo=dt_timezone.utc)
TODAY = FIXED_NOW.date()

COURSE_KEYS = {
    'scope', 'course', 'period', 'window', 'completion', 'quiz_pass',
    'active_students', 'enrollments_over_time', 'section_drop_off',
}
INSTRUCTOR_KEYS = {
    'scope', 'period', 'window', 'completion', 'quiz_pass', 'active_students',
    'courses_count', 'enrollments_over_time', 'course_drop_off',
}


def add_section(course, order, title=None, lectures=0, quiz=False):
    """A section with `lectures` lectures (order 1..n) and, optionally, a quiz."""
    section = Section.objects.create(course=course, title=title or f'Section {order}', order=order)
    for index in range(1, lectures + 1):
        Lecture.objects.create(
            section=section, title=f'Lecture {order}.{index}', duration=Decimal('5.00'), order=index,
        )
    if quiz:
        Quiz.objects.create(section=section, title=f'Quiz {order}', questions_count=1)
    return section


def complete_lectures(user, lectures):
    for lecture in lectures:
        LectureProgress.objects.create(user=user.student_profile, lecture=lecture, is_completed=True)


def attempt(user, quiz, passed):
    return QuizAttempt.objects.create(
        user=user.student_profile, quiz=quiz, score=Decimal('100') if passed else Decimal('0'), passed=passed,
    )


def set_enrolled_at(enrollment, dt):
    # enrolled_at is auto_now_add, which ignores a value passed to create(); update() bypasses it.
    Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_at=dt)


def enroll_at(student, course, days_ago=1, active=True):
    """Enroll `student` in `course`, dated `days_ago` days before FIXED_NOW."""
    enrollment = enroll(student, course, active=active)
    set_enrolled_at(enrollment, FIXED_NOW - timedelta(days=days_ago))
    return enrollment


def _all_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from _all_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _all_keys(child)


class AnalyticsTestCase(APITestCase):
    def setUp(self):
        super().setUp()
        # Fixtures that delete lectures or courses fire the video post_delete signal;
        # patch the provider so no test ever reaches Cloudinary.
        provider = MagicMock()
        for target in (
            'apps.course.serializers.get_video_provider',
            'apps.course.video.signals.get_video_provider',
            'apps.course.video.service.get_video_provider',
        ):
            patcher = patch(target, return_value=provider)
            patcher.start()
            self.addCleanup(patcher.stop)

        # Freeze "now" for the service so windows and buckets are deterministic.
        now_patcher = patch('apps.course.analytics.service.timezone.now', return_value=FIXED_NOW)
        now_patcher.start()
        self.addCleanup(now_patcher.stop)

    def course_url(self, course_id, days=None):
        url = reverse('instructor_courses-analytics', args=[course_id])
        return f'{url}?days={days}' if days is not None else url

    def instructor_url(self, days=None):
        url = reverse('instructor_analytics')
        return f'{url}?days={days}' if days is not None else url

    def get(self, user, url):
        self.client.force_authenticate(user=user)
        return self.client.get(url)


class SetupTests(SimpleTestCase):
    def test_fixed_now_is_a_thursday(self):
        # Later bucket tests assume this weekday (Monday == 0).
        self.assertEqual(FIXED_NOW.weekday(), 3)


# --------------------------------------------------------------------------
# Foundational — periods (T006)
# --------------------------------------------------------------------------

class PeriodUnitTests(SimpleTestCase):
    def assert_covers_window(self, buckets, window):
        self.assertEqual(buckets[0].start, window.start)
        self.assertEqual(buckets[-1].end, window.end)
        for previous, current in zip(buckets, buckets[1:]):
            self.assertEqual(current.start, previous.end + timedelta(days=1))
        for bucket in buckets:
            self.assertLessEqual(bucket.start, bucket.end)

    def test_parse_period(self):
        self.assertIs(parse_period(None), Period.THIRTY)
        self.assertIs(parse_period(''), Period.THIRTY)
        self.assertIs(parse_period('30'), Period.THIRTY)
        self.assertIs(parse_period('90'), Period.NINETY)
        self.assertIs(parse_period('all'), Period.ALL)
        for bad in ('7', '30d', 'ALL', ' 30'):
            with self.assertRaises(InvalidPeriod):
                parse_period(bad)

    def test_labels(self):
        self.assertEqual([p.label for p in Period], ['30d', '90d', 'all'])

    def test_windows(self):
        self.assertEqual(window_for(Period.THIRTY, TODAY, None), Window(date(2026, 8, 19), TODAY))
        self.assertEqual(window_for(Period.NINETY, TODAY, None), Window(date(2026, 6, 20), TODAY))
        self.assertEqual(window_for(Period.ALL, TODAY, date(2025, 11, 3)), Window(date(2025, 11, 3), TODAY))
        self.assertEqual(window_for(Period.ALL, TODAY, None), Window(None, TODAY))
        self.assertIsNone(cohort_start(Period.ALL, TODAY))
        self.assertEqual(cohort_start(Period.THIRTY, TODAY), datetime(2026, 8, 19, tzinfo=dt_timezone.utc))

    def test_thirty_day_buckets(self):
        window = window_for(Period.THIRTY, TODAY, None)
        buckets = build_buckets(Period.THIRTY, window, [date(2026, 9, 16)] * 3 + [date(2026, 8, 19)])
        self.assertEqual(len(buckets), 30)
        self.assertTrue(all(b.start == b.end for b in buckets))
        self.assert_covers_window(buckets, window)
        self.assertEqual(buckets[0].count, 1)
        self.assertEqual(buckets[-2], Bucket(date(2026, 9, 16), date(2026, 9, 16), 3))
        self.assertEqual(sum(b.count for b in buckets), 4)

    def test_ninety_day_weekly_buckets_are_clipped(self):
        window = window_for(Period.NINETY, TODAY, None)
        buckets = build_buckets(Period.NINETY, window, [date(2026, 6, 21), date(2026, 6, 22)])
        self.assertEqual(buckets[0], Bucket(date(2026, 6, 20), date(2026, 6, 21), 1))
        self.assertEqual(buckets[1].start, date(2026, 6, 22))
        self.assertEqual(buckets[1].count, 1)
        self.assertEqual((buckets[-1].start, buckets[-1].end), (date(2026, 9, 14), date(2026, 9, 17)))
        self.assertTrue(all(b.start.weekday() == 0 for b in buckets[1:]))
        self.assert_covers_window(buckets, window)

    def test_all_time_monthly_buckets_cross_a_year(self):
        window = window_for(Period.ALL, TODAY, date(2025, 11, 3))
        dates = [date(2025, 11, 3), date(2025, 12, 31), date(2026, 1, 1), date(2026, 9, 17)]
        buckets = build_buckets(Period.ALL, window, dates)
        self.assertEqual(buckets[0], Bucket(date(2025, 11, 3), date(2025, 11, 30), 1))
        self.assertEqual(buckets[1], Bucket(date(2025, 12, 1), date(2025, 12, 31), 1))
        self.assertEqual(buckets[2], Bucket(date(2026, 1, 1), date(2026, 1, 31), 1))
        self.assertEqual(buckets[-1], Bucket(date(2026, 9, 1), date(2026, 9, 17), 1))
        self.assertEqual(len(buckets), 11)
        self.assert_covers_window(buckets, window)

    def test_zero_buckets_and_out_of_window_dates(self):
        window = window_for(Period.THIRTY, TODAY, None)
        buckets = build_buckets(Period.THIRTY, window, [date(2026, 1, 1), date(2026, 9, 18)])
        self.assertEqual(sum(b.count for b in buckets), 0)
        self.assertEqual(len(buckets), 30)

    def test_no_enrollments_all_time_is_empty(self):
        self.assertEqual(build_buckets(Period.ALL, Window(None, TODAY), []), [])


# --------------------------------------------------------------------------
# Foundational — metric definitions (T008) and course drop-off (T028)
# --------------------------------------------------------------------------

def _shape(*sections, course_id=1, title='Course'):
    """sections: (lecture_count, has_quiz) tuples; ids/orders are 1-based positions, quiz ids 100 + i."""
    return CourseShape(course_id, title, tuple(
        SectionShape(section_id=i, title=f'S{i}', order=i, lecture_count=n, quiz_id=100 + i if quiz else None)
        for i, (n, quiz) in enumerate(sections, start=1)
    ))


def _progress(done=None, passed=(), attempted=None):
    passed = frozenset(passed)
    return StudentCourseProgress(
        done_by_section=done or {},
        passed_quiz_ids=passed,
        attempted_quiz_ids=frozenset(attempted) if attempted is not None else passed,
    )


class MetricsUnitTests(SimpleTestCase):
    def test_section_completed(self):
        quiz_section, lecture_section, empty = _shape((2, True), (2, False), (0, False)).sections
        self.assertFalse(section_completed(quiz_section, _progress(done={1: 2})))
        self.assertTrue(section_completed(quiz_section, _progress(passed={101})))
        self.assertFalse(section_completed(lecture_section, _progress(done={2: 1})))
        self.assertTrue(section_completed(lecture_section, _progress(done={2: 2})))
        self.assertFalse(section_completed(empty, _progress()))

    def test_course_completed_needs_lectures_and_quizzes(self):
        course = _shape((2, False), (1, True))
        self.assertTrue(course_completed(course, _progress(done={1: 2, 2: 1}, passed={102})))
        # Every lecture done, last quiz failed: not completed (clarification Q4).
        self.assertFalse(course_completed(course, _progress(done={1: 2, 2: 1}, attempted={102})))
        self.assertFalse(course_completed(course, _progress(done={1: 2}, passed={102})))
        self.assertFalse(course_completed(_shape((0, False)), _progress()))
        self.assertFalse(course_completed(_shape(), _progress()))

    def test_stuck_section_scenario_us1_5(self):
        course = _shape((1, False), (1, False), (1, False), (1, False))
        states = ({}, {1: 1}, {1: 1}, {1: 1, 2: 1, 3: 1})
        self.assertEqual([stuck_section(course, _progress(done=d)).order for d in states], [1, 2, 2, 4])
        drop = section_drop_off(course, [_progress(done=d) for d in states])
        self.assertEqual([d.count for d in drop], [1, 2, 0, 1])

    def test_stuck_section_uses_highest_completed(self):
        course = _shape((1, False), (1, False), (1, False))
        # Non-contiguous progress: section 3 done, section 2 not.
        self.assertEqual(stuck_section(course, _progress(done={1: 1, 3: 1})).order, 2)
        self.assertEqual(stuck_section(course, _progress(done={3: 1})).order, 1)

    def test_stuck_section_fallback_to_first_open_work(self):
        # Every quiz passed, but a lecture was added to section 2 afterwards.
        course = _shape((1, True), (2, True))
        progress = _progress(done={1: 1, 2: 1}, passed={101, 102})
        self.assertFalse(course_completed(course, progress))
        self.assertEqual(stuck_section(course, progress).order, 2)

    def test_completed_course_has_no_stuck_section(self):
        course = _shape((1, True))
        finished = _progress(done={1: 1}, passed={101})
        self.assertIsNone(stuck_section(course, finished))
        self.assertEqual(section_drop_off(course, [finished])[0].count, 0)

    def test_quiz_pairs_collapse_retakes(self):
        # fail, fail, pass → one attempted pair, passed.
        self.assertEqual(quiz_pair_counts([_progress(passed={101}, attempted={101})]), (1, 1))
        self.assertEqual(quiz_pair_counts([_progress(attempted={101})]), (0, 1))
        # A quiz nobody attempted is not in the denominator.
        self.assertEqual(quiz_pair_counts([_progress()]), (0, 0))

    def test_rate(self):
        self.assertIsNone(rate(0, 0))
        self.assertEqual(rate(71, 100), 0.71)
        self.assertEqual(rate(1, 3), 0.3333)

    def test_course_drop_off_order_us3_3(self):
        x, y, z = _shape(course_id=1, title='X'), _shape(course_id=2, title='Y'), _shape(course_id=3, title='Z')
        bars = course_drop_off([(x, 5, 20), (y, 8, 10), (z, 25, 50)])
        self.assertEqual([(b.title, b.drop_off_rate) for b in bars], [('X', 0.75), ('Z', 0.5), ('Y', 0.2)])
        self.assertEqual((bars[0].not_completed, bars[0].total), (15, 20))

    def test_course_drop_off_ties_and_exclusions(self):
        bars = course_drop_off([
            (_shape(course_id=4, title='Alpha'), 1, 2),
            (_shape(course_id=2, title='Beta'), 2, 4),
            (_shape(course_id=1, title='Beta'), 2, 4),
            (_shape(course_id=3, title='Gamma'), 5, 10),
            (_shape(course_id=9, title='Empty'), 0, 0),
            (_shape(course_id=8, title='Done'), 3, 3),
        ])
        # All four at 0.5: more not-completed first (Gamma 5), then title, then id.
        # Empty is excluded; a fully completed course still gets a 0% bar.
        self.assertEqual([b.course_id for b in bars], [3, 1, 2, 4, 8])
        self.assertEqual(bars[-1].drop_off_rate, 0.0)


class DtoShapeTests(SimpleTestCase):
    def _snapshot(self, scope):
        return AnalyticsSnapshot(
            scope=scope, course={'id': 1, 'title': 'C'} if scope == 'course' else None,
            period=Period.THIRTY, window=Window(date(2026, 8, 19), TODAY),
            completion=CompletionStat(None, 0, 0), quiz_pass=QuizPassStat(None, 0, 0, False),
            active_students=0, enrollments_over_time=(),
            section_drop_off=() if scope == 'course' else None,
            course_drop_off=() if scope == 'instructor' else None,
            courses_count=0 if scope == 'instructor' else None,
        )

    def test_key_sets_per_scope(self):
        self.assertEqual(set(self._snapshot('course').to_dict()), COURSE_KEYS)
        self.assertEqual(set(self._snapshot('instructor').to_dict()), INSTRUCTOR_KEYS)
        self.assertEqual(self._snapshot('course').to_dict()['window'], {'start': '2026-08-19', 'end': '2026-09-17'})


class SectionUnlockAgreementTests(AnalyticsTestCase):
    """section_completed must agree with the student-side unlock rule (research R6)."""

    def test_agrees_with_is_section_unlocked(self):
        _, profile = make_instructor('agree@test.com', 'agree')
        course = make_course(profile)
        first = add_section(course, 1, lectures=2, quiz=True)
        second = add_section(course, 2, lectures=2)
        third = add_section(course, 3, lectures=1)
        student = make_student('agree_s@test.com', 'agree_s')
        sp = student.student_profile
        sections = [first, second, third]

        def shape_of(section):
            quiz = Quiz.objects.filter(section=section).first()
            return SectionShape(section.id, section.title, section.order, section.lectures.count(),
                                quiz.id if quiz else None)

        def progress():
            done = {
                s.id: LectureProgress.objects.filter(user=sp, lecture__section=s, is_completed=True).count()
                for s in sections
            }
            passed = frozenset(QuizAttempt.objects.filter(user=sp, passed=True).values_list('quiz_id', flat=True))
            return _progress(done=done, passed=passed)

        def check(state):
            for current, following in zip(sections, sections[1:]):
                self.assertEqual(
                    section_completed(shape_of(current), progress()),
                    is_section_unlocked(sp, following),
                    f'{state}: section {current.order}',
                )

        check('nothing done')
        complete_lectures(student, first.lectures.all())
        check('section 1 lectures done, quiz not passed')
        attempt(student, first.quiz, passed=True)
        check('section 1 quiz passed')
        complete_lectures(student, second.lectures.all()[:1])
        check('section 2 partly done')
        complete_lectures(student, second.lectures.all()[1:])
        check('section 2 done')


# --------------------------------------------------------------------------
# US1 — one course (T015, T017)
# --------------------------------------------------------------------------

class CourseAnalyticsTests(AnalyticsTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('ca@test.com', 'ca')
        self.course = make_course(self.profile, title='Django for Beginners')
        self.n = 0

    def student(self):
        self.n += 1
        return make_student(f'ca_s{self.n}@test.com', f'ca_s{self.n}')

    def finish(self, student, sections):
        for section in sections:
            complete_lectures(student, section.lectures.all())
            quiz = Quiz.objects.filter(section=section).first()
            if quiz:
                attempt(student, quiz, passed=True)

    def fetch(self, days=None):
        response = self.get(self.user, self.course_url(self.course.id, days))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        data = response.data
        c, q = data['completion'], data['quiz_pass']
        # Invariants I2, I3, I5, I6 (data-model §6).
        self.assertTrue(0 <= c['completed'] <= c['total'])
        self.assertTrue(0 <= q['passed'] <= q['attempted'])
        for value in (c['rate'], q['rate']):
            self.assertTrue(value is None or 0 <= value <= 1)
        if data['section_drop_off']:  # I3 needs at least one section to place students in
            self.assertEqual(sum(s['count'] for s in data['section_drop_off']), c['total'] - c['completed'])
        self.assertEqual(sum(b['count'] for b in data['enrollments_over_time']), c['total'])
        self.assertEqual(data['active_students'], c['total'])
        return data

    def test_course_without_sections_has_empty_drop_off(self):
        enroll_at(self.student(), self.course)
        data = self.fetch()
        self.assertEqual(data['section_drop_off'], [])
        self.assertEqual(data['completion'], {'rate': 0.0, 'completed': 0, 'total': 1})

    def test_shape_smoke(self):
        data = self.fetch()
        self.assertEqual(set(data), COURSE_KEYS)
        self.assertEqual(data['scope'], 'course')
        self.assertEqual(data['course'], {'id': self.course.id, 'title': 'Django for Beginners'})
        self.assertEqual(data['period'], '30d')
        self.assertEqual(data['window'], {'start': '2026-08-19', 'end': '2026-09-17'})
        self.assertEqual(len(data['enrollments_over_time']), 30)

    def test_completion_requires_lectures_and_quizzes(self):
        s1 = add_section(self.course, 1, lectures=2, quiz=True)
        s2 = add_section(self.course, 2, lectures=1, quiz=True)
        for i in range(10):
            student = self.student()
            enroll_at(student, self.course, days_ago=i + 1)
            if i < 4:
                self.finish(student, [s1, s2])
            elif i == 4:
                # Every lecture done, last quiz failed (US1-2).
                self.finish(student, [s1])
                complete_lectures(student, s2.lectures.all())
                attempt(student, s2.quiz, passed=False)

        data = self.fetch()

        self.assertEqual(data['completion'], {'rate': 0.4, 'completed': 4, 'total': 10})
        # 5 students with no progress are stuck at section 1; the quiz-failer at section 2.
        self.assertEqual([s['count'] for s in data['section_drop_off']], [5, 1])

    def test_refunded_enrollment_counts_nowhere(self):
        s1 = add_section(self.course, 1, lectures=1)
        refunded = self.student()
        enroll_at(refunded, self.course, days_ago=2, active=False)
        self.finish(refunded, [s1])
        enroll_at(self.student(), self.course, days_ago=2)

        data = self.fetch()

        self.assertEqual(data['completion'], {'rate': 0.0, 'completed': 0, 'total': 1})
        self.assertEqual(data['active_students'], 1)

    def test_retakes_count_once(self):
        s1 = add_section(self.course, 1, lectures=1, quiz=True)
        student = self.student()
        enroll_at(student, self.course)
        for passed in (False, False, True):
            attempt(student, s1.quiz, passed=passed)
        other = self.student()
        enroll_at(other, self.course)
        attempt(other, s1.quiz, passed=False)

        self.assertEqual(self.fetch()['quiz_pass'], {'rate': 0.5, 'passed': 1, 'attempted': 2, 'has_quizzes': True})

    def test_section_drop_off_scenario(self):
        sections = [add_section(self.course, i, lectures=1) for i in (1, 2, 3, 4)]
        for done in ([], sections[:1], sections[:1], sections[:3], sections):
            student = self.student()
            enroll_at(student, self.course)
            self.finish(student, done)

        data = self.fetch()

        self.assertEqual([(s['order'], s['count']) for s in data['section_drop_off']],
                         [(1, 1), (2, 2), (3, 0), (4, 1)])
        self.assertEqual(data['section_drop_off'][0]['section_id'], sections[0].id)
        self.assertEqual(data['completion']['completed'], 1)

    def test_no_enrollments(self):
        add_section(self.course, 1, lectures=1)
        data = self.fetch()
        self.assertEqual(data['completion'], {'rate': None, 'completed': 0, 'total': 0})
        self.assertEqual(data['active_students'], 0)
        self.assertEqual(len(data['enrollments_over_time']), 30)
        self.assertEqual([s['count'] for s in data['section_drop_off']], [0])

    def test_quiz_states(self):
        add_section(self.course, 1, lectures=1)
        enroll_at(self.student(), self.course)
        self.assertEqual(self.fetch()['quiz_pass'],
                         {'rate': None, 'passed': 0, 'attempted': 0, 'has_quizzes': False})
        add_section(self.course, 2, lectures=1, quiz=True)
        self.assertEqual(self.fetch()['quiz_pass'],
                         {'rate': None, 'passed': 0, 'attempted': 0, 'has_quizzes': True})

    def test_unpublished_course_still_has_data(self):
        self.assertFalse(self.course.is_published)
        add_section(self.course, 1, lectures=1)
        enroll_at(self.student(), self.course)
        self.assertEqual(self.fetch()['active_students'], 1)

    def test_curriculum_change_reopens_completion(self):
        s1 = add_section(self.course, 1, lectures=1)
        s2 = add_section(self.course, 2, lectures=1)
        student = self.student()
        enroll_at(student, self.course)
        self.finish(student, [s1, s2])
        self.assertEqual(self.fetch()['completion']['completed'], 1)

        Lecture.objects.create(section=s2, title='New', duration=Decimal('3.00'), order=2)
        data = self.fetch()

        self.assertEqual(data['completion']['completed'], 0)
        self.assertEqual([s['count'] for s in data['section_drop_off']], [0, 1])


# --------------------------------------------------------------------------
# US2 — periods over HTTP (T025)
# --------------------------------------------------------------------------

class PeriodApiTests(AnalyticsTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('pa@test.com', 'pa')
        self.course = make_course(self.profile)
        self.section = add_section(self.course, 1, lectures=1)

    def fetch(self, days=None, expect=status.HTTP_200_OK):
        response = self.get(self.user, self.course_url(self.course.id, days))
        self.assertEqual(response.status_code, expect, response.data)
        return response.data

    def test_default_and_explicit_periods(self):
        self.assertEqual(self.fetch()['period'], '30d')
        ninety = self.fetch('90')
        self.assertEqual(ninety['period'], '90d')
        self.assertEqual(ninety['window'], {'start': '2026-06-20', 'end': '2026-09-17'})
        self.assertEqual(ninety['enrollments_over_time'][0], {'start': '2026-06-20', 'end': '2026-06-21', 'count': 0})
        self.assertEqual(self.fetch('all')['period'], 'all')

    def test_invalid_period_is_400(self):
        for bad in ('7', '30d'):
            self.assertEqual(self.fetch(bad, expect=status.HTTP_400_BAD_REQUEST),
                             {'error': 'days must be one of 30, 90, all.', 'code': 'invalid_period'})

    def test_cohort_by_enrollment_date(self):
        # Enrolled 45 days ago, finished since (US2-5).
        student = make_student('pa_s1@test.com', 'pa_s1')
        enroll_at(student, self.course, days_ago=45)
        complete_lectures(student, self.section.lectures.all())

        thirty = self.fetch('30')
        self.assertEqual((thirty['active_students'], thirty['completion']['total']), (0, 0))
        self.assertIsNone(thirty['completion']['rate'])
        self.assertEqual(sum(b['count'] for b in thirty['enrollments_over_time']), 0)

        ninety = self.fetch('90')
        self.assertEqual(ninety['active_students'], 1)
        self.assertEqual(ninety['completion']['completed'], 1)

    def test_old_enrollment_only_in_all_time(self):
        enroll_at(make_student('pa_s2@test.com', 'pa_s2'), self.course, days_ago=120)
        self.assertEqual(self.fetch('90')['active_students'], 0)

        data = self.fetch('all')
        start = (FIXED_NOW - timedelta(days=120)).date().isoformat()
        self.assertEqual(data['window'], {'start': start, 'end': '2026-09-17'})
        self.assertEqual(data['enrollments_over_time'][0]['start'], start)
        self.assertEqual(data['enrollments_over_time'][0]['count'], 1)

    def test_all_time_without_enrollments(self):
        data = self.fetch('all')
        self.assertEqual(data['window'], {'start': None, 'end': '2026-09-17'})
        self.assertEqual(data['enrollments_over_time'], [])

    def test_curriculum_is_period_independent(self):
        drops = [self.fetch(days)['section_drop_off'] for days in ('30', '90', 'all')]
        ids = [[(s['section_id'], s['title']) for s in drop] for drop in drops]
        self.assertEqual(ids[0], ids[1])
        self.assertEqual(ids[1], ids[2])


# --------------------------------------------------------------------------
# US3 — all courses (T030)
# --------------------------------------------------------------------------

class InstructorAnalyticsTests(AnalyticsTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('ia@test.com', 'ia')
        self.n = 0

    def student(self):
        self.n += 1
        return make_student(f'ia_s{self.n}@test.com', f'ia_s{self.n}')

    def course(self, title, **kwargs):
        course = make_course(self.profile, title=title, **kwargs)
        return course, add_section(course, 1, lectures=1)

    def fetch(self, days=None):
        response = self.get(self.user, self.instructor_url(days))
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        data = response.data
        c = data['completion']
        # Invariants I2, I4, I5 (data-model §6).
        self.assertTrue(0 <= c['completed'] <= c['total'])
        self.assertEqual(sum(b['total'] for b in data['course_drop_off']), c['total'])
        self.assertEqual(sum(b['not_completed'] for b in data['course_drop_off']), c['total'] - c['completed'])
        self.assertEqual(sum(b['count'] for b in data['enrollments_over_time']), c['total'])
        self.assertLessEqual(data['active_students'], c['total'])
        return data

    def test_shape(self):
        self.course('Only')
        data = self.fetch()
        self.assertEqual(set(data), INSTRUCTOR_KEYS)
        self.assertEqual(data['scope'], 'instructor')
        self.assertEqual(data['courses_count'], 1)

    def test_student_in_two_courses_counts_once_as_active(self):
        (a, sa), (b, _) = self.course('A'), self.course('B')
        student = self.student()
        enroll_at(student, a)
        enroll_at(student, b)
        complete_lectures(student, sa.lectures.all())

        data = self.fetch()

        self.assertEqual(data['completion'], {'rate': 0.5, 'completed': 1, 'total': 2})
        self.assertEqual(data['active_students'], 1)

    def test_cohort_is_per_student_course_pair(self):
        (a, _), (b, sb) = self.course('A'), self.course('B')
        student = self.student()
        enroll_at(student, a, days_ago=10)
        enroll_at(student, b, days_ago=60)
        complete_lectures(student, sb.lectures.all())

        data = self.fetch('30')

        # B's enrollment (and its progress) is outside the 30-day cohort.
        self.assertEqual(data['completion'], {'rate': 0.0, 'completed': 0, 'total': 1})
        self.assertEqual([bar['course_id'] for bar in data['course_drop_off']], [a.id])

    def test_pooled_not_averaged(self):
        (a, sa), (b, _) = self.course('A'), self.course('B')
        done = self.student()
        enroll_at(done, a)
        complete_lectures(done, sa.lectures.all())
        for _ in range(9):
            enroll_at(self.student(), b)

        data = self.fetch()

        self.assertEqual(data['completion']['rate'], 0.1)  # not (1.0 + 0.0) / 2
        self.assertEqual([(bar['course_id'], bar['drop_off_rate']) for bar in data['course_drop_off']],
                         [(b.id, 1.0), (a.id, 0.0)])

    def test_courses_without_cohort_have_no_bar_and_every_state_counts(self):
        live, _ = self.course('Live', is_published=True)
        self.course('Draft')
        unpublished, _ = self.course('Unpublished')
        enroll_at(self.student(), unpublished)

        data = self.fetch()

        self.assertEqual(data['courses_count'], 3)
        self.assertEqual([bar['course_id'] for bar in data['course_drop_off']], [unpublished.id])

    def test_no_courses(self):
        data = self.fetch('all')
        self.assertEqual(data['courses_count'], 0)
        self.assertEqual(data['completion'], {'rate': None, 'completed': 0, 'total': 0})
        self.assertFalse(data['quiz_pass']['has_quizzes'])
        self.assertEqual(data['course_drop_off'], [])
        self.assertEqual(data['enrollments_over_time'], [])


# --------------------------------------------------------------------------
# US4 — access (T037) and query-count guard (T038)
# --------------------------------------------------------------------------

class AnalyticsAccessTests(AnalyticsTestCase):
    def setUp(self):
        super().setUp()
        self.user_a, self.profile_a = make_instructor('acc_a@test.com', 'acc_a')
        self.user_b, self.profile_b = make_instructor('acc_b@test.com', 'acc_b')
        self.course_a = make_course(self.profile_a, title='Alpha course')
        self.course_b = make_course(self.profile_b, title='Bravo course')
        add_section(self.course_a, 1, lectures=1)
        section_b = add_section(self.course_b, 1, lectures=1)
        self.student_a = make_student('acc_sa@test.com', 'acc_sa', first_name='Sally', last_name='Learner')
        self.student_b = make_student('acc_sb@test.com', 'acc_sb', first_name='Bob', last_name='Learner')
        enroll_at(self.student_a, self.course_a)
        enroll_at(self.student_b, self.course_b)
        complete_lectures(self.student_b, section_b.lectures.all())

    def test_other_instructors_course_looks_missing(self):
        foreign = self.get(self.user_a, self.course_url(self.course_b.id))
        missing = self.get(self.user_a, self.course_url(999999))
        self.assertEqual(foreign.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(foreign.data, missing.data)
        self.assertNotIn('Bravo', json.dumps(foreign.data))

    def test_aggregate_contains_only_own_courses(self):
        data = self.get(self.user_a, self.instructor_url()).data
        self.assertEqual(data['courses_count'], 1)
        self.assertEqual(data['completion'], {'rate': 0.0, 'completed': 0, 'total': 1})
        self.assertEqual([bar['course_id'] for bar in data['course_drop_off']], [self.course_a.id])
        self.assertNotIn('Bravo', json.dumps(data))

    def test_query_parameters_cannot_widen_scope(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get(self.instructor_url(),
                                   {'instructor': self.profile_b.id, 'course': self.course_b.id})
        self.assertNotIn('Bravo', json.dumps(response.data))

    def test_student_and_anonymous_are_refused(self):
        for url in (self.course_url(self.course_a.id), self.instructor_url()):
            self.assertEqual(self.get(self.student_a, url).status_code, status.HTTP_403_FORBIDDEN)
            self.client.force_authenticate(user=None)
            self.assertIn(self.client.get(url).status_code,
                          (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_staff_without_profile_is_handled(self):
        staff = CustomUser.objects.create_instructor(
            email='acc_noprofile@test.com', password='pass1234', username='acc_noprofile',
            role='instructor', is_active=True,
        )
        InstructorProfile.objects.filter(user=staff).delete()
        staff = CustomUser.objects.get(pk=staff.pk)  # drop the cached reverse relation

        aggregate = self.get(staff, self.instructor_url())
        self.assertEqual(aggregate.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(aggregate.data, {
            'error': 'No instructor profile is associated with this account.',
            'code': 'no_instructor_profile',
        })
        self.assertEqual(self.get(staff, self.course_url(self.course_a.id)).status_code,
                         status.HTTP_404_NOT_FOUND)

    def test_no_student_identity_in_responses(self):
        forbidden = {'user', 'user_id', 'email', 'name', 'username', 'avatar', 'profile_picture'}
        for url in (self.course_url(self.course_a.id), self.instructor_url()):
            data = self.get(self.user_a, url).data
            self.assertFalse(forbidden & set(_all_keys(data)))
            dumped = json.dumps(data)
            for text in (self.student_a.email, 'Sally', self.student_a.username):
                self.assertNotIn(text, dumped)

    @patch('apps.course.analytics.service.CourseAnalyticsService.build', side_effect=RuntimeError('boom'))
    def test_failure_is_all_or_nothing(self, _build):
        for url in (self.course_url(self.course_a.id), self.instructor_url()):
            response = self.get(self.user_a, url)
            self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
            self.assertEqual(response.data, {'error': "We couldn't load analytics. Please try again."})

    def test_repeated_days_parameter_is_never_a_500(self):
        self.client.force_authenticate(user=self.user_a)
        for url in (self.course_url(self.course_a.id), self.instructor_url()):
            response = self.client.get(f'{url}?days=all&days=30')
            self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST))
            if response.status_code == status.HTTP_200_OK:
                self.assertIn(response.data['period'], ('30d', '90d', 'all'))


class AnalyticsPerformanceTests(AnalyticsTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('perf_an@test.com', 'perf_an')
        self.n = 0

    def populated_course(self, title, students=3):
        course = make_course(self.profile, title=title)
        first = add_section(course, 1, lectures=2, quiz=True)
        add_section(course, 2, lectures=1)
        self.add_students(course, first, students)
        return course, first

    def add_students(self, course, first, count):
        for _ in range(count):
            self.n += 1
            student = make_student(f'perf_an{self.n}@test.com', f'perf_an{self.n}')
            enroll_at(student, course)
            complete_lectures(student, first.lectures.all())
            attempt(student, first.quiz, passed=self.n % 2 == 0)

    def count_queries(self, url):
        self.client.force_authenticate(user=self.user)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return len(ctx.captured_queries)

    def test_aggregate_query_count_does_not_grow_with_courses(self):
        # Invariant I8. If this fails, an N+1 slipped into the service — fix the
        # service, don't loosen the test.
        self.populated_course('Course 0')
        one = self.count_queries(self.instructor_url())
        for n in range(1, 10):
            self.populated_course(f'Course {n}')
        self.assertEqual(one, self.count_queries(self.instructor_url()))

    def test_course_query_count_does_not_grow_with_students(self):
        course, first = self.populated_course('Big', students=3)
        few = self.count_queries(self.course_url(course.id))
        self.add_students(course, first, 27)
        self.assertEqual(few, self.count_queries(self.course_url(course.id)))
