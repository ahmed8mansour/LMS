"""008 — Instructor dashboard. Fixtures first, then tests grouped by user story."""
import json
from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser, InstructorProfile, StudentProfile
from apps.course.tests import make_course, make_instructor
from apps.course.dashboard.attention import classify, rank
from apps.course.models import Course, Lecture, Section
from apps.course.publishing import ReadinessItem, ReadinessReport
from apps.course.tests_publishing import break_one, make_ready_course
from apps.enrollment.models import Enrollment, Order
from apps.reviews.models import Review


# --------------------------------------------------------------------------
# Fixtures (T009)
# --------------------------------------------------------------------------

DASHBOARD_URL = reverse('instructor_dashboard')

SNAPSHOT_KEYS = {
    'mode', 'instructor_name', 'courses', 'students', 'rating', 'earnings',
    'recent_enrollments', 'recent_reviews', 'needs_attention', 'onboarding',
}


def make_student(email, username, first_name='', last_name='', profile_picture=None):
    user = CustomUser.objects.create_user(
        email=email, password='pass1234', username=username, role='student', is_active=True,
        first_name=first_name, last_name=last_name, profile_picture=profile_picture,
    )
    # The post_save signal creates the profile for role='student'; get_or_create keeps
    # the fixture correct even if that signal changes.
    StudentProfile.objects.get_or_create(user=user)
    return user


def enroll(user, course, amount='10.00', status='paid', active=True):
    order = Order.objects.create(
        course=course, user=user, status=status, amount=Decimal(amount),
        currency='USD', stripe_payment_intent_id='test',
    )
    return Enrollment.objects.create(course=course, user=user, order=order, is_active=active)


def review(user, course, rating=5, comment='Great'):
    return Review.objects.create(
        user=StudentProfile.objects.get(user=user), course=course, rating=rating, comment=comment,
    )


class DashboardTestCase(APITestCase):
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

    def get_dashboard(self, user):
        self.client.force_authenticate(user=user)
        return self.client.get(DASHBOARD_URL)


# --------------------------------------------------------------------------
# Shape smoke test
# --------------------------------------------------------------------------

class SnapshotShapeTests(DashboardTestCase):
    def test_snapshot_has_contract_shape(self):
        user, profile = make_instructor('dash_shape@test.com', 'dash_shape')
        make_course(profile)

        response = self.get_dashboard(user)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data.keys()), SNAPSHOT_KEYS)
        self.assertEqual(response.data['mode'], 'full')


# --------------------------------------------------------------------------
# US1 — Tiles (T019)
# --------------------------------------------------------------------------

class TilesTests(DashboardTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('dash_tiles@test.com', 'dash_tiles')
        self.published = make_course(self.profile, title='Live A', is_published=True)
        self.published_b = make_course(self.profile, title='Live B', is_published=True)
        self.draft = make_course(self.profile, title='Draft')

    def test_course_counts(self):
        data = self.get_dashboard(self.user).data
        self.assertEqual(data['courses'], {'total': 3, 'published': 2})

    def test_student_in_two_courses_counted_once(self):
        student = make_student('s1@test.com', 's1')
        enroll(student, self.published)
        enroll(student, self.published_b)

        students = self.get_dashboard(self.user).data['students']

        self.assertEqual(students, {'distinct': 1, 'enrollments': 2})

    def test_refund_excluded_from_students_and_earnings(self):
        paying = make_student('paying@test.com', 'paying')
        refunded = make_student('refunded@test.com', 'refunded')
        enroll(paying, self.published, amount='10.00')
        enroll(refunded, self.published, amount='30.00', status='refunded', active=False)

        data = self.get_dashboard(self.user).data

        self.assertEqual(data['students'], {'distinct': 1, 'enrollments': 1})
        self.assertEqual(data['earnings'], {'amount': '10.00', 'currency': 'USD'})

    def test_free_enrollment_counts_students_adds_zero_earnings(self):
        student = make_student('free@test.com', 'free')
        enroll(student, self.published, amount='0.00')

        data = self.get_dashboard(self.user).data

        self.assertEqual(data['students']['distinct'], 1)
        self.assertEqual(data['earnings']['amount'], '0.00')

    def test_pending_and_failed_orders_excluded_from_earnings(self):
        enroll(make_student('pending@test.com', 'pending'), self.published, amount='20.00', status='pending', active=False)
        enroll(make_student('failed@test.com', 'failed'), self.published, amount='20.00', status='failed', active=False)

        data = self.get_dashboard(self.user).data

        self.assertEqual(data['earnings']['amount'], '0.00')
        self.assertEqual(data['students']['distinct'], 0)

    def test_unpublished_course_still_counts(self):
        student = make_student('kept@test.com', 'kept')
        enroll(student, self.draft, amount='15.00')

        data = self.get_dashboard(self.user).data

        self.assertEqual(data['students']['distinct'], 1)
        self.assertEqual(data['earnings']['amount'], '15.00')

    def test_rating_matches_public_profile_and_ignores_drafts(self):
        from apps.reviews.utils import get_instructor_rating

        a = make_student('ra@test.com', 'ra')
        b = make_student('rb@test.com', 'rb')
        review(a, self.published, rating=5)
        review(b, self.published, rating=4)
        review(a, self.draft, rating=1)  # draft course: must not move the rating

        rating = self.get_dashboard(self.user).data['rating']
        public = get_instructor_rating(self.profile)

        self.assertEqual(rating, {'avg_rating': 4.5, 'reviews_count': 2})
        self.assertEqual(rating['avg_rating'], float(public['avg_rating']))
        self.assertEqual(rating['reviews_count'], public['reviews_count'])

    def test_no_reviews_is_not_yet_rated(self):
        rating = self.get_dashboard(self.user).data['rating']
        self.assertEqual(rating, {'avg_rating': None, 'reviews_count': 0})

    def test_earnings_sum_across_courses(self):
        enroll(make_student('e1@test.com', 'e1'), self.published, amount='10.00')
        enroll(make_student('e2@test.com', 'e2'), self.published_b, amount='25.50')

        earnings = self.get_dashboard(self.user).data['earnings']

        self.assertEqual(earnings, {'amount': '35.50', 'currency': 'USD'})


# --------------------------------------------------------------------------
# US2 — Needs attention (T023)
# --------------------------------------------------------------------------

def _blocker(code, target=None):
    return ReadinessItem(code=code, severity='blocking', message=code, target=target)


def _report(status='draft', blockers=()):
    blockers = tuple(blockers)
    is_publishable = not blockers
    return ReadinessReport(
        status=status,
        is_publishable=is_publishable,
        needs_attention=status == 'published' and not is_publishable,
        blockers=blockers,
        advisories=(),
    )


def _course(id, is_published=False, created_at=None, title=None):
    return SimpleNamespace(
        id=id, title=title or f'Course {id}', is_published=is_published,
        created_at=created_at or timezone.now(),
    )


FAILED = 'lecture_video_failed'


class AttentionRankingUnitTests(SimpleTestCase):
    def test_live_course_failing_readiness(self):
        item = classify(_course(1, is_published=True), _report('published', [_blocker('empty_section')]), 3)
        self.assertEqual(item.type, 'live_needs_attention')
        self.assertEqual(item.target.kind, 'course')

    def test_healthy_published_course_is_not_listed(self):
        self.assertIsNone(classify(_course(1, is_published=True), _report('published'), 10))

    def test_draft_with_failed_video(self):
        report = _report(blockers=[_blocker(FAILED, {'kind': 'lecture', 'id': 77, 'section_id': 5})])
        item = classify(_course(1), report, 0)
        self.assertEqual(item.type, 'video_failed')
        self.assertEqual(item.failed_lecture_ids, (77,))

    def test_ready_draft(self):
        self.assertEqual(classify(_course(1), _report(), 0).type, 'ready_to_publish')

    def test_unfinished_draft(self):
        item = classify(_course(1), _report(blockers=[_blocker('no_sections'), _blocker('missing_thumbnail')]), 0)
        self.assertEqual(item.type, 'draft_in_progress')
        self.assertEqual(item.blocker_count, 2)

    def test_published_course_with_failed_video_is_live_not_video_failed(self):
        report = _report('published', [_blocker(FAILED, {'kind': 'lecture', 'id': 9})])
        self.assertEqual(classify(_course(1, is_published=True), report, 5).type, 'live_needs_attention')

    def test_processing_video_is_never_flagged_as_failed(self):
        report = _report(blockers=[_blocker('lecture_video_processing', {'kind': 'lecture', 'id': 9})])
        self.assertEqual(classify(_course(1), report, 0).type, 'draft_in_progress')

    def test_one_failed_lecture_targets_lecture_two_target_course(self):
        one = classify(_course(1), _report(blockers=[_blocker(FAILED, {'kind': 'lecture', 'id': 4})]), 0)
        two = classify(
            _course(2),
            _report(blockers=[
                _blocker(FAILED, {'kind': 'lecture', 'id': 4}),
                _blocker(FAILED, {'kind': 'lecture', 'id': 5}),
            ]),
            0,
        )
        self.assertEqual((one.target.kind, one.target.lecture_id), ('lecture', 4))
        self.assertEqual((two.target.kind, two.target.lecture_id), ('course', None))

    def test_ranking_rules(self):
        now = timezone.now()
        live_few = classify(_course(1, True, now), _report('published', [_blocker('empty_section')]), 3)
        live_many = classify(_course(2, True, now), _report('published', [_blocker('empty_section')]), 800)
        draft_four = classify(_course(3, created_at=now), _report(blockers=[_blocker('x')] * 4), 0)
        draft_one = classify(_course(4, created_at=now), _report(blockers=[_blocker('x')]), 0)
        ready_old = classify(_course(5, created_at=now - timedelta(days=2)), _report(), 0)
        ready_new = classify(_course(6, created_at=now), _report(), 0)

        ranked = rank([draft_four, ready_old, live_few, draft_one, ready_new, live_many])

        # live by students desc, then ready newest first, then drafts by fewest blockers
        self.assertEqual([i.course.id for i in ranked], [2, 1, 6, 5, 4, 3])

    def test_equal_created_at_breaks_tie_by_id(self):
        now = timezone.now()
        a = classify(_course(10, created_at=now), _report(), 0)
        b = classify(_course(11, created_at=now), _report(), 0)
        self.assertEqual([i.course.id for i in rank([a, b])], [11, 10])


class NeedsAttentionTests(DashboardTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('dash_attention@test.com', 'dash_attention')

    def attention(self):
        return self.get_dashboard(self.user).data['needs_attention']

    def test_broken_live_course_listed_first(self):
        live = make_ready_course(self.profile, title='Live', is_published=True)
        break_one(live, 'lecture_video_missing')
        make_course(self.profile, title='Draft')

        items = self.attention()['items']

        self.assertEqual(items[0]['type'], 'live_needs_attention')
        self.assertEqual(items[0]['course']['id'], live.id)
        self.assertEqual(items[0]['target'], {'kind': 'course', 'course_id': live.id, 'lecture_id': None})

    def test_healthy_published_course_absent(self):
        healthy = make_ready_course(self.profile, title='Healthy', is_published=True)

        attention = self.attention()

        self.assertEqual(attention['total'], 0)
        self.assertNotIn(healthy.id, [i['course']['id'] for i in attention['items']])

    def test_draft_with_one_failed_video_targets_lecture(self):
        draft = make_ready_course(self.profile, title='Failing draft')
        lecture = Lecture.objects.filter(section__course=draft).order_by('section__order', 'order').first()
        Lecture.objects.filter(pk=lecture.pk).update(video_status='FAILED')

        item = self.attention()['items'][0]

        self.assertEqual(item['type'], 'video_failed')
        self.assertEqual(item['failed_lecture_ids'], [lecture.id])
        self.assertEqual(item['target'], {'kind': 'lecture', 'course_id': draft.id, 'lecture_id': lecture.id})

    def test_cap_of_five_with_total(self):
        for n in range(7):
            make_course(self.profile, title=f'Draft {n}')

        attention = self.attention()

        self.assertEqual(attention['total'], 7)
        self.assertEqual(len(attention['items']), 5)

    def test_each_course_listed_once_with_known_types(self):
        live = make_ready_course(self.profile, title='Live', is_published=True)
        break_one(live, 'lecture_video_failed')  # both a live problem and a failed video
        make_ready_course(self.profile, title='Ready')
        make_course(self.profile, title='Empty draft')

        items = self.attention()['items']
        ids = [i['course']['id'] for i in items]

        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue({i['type'] for i in items} <= {
            'live_needs_attention', 'video_failed', 'ready_to_publish', 'draft_in_progress',
        })
        self.assertEqual(next(i for i in items if i['course']['id'] == live.id)['type'], 'live_needs_attention')


# --------------------------------------------------------------------------
# US5 — Access (T025, T026)
# --------------------------------------------------------------------------

def _all_keys(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key
            yield from _all_keys(child)
    elif isinstance(value, list):
        for child in value:
            yield from _all_keys(child)


class AccessTests(DashboardTestCase):
    def setUp(self):
        super().setUp()
        self.user_a, self.profile_a = make_instructor('dash_a@test.com', 'dash_a')
        self.user_b, self.profile_b = make_instructor('dash_b@test.com', 'dash_b')

    def _populate(self, profile, label, amount):
        course = make_ready_course(profile, title=f'{label} live course', is_published=True)
        broken = make_course(profile, title=f'{label} broken draft')
        student = make_student(
            f'{label.lower()}_student@test.com', f'{label.lower()}_student',
            first_name=f'{label}Student', last_name='Learner',
        )
        enroll(student, course, amount=amount)
        review(student, course, rating=4, comment=f'{label} review')
        return course, broken, student

    def test_student_is_refused(self):
        student = make_student('dash_student@test.com', 'dash_student')
        self.assertEqual(self.get_dashboard(student).status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_is_refused(self):
        response = self.client.get(DASHBOARD_URL)
        self.assertIn(response.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_staff_without_profile_gets_handled_403(self):
        staff = CustomUser.objects.create_instructor(
            email='noprofile@test.com', password='pass1234', username='noprofile',
            role='instructor', is_active=True,
        )
        InstructorProfile.objects.filter(user=staff).delete()
        staff = CustomUser.objects.get(pk=staff.pk)  # drop the cached reverse relation

        response = self.get_dashboard(staff)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data, {
            'error': 'No instructor profile is associated with this account.',
            'code': 'no_instructor_profile',
        })

    def test_instructor_sees_only_own_data(self):
        a_course, a_broken, _ = self._populate(self.profile_a, 'Alpha', '10.00')
        b_course, b_broken, _ = self._populate(self.profile_b, 'Bravo', '99.00')

        data = self.get_dashboard(self.user_a).data
        dumped = json.dumps(data)

        self.assertEqual(data['courses']['total'], 2)
        self.assertEqual(data['students']['distinct'], 1)
        self.assertEqual(data['earnings']['amount'], '10.00')
        self.assertNotIn('Bravo', dumped)
        course_ids = [e['course']['id'] for e in data['recent_enrollments']]
        course_ids += [r['course']['id'] for r in data['recent_reviews']]
        course_ids += [i['course']['id'] for i in data['needs_attention']['items']]
        self.assertTrue(set(course_ids) <= {a_course.id, a_broken.id})

    def test_query_parameters_are_ignored(self):
        self._populate(self.profile_a, 'Alpha', '10.00')
        self._populate(self.profile_b, 'Bravo', '99.00')
        self.client.force_authenticate(user=self.user_a)

        data = self.client.get(DASHBOARD_URL, {'instructor': self.profile_b.id}).data

        self.assertEqual(data['earnings']['amount'], '10.00')
        self.assertNotIn('Bravo', json.dumps(data))

    def test_response_never_contains_email(self):
        _, _, student = self._populate(self.profile_a, 'Alpha', '10.00')

        data = self.get_dashboard(self.user_a).data
        dumped = json.dumps(data)

        # The fixture must actually put a student into both recent lists, or this
        # test proves nothing.
        self.assertEqual(len(data['recent_enrollments']), 1)
        self.assertEqual(len(data['recent_reviews']), 1)
        self.assertNotIn('email', set(_all_keys(data)))
        self.assertNotIn(student.email, dumped)
        self.assertNotIn(self.user_a.email, dumped)


# --------------------------------------------------------------------------
# US3 — Recent activity (T029)
# --------------------------------------------------------------------------

class RecentActivityTests(DashboardTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('dash_recent@test.com', 'dash_recent')
        self.course = make_course(self.profile, title='Recent course', is_published=True)

    def _students(self, n, prefix):
        return [make_student(f'{prefix}{i}@test.com', f'{prefix}{i}') for i in range(n)]

    def test_enrollments_newest_first_capped_at_five(self):
        base = timezone.now()
        enrollments = []
        for i, student in enumerate(self._students(7, 'enr')):
            enrollment = enroll(student, self.course)
            Enrollment.objects.filter(pk=enrollment.pk).update(enrolled_at=base - timedelta(days=i))
            enrollments.append(enrollment)

        recent = self.get_dashboard(self.user).data['recent_enrollments']

        self.assertEqual([e['id'] for e in recent], [e.id for e in enrollments[:5]])

    def test_inactive_and_other_instructors_enrollments_excluded(self):
        active, refunded, elsewhere = self._students(3, 'mix')
        enroll(active, self.course)
        enroll(refunded, self.course, status='refunded', active=False)
        _, other_profile = make_instructor('dash_other@test.com', 'dash_other')
        enroll(elsewhere, make_course(other_profile, title='Other course'))

        recent = self.get_dashboard(self.user).data['recent_enrollments']

        self.assertEqual(len(recent), 1)
        self.assertEqual(recent[0]['course'], {'id': self.course.id, 'title': 'Recent course'})

    def test_student_name_and_avatar(self):
        named = make_student('named@test.com', 'named_user', first_name='Sara', last_name='Ali',
                             profile_picture='https://img.example/sara.png')
        anonymous = make_student('blank@test.com', 'blank_user')
        first = enroll(named, self.course)
        second = enroll(anonymous, self.course)
        Enrollment.objects.filter(pk=first.pk).update(enrolled_at=timezone.now() - timedelta(days=1))
        Enrollment.objects.filter(pk=second.pk).update(enrolled_at=timezone.now())

        recent = self.get_dashboard(self.user).data['recent_enrollments']

        self.assertEqual(recent[0]['student'], {'name': 'blank_user', 'avatar': None})
        self.assertEqual(recent[1]['student'], {'name': 'Sara Ali', 'avatar': 'https://img.example/sara.png'})

    def test_reviews_newest_first_capped_at_five(self):
        base = timezone.now()
        reviews = []
        for i, student in enumerate(self._students(6, 'rev')):
            item = review(student, self.course, rating=5 - (i % 5))
            Review.objects.filter(pk=item.pk).update(created_at=base - timedelta(days=i))
            reviews.append(item)

        recent = self.get_dashboard(self.user).data['recent_reviews']

        self.assertEqual([r['id'] for r in recent], [r.id for r in reviews[:5]])
        self.assertEqual(recent[0]['course'], {'id': self.course.id, 'title': 'Recent course'})

    def test_review_on_draft_course_included_and_empty_comment(self):
        draft = make_course(self.profile, title='Draft course')
        student = make_student('drafter@test.com', 'drafter')
        review(student, draft, rating=3, comment='')

        recent = self.get_dashboard(self.user).data['recent_reviews']

        self.assertEqual(len(recent), 1)
        self.assertEqual(recent[0]['course']['id'], draft.id)
        self.assertEqual(recent[0]['comment'], '')
        self.assertEqual(recent[0]['rating'], 3)


# --------------------------------------------------------------------------
# US4 — Onboarding (T033)
# --------------------------------------------------------------------------

ALL_FALSE = {
    'profile_complete': False,
    'has_course': False,
    'has_curriculum': False,
    'has_ready_video': False,
    'has_published_course': False,
}


class OnboardingTests(DashboardTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('dash_onboard@test.com', 'dash_onboard')

    def snapshot(self):
        return self.get_dashboard(self.user).data

    def set_profile(self, title, about):
        InstructorProfile.objects.filter(pk=self.profile.pk).update(title=title, about=about)
        # force_authenticate reuses this user object, whose cached instructor_profile
        # would be stale; a real request loads the user fresh.
        self.user = CustomUser.objects.get(pk=self.user.pk)

    def test_no_courses_is_onboarding_with_nothing_done(self):
        data = self.snapshot()
        self.assertEqual(data['mode'], 'onboarding')
        self.assertEqual(data['onboarding'], ALL_FALSE)

    def test_profile_complete_needs_both_title_and_about(self):
        self.set_profile('Engineer', 'Bio')
        self.assertTrue(self.snapshot()['onboarding']['profile_complete'])

        self.set_profile('   ', 'Bio')
        self.assertFalse(self.snapshot()['onboarding']['profile_complete'])

        self.set_profile('Engineer', '')
        self.assertFalse(self.snapshot()['onboarding']['profile_complete'])

    def test_one_empty_draft_switches_to_full(self):
        make_course(self.profile)

        data = self.snapshot()

        self.assertEqual(data['mode'], 'full')
        self.assertTrue(data['onboarding']['has_course'])
        self.assertFalse(data['onboarding']['has_curriculum'])

    def test_curriculum_video_and_publish_steps(self):
        course = make_course(self.profile)
        section = Section.objects.create(course=course, title='Basics', order=0)
        self.assertFalse(self.snapshot()['onboarding']['has_curriculum'])

        lecture = Lecture.objects.create(section=section, title='Intro', duration=Decimal('5.00'), order=0)
        onboarding = self.snapshot()['onboarding']
        self.assertTrue(onboarding['has_curriculum'])
        self.assertFalse(onboarding['has_ready_video'])

        Lecture.objects.filter(pk=lecture.pk).update(video_status='COMPLETED', video_public_id='lms/x')
        onboarding = self.snapshot()['onboarding']
        self.assertTrue(onboarding['has_ready_video'])
        self.assertFalse(onboarding['has_published_course'])

        Course.objects.filter(pk=course.pk).update(is_published=True)
        self.assertTrue(self.snapshot()['onboarding']['has_published_course'])

    def test_deleting_only_course_returns_to_onboarding(self):
        course = make_course(self.profile)
        self.assertEqual(self.snapshot()['mode'], 'full')

        course.delete()

        self.assertEqual(self.snapshot()['mode'], 'onboarding')


# --------------------------------------------------------------------------
# Polish — resilience and query-count bound (T037)
# --------------------------------------------------------------------------

class ResilienceAndPerformanceTests(DashboardTestCase):
    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('dash_perf@test.com', 'dash_perf')
        self.student_n = 0

    def _populated_course(self, n):
        course = make_ready_course(self.profile, title=f'Populated {n}', is_published=n % 2 == 0)
        for _ in range(2):
            self.student_n += 1
            student = make_student(f'perf{self.student_n}@test.com', f'perf{self.student_n}')
            enroll(student, course)
        review(student, course, rating=4)
        return course

    def _count_queries(self):
        self.client.force_authenticate(user=self.user)
        with CaptureQueriesContext(connection) as ctx:
            response = self.client.get(DASHBOARD_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return len(ctx.captured_queries)

    @patch('apps.course.dashboard.service.PublishReadinessService.evaluate', side_effect=RuntimeError('boom'))
    def test_any_failure_returns_single_error_and_no_snapshot(self, _evaluate):
        make_course(self.profile)

        response = self.get_dashboard(self.user)

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(response.data, {'error': "We couldn't load your dashboard. Please try again."})
        self.assertFalse(SNAPSHOT_KEYS & set(response.data.keys()))

    def test_query_count_does_not_grow_with_courses(self):
        # Invariant I8: aggregates plus the shared READINESS_PREFETCH, never a query
        # per course. If this fails, something in the service is reading a relation
        # that isn't prefetched.
        self._populated_course(0)
        one_course = self._count_queries()

        for n in range(1, 10):
            self._populated_course(n)
        ten_courses = self._count_queries()

        self.assertEqual(one_course, ten_courses)
