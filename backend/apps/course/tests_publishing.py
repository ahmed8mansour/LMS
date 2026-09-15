"""007 — Course publishing & readiness gate.

Shared fixtures first, then tests grouped by the spec's user stories. The video
provider is patched throughout, so no test touches Cloudinary.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser, StudentProfile
from apps.course.models import Choice, Course, Lecture, Question, Quiz, Section
from apps.course.publishing import (
    READINESS_PREFETCH,
    CoursePublishingService,
    PublishReadinessService,
)
from apps.course.tests import make_course, make_instructor
from apps.enrollment.models import Enrollment, Order, Transaction
from apps.progress.models import LectureProgress
from apps.reviews.models import Review


# --------------------------------------------------------------------------
# Fixtures (T013)
# --------------------------------------------------------------------------

def make_student(email='pub_student@test.com', username='pub_student'):
    return CustomUser.objects.create_user(
        email=email, password='pass1234', username=username, role='student', is_active=True,
    )


def _ready_lecture(section, order, title):
    return Lecture.objects.create(
        section=section, title=title, duration=Decimal('5.00'), order=order,
        video_public_id=f'lms/lectures/{section.id}_{order}', video_status='COMPLETED',
    )


def _complete_quiz(section, title='Check'):
    quiz = Quiz.objects.create(section=section, title=title, questions_count=1)
    question = Question.objects.create(quiz=quiz, text='What is 2 + 2?', order=0)
    Choice.objects.create(question=question, text='4', is_correct=True)
    Choice.objects.create(question=question, text='5', is_correct=False)
    return quiz


def make_ready_course(instructor, **overrides):
    """A course satisfying every blocking condition of FR-009."""
    data = dict(
        title='Ready course', thumbnail='https://img.example/thumb.png',
        language='English', goals_list=['Ship it'],
    )
    data.update(overrides)
    course = make_course(instructor, **data)
    first = Section.objects.create(course=course, title='Basics', order=0)
    second = Section.objects.create(course=course, title='Advanced', order=1)
    _ready_lecture(first, 0, 'Intro')
    _ready_lecture(second, 0, 'Deep dive')
    _complete_quiz(first)
    return course


def break_one(course, condition):
    """Violate exactly one blocking condition on an otherwise ready course."""
    first = course.section_set.order_by('order').first()
    lecture = first.lectures.first() if first else None

    if condition == 'missing_thumbnail':
        Course.objects.filter(pk=course.pk).update(thumbnail=None)
    elif condition == 'no_sections':
        course.section_set.all().delete()
    elif condition == 'empty_section':
        first.lectures.all().delete()
    elif condition in ('lecture_video_missing', 'lecture_video_processing', 'lecture_video_failed'):
        status_for = {
            'lecture_video_missing': ('PENDING', None),
            'lecture_video_processing': ('PROCESSING', lecture.video_public_id),
            'lecture_video_failed': ('FAILED', lecture.video_public_id),
        }
        video_status, public_id = status_for[condition]
        Lecture.objects.filter(pk=lecture.pk).update(video_status=video_status, video_public_id=public_id)
    elif condition == 'quiz_no_questions':
        Question.objects.filter(quiz__section=first).delete()
    elif condition == 'quiz_incomplete_question':
        # One choice left, so the question fails the ">= 2 choices" rule.
        question = Question.objects.filter(quiz__section=first).first()
        question.choice.filter(is_correct=False).delete()
    else:
        raise ValueError(f'unknown condition {condition!r}')
    return Course.objects.get(pk=course.pk)


class PublishingTestCase(APITestCase):
    """Two instructors, a student, and a patched video provider."""

    def setUp(self):
        self.user, self.profile = make_instructor('pub_a@test.com', 'pub_a')
        self.other, self.other_profile = make_instructor('pub_b@test.com', 'pub_b')
        self.student = make_student()

        provider = MagicMock()
        provider.build_streaming_url.return_value = 'https://stream.example/video.m3u8'
        # Patch where the name is USED: the course and progress serializers build
        # streaming URLs for ready lectures, and the post_delete signal destroys
        # assets when break_one() deletes lectures or sections.
        for target in (
            'apps.course.serializers.get_video_provider',
            'apps.progress.serializers.get_video_provider',
            'apps.course.video.signals.get_video_provider',
            'apps.course.video.service.get_video_provider',
        ):
            patcher = patch(target, return_value=provider)
            patcher.start()
            self.addCleanup(patcher.stop)

    @staticmethod
    def reload(course):
        return Course.objects.get(pk=course.pk)


# --------------------------------------------------------------------------
# Foundational: the state machine and the transition facade (T014)
# --------------------------------------------------------------------------

class TransitionMatrixTests(PublishingTestCase):
    """All four cells of data-model.md §2, exercised through the facade."""

    def setUp(self):
        super().setUp()
        self.service = CoursePublishingService()

    def test_draft_publish_when_ready_flips_and_persists(self):
        course = make_ready_course(self.profile)
        result, report = self.service.publish(course)
        self.assertTrue(result.changed)
        self.assertFalse(result.refused)
        self.assertEqual(result.status, 'published')
        self.assertTrue(self.reload(course).is_published)
        # The report is taken after the flip, so it describes the live course.
        self.assertEqual(report.status, 'published')

    def test_draft_publish_when_not_ready_is_refused_and_writes_nothing(self):
        course = break_one(make_ready_course(self.profile), 'missing_thumbnail')
        before = self.reload(course).last_updated
        result, _ = self.service.publish(course)
        self.assertTrue(result.refused)
        self.assertFalse(result.changed)
        self.assertEqual([b.code for b in result.blockers], ['missing_thumbnail'])
        after = self.reload(course)
        self.assertFalse(after.is_published)
        self.assertEqual(after.last_updated, before)

    def test_draft_unpublish_is_an_idempotent_noop(self):
        course = make_ready_course(self.profile)
        before = self.reload(course).last_updated
        result, _ = self.service.unpublish(course)
        self.assertFalse(result.changed)
        self.assertFalse(result.refused)
        self.assertEqual(result.status, 'draft')
        self.assertEqual(self.reload(course).last_updated, before)

    def test_published_publish_is_an_idempotent_noop(self):
        course = make_ready_course(self.profile, is_published=True)
        before = self.reload(course).last_updated
        result, _ = self.service.publish(course)
        self.assertFalse(result.changed)
        self.assertFalse(result.refused)
        self.assertEqual(result.status, 'published')
        self.assertEqual(self.reload(course).last_updated, before)

    def test_published_unpublish_flips_and_persists(self):
        course = make_ready_course(self.profile, is_published=True)
        result, report = self.service.unpublish(course)
        self.assertTrue(result.changed)
        self.assertEqual(result.status, 'draft')
        self.assertFalse(self.reload(course).is_published)
        self.assertEqual(report.status, 'draft')

    def test_publishing_twice_is_clean_the_second_time(self):
        course = make_ready_course(self.profile)
        self.service.publish(course)
        result, _ = self.service.publish(course)
        self.assertFalse(result.changed)
        self.assertFalse(result.refused)


class FacadeIntegrityTests(PublishingTestCase):

    def test_gate_rereads_the_row_instead_of_trusting_the_callers_instance(self):
        # The caller holds an instance whose prefetched relations say "ready" —
        # exactly what a viewset's get_object() hands over (FR-014). Without the
        # prefetch this test would pass even against a service that trusted the
        # instance, because the relations would just be lazily re-queried.
        course = make_ready_course(self.profile)
        stale = Course.objects.prefetch_related(*READINESS_PREFETCH).get(pk=course.pk)
        self.assertTrue(PublishReadinessService().evaluate(stale).is_publishable)
        # The video goes away in the database; the cached relations don't know.
        Lecture.objects.filter(section__course=course).update(video_status='PENDING', video_public_id=None)
        result, _ = CoursePublishingService().publish(stale)
        self.assertTrue(result.refused)
        self.assertFalse(self.reload(stale).is_published)

    def test_successful_publish_does_not_bump_last_updated(self):
        # Students see "Last updated" on the public course page. Republishing an
        # old course must not present unchanged content as fresh.
        course = make_ready_course(self.profile)
        before = self.reload(course).last_updated
        CoursePublishingService().publish(course)
        after = self.reload(course)
        self.assertTrue(after.is_published)
        self.assertEqual(after.last_updated, before)

    def test_one_readiness_service_does_not_leak_blockers_between_courses(self):
        # The list serializer evaluates every owned course; a report for one
        # course must never carry another course's blockers.
        service = PublishReadinessService()
        broken = break_one(make_ready_course(self.profile, title='Broken'), 'missing_thumbnail')
        healthy = make_ready_course(self.profile, title='Healthy')
        self.assertFalse(service.evaluate(broken).is_publishable)
        report = service.evaluate(healthy)
        self.assertTrue(report.is_publishable)
        self.assertEqual(report.blockers, ())


# --------------------------------------------------------------------------
# US1 — Publish a finished course (T019–T021)
# --------------------------------------------------------------------------

def publish_url(course):
    return reverse('instructor_courses-publish', args=[course.pk])


class PublishEndpointTests(PublishingTestCase):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    def test_publishing_a_ready_course_returns_the_live_report(self):
        course = make_ready_course(self.profile)
        res = self.client.post(publish_url(course))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertTrue(res.data['changed'])
        self.assertEqual(res.data['status'], 'published')
        self.assertTrue(res.data['is_publishable'])
        self.assertFalse(res.data['needs_attention'])
        self.assertEqual(res.data['blockers'], [])
        self.assertIn('detail', res.data)
        self.assertTrue(self.reload(course).is_published)

    def test_publishing_an_already_published_course_is_a_clean_noop(self):
        course = make_ready_course(self.profile, is_published=True)
        res = self.client.post(publish_url(course))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertFalse(res.data['changed'])
        self.assertEqual(res.data['status'], 'published')

    def test_publishing_an_unready_course_is_refused_with_its_blockers(self):
        course = break_one(make_ready_course(self.profile), 'empty_section')
        res = self.client.post(publish_url(course))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
        self.assertIsInstance(res.data['error'], str)
        self.assertEqual([b['code'] for b in res.data['blockers']], ['empty_section'])
        self.assertEqual(res.data['blockers'][0]['target']['kind'], 'section')
        self.assertFalse(self.reload(course).is_published)

    def test_gate_judges_state_at_request_time_not_at_last_read(self):
        # FR-014: the checklist said ready, then the video went away.
        course = make_ready_course(self.profile)
        detail = self.client.get(reverse('instructor_courses-detail', args=[course.pk]))
        self.assertTrue(detail.data['is_publishable'])

        lecture = Lecture.objects.filter(section__course=course).order_by('section__order').first()
        Lecture.objects.filter(pk=lecture.pk).update(video_status='PENDING', video_public_id=None)

        res = self.client.post(publish_url(course))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)
        blocker = res.data['blockers'][0]
        self.assertEqual(blocker['code'], 'lecture_video_missing')
        self.assertEqual(blocker['target'], {'kind': 'lecture', 'id': lecture.pk, 'section_id': lecture.section_id})
        self.assertIn(lecture.title, blocker['message'])  # names the specific item (FR-015)
        self.assertFalse(self.reload(course).is_published)


class PublishStudentVisibilityTests(PublishingTestCase):
    """FR-001 / SC-002: publishing actually puts the course in front of students."""

    def test_published_course_appears_in_catalog_detail_and_homepage(self):
        course = make_ready_course(self.profile)
        self.client.force_authenticate(user=self.user)
        self.assertEqual(self.client.post(publish_url(course)).status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=None)

        listing = self.client.get(reverse('student_courses-list'))
        self.assertIn(course.pk, [c['id'] for c in listing.data['results']])
        self.assertEqual(
            self.client.get(reverse('student_courses-detail', args=[course.pk])).status_code,
            status.HTTP_200_OK,
        )
        homepage = self.client.get(reverse('homepage'))
        self.assertIn(course.pk, [c['id'] for c in homepage.data])

    def test_published_course_can_be_enrolled_in(self):
        course = make_ready_course(self.profile, price=Decimal('0.00'))
        self.client.force_authenticate(user=self.user)
        self.client.post(publish_url(course))

        self.client.force_authenticate(user=self.student)
        res = self.client.post(reverse('free_enrollment'), {'course_id': course.pk}, format='json')
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED), res.data)


# --------------------------------------------------------------------------
# US2 — See exactly why a course cannot be published yet (T027–T029)
# --------------------------------------------------------------------------

def readiness_url(course):
    return reverse('instructor_courses-readiness', args=[course.pk])


class ReadinessEndpointTests(PublishingTestCase):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    def readiness(self, course):
        res = self.client.get(readiness_url(course))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        return res.data

    def assert_only_blocker(self, course, code):
        data = self.readiness(course)
        self.assertEqual([b['code'] for b in data['blockers']], [code])
        self.assertFalse(data['is_publishable'])
        return data['blockers'][0]

    # -- T027: each blocking code in isolation --------------------------------

    def test_missing_thumbnail_null_and_blank(self):
        null_course = break_one(make_ready_course(self.profile, title='Null thumb'), 'missing_thumbnail')
        self.assert_only_blocker(null_course, 'missing_thumbnail')
        blank_course = make_ready_course(self.profile, title='Blank thumb', thumbnail='')
        blocker = self.assert_only_blocker(blank_course, 'missing_thumbnail')
        self.assertEqual(blocker['target'], {'kind': 'course', 'id': blank_course.pk})

    def test_no_sections(self):
        course = break_one(make_ready_course(self.profile), 'no_sections')
        self.assert_only_blocker(course, 'no_sections')

    def test_empty_section_targets_that_section_and_names_it(self):
        course = break_one(make_ready_course(self.profile), 'empty_section')
        first = course.section_set.order_by('order').first()
        blocker = self.assert_only_blocker(course, 'empty_section')
        self.assertEqual(blocker['target'], {'kind': 'section', 'id': first.pk})
        self.assertIn(first.title, blocker['message'])

    def test_each_unready_video_state_has_its_own_code(self):
        # The remedy differs — upload, wait, or retry — so the code must too.
        for code in ('lecture_video_missing', 'lecture_video_processing', 'lecture_video_failed'):
            with self.subTest(code=code):
                course = break_one(make_ready_course(self.profile, title=code), code)
                lecture = Lecture.objects.filter(section__course=course).order_by('section__order').first()
                blocker = self.assert_only_blocker(course, code)
                self.assertEqual(
                    blocker['target'], {'kind': 'lecture', 'id': lecture.pk, 'section_id': lecture.section_id}
                )

    def test_quiz_with_no_questions(self):
        course = break_one(make_ready_course(self.profile), 'quiz_no_questions')
        blocker = self.assert_only_blocker(course, 'quiz_no_questions')
        self.assertEqual(blocker['target']['kind'], 'quiz')

    def test_each_way_a_question_can_be_incomplete(self):
        # 005 FR-010: text, at least two choices, exactly one correct.
        def blank_text(course):
            Question.objects.filter(quiz__section__course=course).update(text='   ')

        def one_choice(course):
            Choice.objects.filter(question__quiz__section__course=course, is_correct=False).delete()

        def zero_correct(course):
            Choice.objects.filter(question__quiz__section__course=course).update(is_correct=False)

        def two_correct(course):
            Choice.objects.filter(question__quiz__section__course=course).update(is_correct=True)

        for breaker in (blank_text, one_choice, zero_correct, two_correct):
            with self.subTest(breaker=breaker.__name__):
                course = make_ready_course(self.profile, title=breaker.__name__)
                breaker(course)
                blocker = self.assert_only_blocker(course, 'quiz_incomplete_question')
                self.assertIn('1 incomplete question', blocker['message'])

    # -- T028: combinations, advisories, and what must never block --------------

    def test_every_blocker_is_returned_not_just_the_first(self):
        course = make_ready_course(self.profile, thumbnail=None)
        first, second = course.section_set.order_by('order')
        first.lectures.all().delete()
        Lecture.objects.filter(section=second).update(video_status='FAILED')
        codes = sorted(b['code'] for b in self.readiness(course)['blockers'])
        self.assertEqual(codes, ['empty_section', 'lecture_video_failed', 'missing_thumbnail'])

    def test_a_ready_course_has_no_blockers(self):
        data = self.readiness(make_ready_course(self.profile))
        self.assertTrue(data['is_publishable'])
        self.assertEqual(data['blockers'], [])
        self.assertEqual(data['status'], 'draft')

    def test_advisories_are_reported_but_never_block(self):
        course = make_ready_course(self.profile, language='', goals_list=[])
        Quiz.objects.filter(section__course=course).delete()
        data = self.readiness(course)
        self.assertTrue(data['is_publishable'])
        self.assertEqual(data['blockers'], [])
        self.assertEqual(
            sorted(a['code'] for a in data['advisories']), ['no_goals', 'no_language', 'no_quizzes']
        )
        self.assertTrue(all(a['severity'] == 'advisory' for a in data['advisories']))

    def test_free_course_is_publishable(self):
        self.assertTrue(self.readiness(make_ready_course(self.profile, price=Decimal('0.00')))['is_publishable'])

    def test_no_quizzes_advisory_waits_until_there_are_sections(self):
        # With nothing to attach a quiz to, the no_sections blocker says what to do.
        course = break_one(make_ready_course(self.profile), 'no_sections')
        self.assertNotIn('no_quizzes', [a['code'] for a in self.readiness(course)['advisories']])

    # -- T029: the read writes nothing ----------------------------------------

    def test_readiness_is_a_pure_read(self):
        course = make_ready_course(self.profile, is_published=True)
        before = self.reload(course)
        self.readiness(course)
        after = self.reload(course)
        self.assertEqual(after.is_published, before.is_published)
        self.assertEqual(after.last_updated, before.last_updated)


# --------------------------------------------------------------------------
# US3 — Take a live course back off the catalog (T034–T036)
# --------------------------------------------------------------------------

def unpublish_url(course):
    return reverse('instructor_courses-unpublish', args=[course.pk])


def enroll(student, course):
    order = Order.objects.create(
        course=course, user=student, status='paid', amount=course.price,
        currency='USD', stripe_payment_intent_id='pi_test_publishing',
    )
    return Enrollment.objects.create(course=course, user=student, order=order, is_active=True)


class UnpublishEndpointTests(PublishingTestCase):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    # -- T034 -----------------------------------------------------------------

    def test_unpublishing_a_live_course_makes_it_a_draft(self):
        course = make_ready_course(self.profile, is_published=True)
        res = self.client.post(unpublish_url(course))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertTrue(res.data['changed'])
        self.assertEqual(res.data['status'], 'draft')
        self.assertFalse(self.reload(course).is_published)

    def test_unpublishing_a_draft_is_a_clean_noop(self):
        course = make_ready_course(self.profile)
        res = self.client.post(unpublish_url(course))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertFalse(res.data['changed'])
        self.assertEqual(res.data['status'], 'draft')

    def test_a_broken_live_course_can_still_be_unpublished(self):
        # FR-016: the gate never applies in this direction — a broken course is
        # often exactly why an instructor is pulling it.
        course = make_ready_course(self.profile, is_published=True)
        course = break_one(course, 'lecture_video_failed')
        res = self.client.post(unpublish_url(course))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertTrue(res.data['changed'])
        self.assertFalse(self.reload(course).is_published)
        # The response still shows what stands between this draft and republishing.
        self.assertEqual([b['code'] for b in res.data['blockers']], ['lecture_video_failed'])

    # -- T036 -----------------------------------------------------------------

    def test_republishing_reapplies_the_gate(self):
        course = make_ready_course(self.profile, is_published=True)
        self.client.post(unpublish_url(course))
        break_one(course, 'missing_thumbnail')
        self.assertEqual(self.client.post(publish_url(course)).status_code, status.HTTP_400_BAD_REQUEST)

        Course.objects.filter(pk=course.pk).update(thumbnail='https://img.example/new.png')
        self.assertEqual(self.client.post(publish_url(course)).status_code, status.HTTP_200_OK)
        self.client.force_authenticate(user=None)
        listing = self.client.get(reverse('student_courses-list'))
        self.assertIn(course.pk, [c['id'] for c in listing.data['results']])


class UnpublishKeepsEnrolledStudentsWholeTests(PublishingTestCase):
    """T035 — FR-031: unpublishing removes discovery and new purchases, nothing else."""

    def setUp(self):
        super().setUp()
        self.course = make_ready_course(self.profile, is_published=True)
        self.first_section = self.course.section_set.order_by('order').first()
        self.first_lecture = self.first_section.lectures.order_by('order').first()
        self.quiz = Quiz.objects.get(section=self.first_section)

        self.enrollment = enroll(self.student, self.course)
        self.student_profile = StudentProfile.objects.get(user=self.student)
        LectureProgress.objects.create(user=self.student_profile, lecture=self.first_lecture, is_completed=True)
        Review.objects.create(user=self.student_profile, course=self.course, rating=5, comment='Great')

    def snapshot(self):
        course = self.reload(self.course)
        return {
            'enrollments': list(Enrollment.objects.filter(course=course).values()),
            'orders': list(Order.objects.filter(course=course).values()),
            'transactions': list(Transaction.objects.filter(order__course=course).values()),
            'progress': list(LectureProgress.objects.filter(lecture__section__course=course).values()),
            'reviews': list(Review.objects.filter(course=course).values()),
            'subscribers_count': course.subscribers_count,
        }

    def unpublish(self, course=None):
        course = course or self.course
        self.client.force_authenticate(user=self.user)
        res = self.client.post(unpublish_url(course))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertFalse(self.reload(course).is_published)
        self.client.force_authenticate(user=self.student)

    def test_enrolled_student_keeps_content_video_quiz_and_progress(self):
        self.unpublish()

        course_detail = self.client.get(reverse('enrolled_course_detail', args=[self.course.pk]))
        self.assertEqual(course_detail.status_code, status.HTTP_200_OK, course_detail.data)

        section = self.client.get(reverse('enrolled_section_detail', args=[self.first_section.pk]))
        self.assertEqual(section.status_code, status.HTTP_200_OK, section.data)

        lecture = self.client.get(reverse('get_lecture_detail', args=[self.first_lecture.pk]))
        self.assertEqual(lecture.status_code, status.HTTP_200_OK, lecture.data)
        self.assertTrue(lecture.data['video_url'], 'enrolled student lost the streaming URL')
        self.assertTrue(lecture.data['is_completed'], 'enrolled student lost their progress')

        # The first section's only lecture is complete, so its quiz is unlocked.
        quiz = self.client.get(reverse('get_quiz_question', args=[self.quiz.pk]))
        self.assertEqual(quiz.status_code, status.HTTP_200_OK, quiz.data)

    def test_no_enrollment_order_progress_or_review_row_changes(self):
        before = self.snapshot()
        self.unpublish()
        self.assertEqual(self.snapshot(), before)

    def test_course_cannot_be_newly_enrolled_in_after_unpublish(self):
        free = make_ready_course(self.profile, title='Free', price=Decimal('0.00'), is_published=True)
        self.unpublish(free)
        self.unpublish()

        newcomer = make_student('late@test.com', 'late_student')
        self.client.force_authenticate(user=newcomer)
        free_res = self.client.post(reverse('free_enrollment'), {'course_id': free.pk}, format='json')
        self.assertEqual(free_res.status_code, status.HTTP_404_NOT_FOUND, free_res.data)
        # Paid path: refused by validation, before any payment gateway is involved.
        paid_res = self.client.post(reverse('create_intent'), {'course': self.course.pk}, format='json')
        self.assertEqual(paid_res.status_code, status.HTTP_400_BAD_REQUEST, paid_res.data)
        self.assertFalse(Enrollment.objects.filter(user=newcomer).exists())


# --------------------------------------------------------------------------
# US4 — Find out when a live course develops a problem (T040–T043)
# --------------------------------------------------------------------------

def detail_url(course):
    return reverse('instructor_courses-detail', args=[course.pk])


class NeedsAttentionTests(PublishingTestCase):

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.user)

    # -- T040 -----------------------------------------------------------------

    def test_flag_is_set_only_for_a_live_course_that_fails_the_bar(self):
        broken_live = break_one(make_ready_course(self.profile, title='Broken live', is_published=True), 'empty_section')
        broken_draft = break_one(make_ready_course(self.profile, title='Broken draft'), 'empty_section')
        healthy_live = make_ready_course(self.profile, title='Healthy live', is_published=True)

        self.assertTrue(self.client.get(detail_url(broken_live)).data['needs_attention'])
        # A draft failing the bar is just "not ready yet", not a problem students can hit.
        self.assertFalse(self.client.get(detail_url(broken_draft)).data['needs_attention'])
        self.assertFalse(self.client.get(detail_url(healthy_live)).data['needs_attention'])

        listing = {c['id']: c for c in self.client.get(reverse('instructor_courses-list')).data}
        self.assertTrue(listing[broken_live.pk]['needs_attention'])
        self.assertFalse(listing[broken_live.pk]['is_publishable'])
        self.assertFalse(listing[healthy_live.pk]['needs_attention'])
        self.assertTrue(listing[healthy_live.pk]['is_publishable'])

    # -- T041 -----------------------------------------------------------------

    def test_breaking_a_live_course_never_unpublishes_it(self):
        # FR-023 / SC-008, through the real instructor actions: remove a video,
        # then delete a whole section.
        course = make_ready_course(self.profile, is_published=True)
        first, second = course.section_set.order_by('order')
        lecture = first.lectures.first()

        res = self.client.delete(reverse('video_delete', args=[lecture.pk]))
        self.assertIn(res.status_code, (status.HTTP_200_OK, status.HTTP_204_NO_CONTENT))
        self.assertTrue(self.reload(course).is_published)

        res = self.client.delete(reverse('instructor_sections-detail', args=[second.pk]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(self.reload(course).is_published)

        self.client.force_authenticate(user=None)
        listing = self.client.get(reverse('student_courses-list'))
        self.assertIn(course.pk, [c['id'] for c in listing.data['results']])

    # -- T042 -----------------------------------------------------------------

    def test_flag_clears_when_fixed_without_republishing(self):
        course = break_one(make_ready_course(self.profile, is_published=True), 'lecture_video_failed')
        self.assertTrue(self.client.get(detail_url(course)).data['needs_attention'])

        Lecture.objects.filter(section__course=course).update(video_status='COMPLETED')
        data = self.client.get(detail_url(course)).data
        self.assertFalse(data['needs_attention'])
        self.assertTrue(data['is_published'])

    # -- T043 -----------------------------------------------------------------

    def test_readiness_adds_no_queries_on_a_prefetched_queryset(self):
        # Scoped honestly: the My Courses list is already O(N) in queries because
        # of the pre-existing `sections` and `instructor_profile` serializer
        # fields. What research R5 promises is that READINESS adds nothing on top,
        # given the viewset's prefetch — so that is what is asserted.
        for i in range(3):
            course = make_ready_course(self.profile, title=f'Course {i}')
            if i == 1:
                break_one(course, 'quiz_incomplete_question')
        courses = list(Course.objects.filter(instructor=self.profile).prefetch_related(*READINESS_PREFETCH))

        service = PublishReadinessService()
        with self.assertNumQueries(0):
            reports = [service.evaluate(course) for course in courses]
        self.assertEqual(sum(1 for r in reports if not r.is_publishable), 1)


# --------------------------------------------------------------------------
# US5 — Nobody publishes another instructor's course (T044–T047)
# These are the only evidence the ownership guarantee holds: there is no
# implementation to point at, because @action inherits get_queryset() (R2).
# --------------------------------------------------------------------------

class OwnershipTests(PublishingTestCase):

    def setUp(self):
        super().setUp()
        self.draft = make_ready_course(self.profile, title='A draft')
        self.live = make_ready_course(self.profile, title='A live', is_published=True)

    def all_three(self):
        return (
            ('readiness', 'get', readiness_url),
            ('publish', 'post', publish_url),
            ('unpublish', 'post', unpublish_url),
        )

    # -- T044 -----------------------------------------------------------------

    def test_another_instructor_gets_404_and_changes_nothing(self):
        self.client.force_authenticate(user=self.other)
        for course in (self.draft, self.live):
            for name, method, url in self.all_three():
                with self.subTest(course=course.title, action=name):
                    res = getattr(self.client, method)(url(course))
                    self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
                    self.assertNotIn(course.title, str(res.data))
        self.assertFalse(self.reload(self.draft).is_published)
        self.assertTrue(self.reload(self.live).is_published)

    # -- T045 -----------------------------------------------------------------

    def test_student_is_forbidden(self):
        self.client.force_authenticate(user=self.student)
        for name, method, url in self.all_three():
            with self.subTest(action=name):
                self.assertEqual(getattr(self.client, method)(url(self.live)).status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(self.reload(self.live).is_published)

    def test_staff_without_an_instructor_profile_gets_a_clean_404(self):
        # Passes the is_staff instructor gate but has no InstructorProfile (FR-029).
        # create_user() forces is_staff=False whatever you pass, so staff is set
        # afterwards — with a queryset update, so no post_save signal can attach
        # a profile.
        staff = CustomUser.objects.create_user(
            email='staff_np@test.com', password='pass1234', username='staff_np',
            role='student', is_active=True,
        )
        CustomUser.objects.filter(pk=staff.pk).update(is_staff=True)
        staff = CustomUser.objects.get(pk=staff.pk)
        self.assertTrue(staff.is_staff)
        self.assertFalse(hasattr(staff, 'instructor_profile'))
        self.client.force_authenticate(user=staff)
        for name, method, url in self.all_three():
            with self.subTest(action=name):
                self.assertEqual(getattr(self.client, method)(url(self.draft)).status_code, status.HTTP_404_NOT_FOUND)

    def test_anonymous_is_rejected_not_errored(self):
        for name, method, url in self.all_three():
            with self.subTest(action=name):
                res = getattr(self.client, method)(url(self.draft))
                self.assertIn(res.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    # -- T046 -----------------------------------------------------------------

    def test_metadata_writes_cannot_publish(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.patch(detail_url(self.draft), {'is_published': True}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertFalse(self.reload(self.draft).is_published)

        res = self.client.post(reverse('instructor_courses-list'), {
            'title': 'Sneaky', 'description': 'd', 'price': '10.00',
            'category': 'development', 'level': 'beginner', 'is_published': True,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertFalse(Course.objects.get(pk=res.data['id']).is_published)

    # -- T047 -----------------------------------------------------------------

    def test_drafts_never_reach_students(self):
        free_draft = make_ready_course(self.profile, title='Free draft', price=Decimal('0.00'))

        listing = self.client.get(reverse('student_courses-list'))
        ids = [c['id'] for c in listing.data['results']]
        self.assertNotIn(self.draft.pk, ids)
        self.assertNotIn(free_draft.pk, ids)
        self.assertIn(self.live.pk, ids)

        self.assertEqual(
            self.client.get(reverse('student_courses-detail', args=[self.draft.pk])).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertNotIn(self.draft.pk, [c['id'] for c in self.client.get(reverse('homepage')).data])

        self.client.force_authenticate(user=self.student)
        res = self.client.post(reverse('free_enrollment'), {'course_id': free_draft.pk}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND, res.data)
