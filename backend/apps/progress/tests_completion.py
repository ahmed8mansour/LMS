"""Course-completion summary tests: GET /progress/student/learn/course/<id>/completion/

Covers the completion rule itself (lectures AND quizzes), the two figures that
had no API before this endpoint (time spent, quiz average), and the access
boundary. Reuses the instructor/course helpers from apps.course.tests.
"""
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser, StudentProfile
from apps.course.models import Section, Lecture, Quiz
from apps.course.tests import make_instructor, make_course
from apps.enrollment.models import Enrollment, Order
from apps.progress.completion import build_course_completion
from apps.progress.models import LectureProgress, QuizAttempt
from apps.reviews.models import Review


def make_student(email='s@test.com', username='stud'):
    user = CustomUser.objects.create_user(
        email=email, password='pass1234', username=username,
        role='student', is_active=True,
    )
    profile, _ = StudentProfile.objects.get_or_create(user=user)
    return user, profile


def enroll(user, course, is_active=True):
    order = Order.objects.create(
        course=course, user=user, status='paid',
        amount=Decimal('10.00'), currency='USD',
        stripe_payment_intent_id='test',
    )
    return Enrollment.objects.create(
        course=course, user=user, order=order, is_active=is_active
    )


def lecture(section, order, duration='30.00'):
    return Lecture.objects.create(
        section=section, title=f'L{order}', duration=Decimal(duration), order=order
    )


def complete(profile, lec):
    return LectureProgress.objects.create(user=profile, lecture=lec, is_completed=True)


def attempt(profile, quiz, score, passed):
    return QuizAttempt.objects.create(
        user=profile, quiz=quiz, score=Decimal(score), passed=passed
    )


class CompletionAccessTests(APITestCase):
    def setUp(self):
        _, self.instructor = make_instructor('i@test.com', 'inst')
        self.course = make_course(self.instructor)
        self.user, self.profile = make_student()
        self.url = reverse('course_completion', args=[self.course.id])

    def test_requires_authentication(self):
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_not_enrolled_is_forbidden(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', res.data)

    def test_deactivated_enrollment_is_forbidden(self):
        # A refund deactivates the enrollment; the summary goes with the access.
        enroll(self.user, self.course, is_active=False)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_403_FORBIDDEN)

    def test_one_students_progress_never_reaches_another(self):
        section = Section.objects.create(course=self.course, title='S', order=0)
        lec = lecture(section, 0)
        _, other_profile = make_student('other@test.com', 'other')
        complete(other_profile, lec)

        enroll(self.user, self.course)
        self.client.force_authenticate(user=self.user)
        res = self.client.get(self.url)
        self.assertEqual(res.data['lectures_completed'], 0)
        self.assertFalse(res.data['is_completed'])


class CompletionRuleTests(APITestCase):
    """is_completed requires every lecture done AND every quiz passed."""

    def setUp(self):
        _, self.instructor = make_instructor('i2@test.com', 'inst2')
        self.course = make_course(self.instructor)
        self.user, self.profile = make_student('r@test.com', 'ruler')
        enroll(self.user, self.course)
        self.client.force_authenticate(user=self.user)
        self.url = reverse('course_completion', args=[self.course.id])
        self.section = Section.objects.create(course=self.course, title='S', order=0)

    def test_empty_course_is_never_complete(self):
        res = self.client.get(self.url)
        self.assertFalse(res.data['is_completed'])
        self.assertEqual(res.data['total_lectures'], 0)
        self.assertIsNone(res.data['completed_at'])

    def test_all_lectures_and_no_quizzes_completes(self):
        for i in range(2):
            complete(self.profile, lecture(self.section, i))
        res = self.client.get(self.url)
        self.assertTrue(res.data['is_completed'])
        self.assertEqual(res.data['lectures_completed'], 2)
        self.assertEqual(res.data['total_quizzes'], 0)
        self.assertIsNotNone(res.data['completed_at'])

    def test_one_lecture_short_is_not_complete(self):
        complete(self.profile, lecture(self.section, 0))
        lecture(self.section, 1)
        res = self.client.get(self.url)
        self.assertFalse(res.data['is_completed'])
        self.assertEqual(res.data['lectures_completed'], 1)
        self.assertEqual(res.data['total_lectures'], 2)

    def test_lectures_done_but_quiz_unpassed_is_not_complete(self):
        complete(self.profile, lecture(self.section, 0))
        quiz = Quiz.objects.create(section=self.section, title='Q', questions_count=2)
        attempt(self.profile, quiz, '40.00', passed=False)
        res = self.client.get(self.url)
        self.assertFalse(res.data['is_completed'])
        self.assertEqual(res.data['quizzes_passed'], 0)
        self.assertEqual(res.data['total_quizzes'], 1)

    def test_lectures_done_and_quiz_passed_completes(self):
        complete(self.profile, lecture(self.section, 0))
        quiz = Quiz.objects.create(section=self.section, title='Q', questions_count=2)
        attempt(self.profile, quiz, '80.00', passed=True)
        res = self.client.get(self.url)
        self.assertTrue(res.data['is_completed'])
        self.assertEqual(res.data['quizzes_passed'], 1)

    def test_second_section_quiz_left_unpassed_blocks_completion(self):
        complete(self.profile, lecture(self.section, 0))
        q1 = Quiz.objects.create(section=self.section, title='Q1', questions_count=1)
        attempt(self.profile, q1, '90.00', passed=True)

        s2 = Section.objects.create(course=self.course, title='S2', order=1)
        complete(self.profile, lecture(s2, 0))
        Quiz.objects.create(section=s2, title='Q2', questions_count=1)

        res = self.client.get(self.url)
        self.assertFalse(res.data['is_completed'])
        self.assertEqual(res.data['quizzes_passed'], 1)
        self.assertEqual(res.data['total_quizzes'], 2)


class CompletionFiguresTests(APITestCase):
    """The two figures that had no API before: time spent and quiz average."""

    def setUp(self):
        _, self.instructor = make_instructor('i3@test.com', 'inst3')
        self.course = make_course(self.instructor)
        self.user, self.profile = make_student('f@test.com', 'figures')
        enroll(self.user, self.course)
        self.client.force_authenticate(user=self.user)
        self.url = reverse('course_completion', args=[self.course.id])
        self.section = Section.objects.create(course=self.course, title='S', order=0)

    def test_minutes_sum_only_completed_lectures(self):
        complete(self.profile, lecture(self.section, 0, '30.00'))
        complete(self.profile, lecture(self.section, 1, '45.50'))
        lecture(self.section, 2, '100.00')  # not completed - must not count
        res = self.client.get(self.url)
        self.assertEqual(res.data['total_minutes'], 76)  # 30 + 45.5, rounded

    def test_minutes_ignore_another_courses_lectures(self):
        other = make_course(self.instructor, title='Other')
        other_section = Section.objects.create(course=other, title='S', order=0)
        complete(self.profile, lecture(other_section, 0, '99.00'))
        complete(self.profile, lecture(self.section, 0, '10.00'))
        res = self.client.get(self.url)
        self.assertEqual(res.data['total_minutes'], 10)

    def test_quiz_average_is_null_when_no_quiz_was_sat(self):
        complete(self.profile, lecture(self.section, 0))
        res = self.client.get(self.url)
        self.assertIsNone(res.data['quiz_average'])

    def test_quiz_average_uses_best_attempt_per_quiz(self):
        # A failed first try must not drag down a quiz the student went on to pass.
        quiz = Quiz.objects.create(section=self.section, title='Q', questions_count=2)
        attempt(self.profile, quiz, '40.00', passed=False)
        attempt(self.profile, quiz, '90.00', passed=True)
        res = self.client.get(self.url)
        self.assertEqual(res.data['quiz_average'], 90.0)

    def test_quiz_average_across_several_quizzes(self):
        q1 = Quiz.objects.create(section=self.section, title='Q1', questions_count=1)
        s2 = Section.objects.create(course=self.course, title='S2', order=1)
        q2 = Quiz.objects.create(section=s2, title='Q2', questions_count=1)
        attempt(self.profile, q1, '80.00', passed=True)
        attempt(self.profile, q2, '95.00', passed=True)
        res = self.client.get(self.url)
        self.assertEqual(res.data['quiz_average'], 87.5)

    def test_quiz_average_ignores_another_courses_quiz(self):
        other = make_course(self.instructor, title='Other')
        other_section = Section.objects.create(course=other, title='S', order=0)
        other_quiz = Quiz.objects.create(section=other_section, title='OQ', questions_count=1)
        attempt(self.profile, other_quiz, '10.00', passed=False)

        quiz = Quiz.objects.create(section=self.section, title='Q', questions_count=1)
        attempt(self.profile, quiz, '80.00', passed=True)
        res = self.client.get(self.url)
        self.assertEqual(res.data['quiz_average'], 80.0)

    def test_has_reviewed_reflects_an_existing_review(self):
        res = self.client.get(self.url)
        self.assertFalse(res.data['has_reviewed'])

        Review.objects.create(user=self.profile, course=self.course, rating=5, comment='Good')
        res = self.client.get(self.url)
        self.assertTrue(res.data['has_reviewed'])

    def test_payload_shape_is_flat_and_carries_the_course(self):
        complete(self.profile, lecture(self.section, 0))
        res = self.client.get(self.url)
        self.assertEqual(
            set(res.data.keys()),
            {
                'course', 'is_completed', 'lectures_completed', 'total_lectures',
                'quizzes_passed', 'total_quizzes', 'total_minutes', 'quiz_average',
                'completed_at', 'has_reviewed',
            },
        )
        self.assertEqual(res.data['course']['id'], self.course.id)
        self.assertEqual(res.data['course']['title'], self.course.title)


class CompletionServiceTests(APITestCase):
    """The rules belong to the service, not the view - exercise them directly."""

    def setUp(self):
        _, self.instructor = make_instructor('i4@test.com', 'inst4')
        self.course = make_course(self.instructor)
        self.user, self.profile = make_student('svc@test.com', 'svc')
        self.section = Section.objects.create(course=self.course, title='S', order=0)

    def test_service_needs_no_enrollment_of_its_own(self):
        # Access is the view's job; the service only reports.
        complete(self.profile, lecture(self.section, 0))
        data = build_course_completion(self.profile, self.course)
        self.assertTrue(data['is_completed'])

    def test_completed_at_is_the_moment_the_last_requirement_was_met(self):
        lec = lecture(self.section, 0)
        progress = complete(self.profile, lec)
        quiz = Quiz.objects.create(section=self.section, title='Q', questions_count=1)
        quiz_attempt = attempt(self.profile, quiz, '70.00', passed=True)

        data = build_course_completion(self.profile, self.course)
        self.assertEqual(
            data['completed_at'],
            max(progress.completed_at, quiz_attempt.attempted_at),
        )

    def test_completed_at_is_none_while_unfinished(self):
        complete(self.profile, lecture(self.section, 0))
        lecture(self.section, 1)
        self.assertIsNone(build_course_completion(self.profile, self.course)['completed_at'])
