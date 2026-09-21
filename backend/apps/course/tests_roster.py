"""010 — Instructor student roster. Unit tests for the progress rule first, then API tests grouped by user story."""
import json
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser, InstructorProfile
from apps.course.roster import build_progress_map
from apps.progress.models import LectureProgress

# Fixtures are reused, never redefined: the roster tests must build the same data shapes
# as the 008 and 009 suites, or a disagreement between them means nothing.
from apps.course.tests import make_course, make_instructor
from apps.course.tests_analytics import (
    _all_keys, add_section, complete_lectures, set_enrolled_at,
)
from apps.course.tests_dashboard import enroll, make_student

# Re-exported so later task classes can import everything from this module alone.
__all__ = [
    'RosterTestCase', 'ROW_KEYS', 'PAGE_KEYS',
    'make_course', 'make_instructor', 'make_student', 'enroll',
    'add_section', 'complete_lectures', 'set_enrolled_at', '_all_keys',
]


# --------------------------------------------------------------------------
# Fixtures (T003)
# --------------------------------------------------------------------------

# The exact key set of one roster row (contracts §2). T031 asserts equality against this,
# so an extra field added to the serializer fails a test instead of leaking quietly.
ROW_KEYS = {'id', 'name', 'avatar', 'enrolled_at', 'progress', 'course'}
COURSE_REF_KEYS = {'id', 'title'}
PAGE_KEYS = {'count', 'next', 'previous', 'results'}

# Page size is fixed on the server (FR-021); tests that cross a page boundary use this.
PAGE_SIZE = 20


class RosterTestCase(APITestCase):
    """Shared setUp and request helpers for every roster API test."""

    def setUp(self):
        super().setUp()
        # Fixtures that delete lectures or courses fire the video post_delete signal;
        # patch the provider so no test ever reaches Cloudinary. Copied from
        # AnalyticsTestCase (009) — same reason, same three targets.
        provider = MagicMock()
        for target in (
            'apps.course.serializers.get_video_provider',
            'apps.course.video.signals.get_video_provider',
            'apps.course.video.service.get_video_provider',
        ):
            patcher = patch(target, return_value=provider)
            patcher.start()
            self.addCleanup(patcher.stop)

        # No timezone.now patching: unlike analytics, the roster has no time windows.
        # enrolled_at values are set explicitly with set_enrolled_at where order matters.

    def url(self, course=None, search=None, page=None):
        """The roster URL, carrying only the parameters actually given.

        Omitted parameters are left off entirely rather than sent empty, so the server
        exercises its own defaults (contracts §1).

        Values are percent-encoded. That matters for the wildcard-escaping tests: a bare
        '%' written straight into a query string is an invalid escape sequence and gets
        mangled before the view ever sees it, so the test would pass for the wrong reason.
        """
        base = reverse('instructor_students')
        params = {}
        if course is not None:
            params['course'] = course
        if search is not None:
            params['search'] = search
        if page is not None:
            params['page'] = page
        return f'{base}?{urlencode(params)}' if params else base

    def get(self, user, url):
        self.client.force_authenticate(user=user)
        return self.client.get(url)

    def get_anonymous(self, url):
        self.client.force_authenticate(user=None)
        return self.client.get(url)


class SetupTests(SimpleTestCase):
    """Guards the imports above: a rename in tests.py or tests_analytics.py fails here."""

    def test_reused_fixtures_are_callable(self):
        for helper in (
            make_instructor, make_course, make_student, enroll,
            add_section, complete_lectures, set_enrolled_at, _all_keys,
        ):
            self.assertTrue(callable(helper), f'{helper!r} is not callable')

    def test_request_helpers_exist(self):
        for name in ('url', 'get', 'get_anonymous'):
            self.assertTrue(hasattr(RosterTestCase, name), f'RosterTestCase.{name} is missing')

    def test_row_key_set_matches_the_contract(self):
        # Spelled out so the contract and the fixture cannot drift apart silently.
        self.assertEqual(ROW_KEYS, {'id', 'name', 'avatar', 'enrolled_at', 'progress', 'course'})
        self.assertEqual(COURSE_REF_KEYS, {'id', 'title'})
        self.assertEqual(PAGE_KEYS, {'count', 'next', 'previous', 'results'})


# --------------------------------------------------------------------------
# T007 — the progress rule, unit-tested directly
# --------------------------------------------------------------------------

class ProgressMapUnitTests(TestCase):
    """build_progress_map in isolation: no HTTP, no serializer, no pagination.

    These are the assertions that stop a later refactor turning None into 0.0.
    """

    def setUp(self):
        super().setUp()
        _, self.profile = make_instructor('pm-owner@test.com', 'pmowner')
        self.course = make_course(self.profile, title='Ten lectures')
        self.section = add_section(self.course, order=1, lectures=10)
        self.lectures = list(self.section.lectures.order_by('order'))
        self.student = make_student('pm-student@test.com', 'pmstudent')

    def test_seven_of_ten_lectures_is_seventy_percent(self):
        enrollment = enroll(self.student, self.course)
        complete_lectures(self.student, self.lectures[:7])

        result = build_progress_map([enrollment])

        self.assertEqual(result[(self.student.id, self.course.id)], 70.0)

    def test_no_completions_is_zero_percent(self):
        enrollment = enroll(self.student, self.course)

        result = build_progress_map([enrollment])

        self.assertEqual(result[(self.student.id, self.course.id)], 0.0)

    def test_every_lecture_completed_is_one_hundred_percent(self):
        enrollment = enroll(self.student, self.course)
        complete_lectures(self.student, self.lectures)

        result = build_progress_map([enrollment])

        self.assertEqual(result[(self.student.id, self.course.id)], 100.0)

    def test_course_with_no_lectures_is_none_not_zero(self):
        empty_course = make_course(self.profile, title='No lectures yet')
        enrollment = enroll(self.student, empty_course)

        result = build_progress_map([enrollment])

        # assertIsNone, not assertFalse: 0.0 is falsy too, and 0% is exactly the
        # wrong answer here (FR-011, SC-007).
        self.assertIsNone(result[(self.student.id, empty_course.id)])

    def test_unfinished_lecture_progress_rows_do_not_count(self):
        enrollment = enroll(self.student, self.course)
        # is_completed defaults to False; these rows exist and must be ignored.
        for lecture in self.lectures[:4]:
            LectureProgress.objects.create(
                user=self.student.student_profile, lecture=lecture, is_completed=False,
            )

        result = build_progress_map([enrollment])

        self.assertEqual(result[(self.student.id, self.course.id)], 0.0)

    def test_one_student_in_two_courses_gets_independent_values(self):
        other = make_course(self.profile, title='Four lectures')
        other_lectures = list(add_section(other, order=1, lectures=4).lectures.order_by('order'))

        first = enroll(self.student, self.course)
        second = enroll(self.student, other)
        complete_lectures(self.student, self.lectures[:5])
        complete_lectures(self.student, other_lectures[:3])

        result = build_progress_map([first, second])

        self.assertEqual(result[(self.student.id, self.course.id)], 50.0)
        self.assertEqual(result[(self.student.id, other.id)], 75.0)

    def test_progress_is_keyed_per_pair_not_per_student(self):
        # Two students, same course, different progress: neither may read the other's.
        classmate = make_student('pm-mate@test.com', 'pmmate')
        mine = enroll(self.student, self.course)
        theirs = enroll(classmate, self.course)
        complete_lectures(self.student, self.lectures[:2])
        complete_lectures(classmate, self.lectures[:9])

        result = build_progress_map([mine, theirs])

        self.assertEqual(result[(self.student.id, self.course.id)], 20.0)
        self.assertEqual(result[(classmate.id, self.course.id)], 90.0)

    def test_empty_page_returns_empty_map_with_no_queries(self):
        with self.assertNumQueries(0):
            self.assertEqual(build_progress_map([]), {})

    def test_costs_two_queries_regardless_of_page_breadth(self):
        # 20 rows spanning 20 different courses: still two queries.
        enrollments = []
        for index in range(20):
            course = make_course(self.profile, title=f'Course {index}')
            add_section(course, order=1, lectures=3)
            student = make_student(f'pm-{index}@test.com', f'pm{index}')
            enrollments.append(enroll(student, course))

        with self.assertNumQueries(2):
            result = build_progress_map(enrollments)

        self.assertEqual(len(result), 20)


class Phase2SmokeTests(RosterTestCase):
    """A thin end-to-end check that the endpoint is wired up.

    The real per-story assertions arrive in T016+; this only proves the route resolves,
    the four queries run, and the row shape matches the contract.
    """

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('smoke-owner@test.com', 'smokeowner')
        self.course = make_course(self.profile, title='Smoke course')
        lectures = list(add_section(self.course, order=1, lectures=4).lectures.order_by('order'))
        self.student = make_student('smoke-stu@test.com', 'smokestu', first_name='Maria', last_name='Gomez')
        enroll(self.student, self.course)
        complete_lectures(self.student, lectures[:3])

    def test_route_resolves(self):
        self.assertEqual(reverse('instructor_students'), '/courses/instructor/students/')

    def test_page_and_row_shape_match_the_contract(self):
        response = self.get(self.owner, self.url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data.keys()), PAGE_KEYS)
        self.assertEqual(response.data['count'], 1)

        row = response.data['results'][0]
        self.assertEqual(set(row.keys()), ROW_KEYS)
        self.assertEqual(row['name'], 'Maria Gomez')
        self.assertEqual(row['progress'], 75.0)
        self.assertEqual(row['course']['title'], 'Smoke course')
        self.assertIsNone(row['avatar'])
        self.assertRegex(str(row['enrolled_at']), r'^\d{4}-\d{2}-\d{2}$')

    def test_course_scope_and_identical_refusals(self):
        _, other_profile = make_instructor('smoke-other@test.com', 'smokeother')
        other_course = make_course(other_profile, title='Not mine')

        owned = self.get(self.owner, self.url(course=self.course.id))
        self.assertEqual(owned.status_code, 200)
        self.assertEqual(owned.data['count'], 1)

        refusals = [
            self.get(self.owner, self.url(course=other_course.id)),
            self.get(self.owner, self.url(course=999999)),
            self.get(self.owner, self.url(course='abc')),
            self.get(self.owner, self.url(course=0)),
            self.get(self.owner, self.url(course=-1)),
        ]
        for response in refusals:
            self.assertEqual(response.status_code, 404)
        # Byte-identical bodies, or the endpoint leaks which ids exist (FR-032).
        self.assertEqual({str(r.data) for r in refusals}, {str(refusals[0].data)})

    def test_bad_page_falls_back_to_first_page(self):
        for bad in ('999', 'abc', '0', '-1'):
            response = self.get(self.owner, self.url(page=bad))
            self.assertEqual(response.status_code, 200, f'?page={bad} should not error')
            self.assertEqual(response.data['count'], 1)

    def test_last_page_string_resolves(self):
        response = self.get(self.owner, self.url(page='last'))
        self.assertEqual(response.status_code, 200)

    def test_costs_four_queries(self):
        with self.assertNumQueries(4):
            self.get(self.owner, self.url())


# --------------------------------------------------------------------------
# T016 / T017 / T018 — User Story 1: the rows themselves
# --------------------------------------------------------------------------

class RosterRowTests(RosterTestCase):
    """Every per-row field rule (FR-006 - FR-013)."""

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('rows-owner@test.com', 'rowsowner')
        self.course = make_course(self.profile, title='Ten lectures')
        self.lectures = list(add_section(self.course, order=1, lectures=10).lectures.order_by('order'))

    def _rows(self, **kwargs):
        response = self.get(self.owner, self.url(**kwargs))
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_refunded_enrollment_is_absent_from_rows_and_count(self):
        active = make_student('rows-active@test.com', 'rowsactive')
        refunded = make_student('rows-refunded@test.com', 'rowsrefunded')
        enroll(active, self.course)
        enroll(refunded, self.course, active=False)

        data = self._rows(course=self.course.id)

        self.assertEqual(data['count'], 1)
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['results'][0]['name'], 'rowsactive')

    def test_name_falls_back_to_username_when_both_name_fields_are_blank(self):
        student = make_student('rows-noname@test.com', 'nonameuser')
        enroll(student, self.course)

        row = self._rows(course=self.course.id)['results'][0]

        self.assertEqual(row['name'], 'nonameuser')
        self.assertNotEqual(row['name'].strip(), '')

    def test_full_name_is_first_and_last_together(self):
        student = make_student('rows-full@test.com', 'fulluser', first_name='Maria', last_name='Gomez')
        enroll(student, self.course)

        self.assertEqual(self._rows(course=self.course.id)['results'][0]['name'], 'Maria Gomez')

    def test_avatar_is_null_when_profile_picture_is_unset(self):
        student = make_student('rows-noav@test.com', 'noav')
        enroll(student, self.course)

        self.assertIsNone(self._rows(course=self.course.id)['results'][0]['avatar'])

    def test_avatar_is_the_profile_picture_when_set(self):
        picture = 'https://res.cloudinary.com/demo/image/upload/v1/x.jpg'
        student = make_student('rows-av@test.com', 'av', profile_picture=picture)
        enroll(student, self.course)

        self.assertEqual(self._rows(course=self.course.id)['results'][0]['avatar'], picture)

    def test_enrolled_at_is_a_bare_date(self):
        student = make_student('rows-date@test.com', 'rowsdate')
        enroll(student, self.course)

        row = self._rows(course=self.course.id)['results'][0]

        self.assertRegex(str(row['enrolled_at']), r'^\d{4}-\d{2}-\d{2}$')

    def test_progress_is_a_percent(self):
        student = make_student('rows-prog@test.com', 'rowsprog')
        enroll(student, self.course)
        complete_lectures(student, self.lectures[:7])

        self.assertEqual(self._rows(course=self.course.id)['results'][0]['progress'], 70.0)

    def test_course_with_no_lectures_gives_null_progress_not_zero(self):
        empty = make_course(self.profile, title='No lectures')
        student = make_student('rows-empty@test.com', 'rowsempty')
        enroll(student, empty)

        row = self._rows(course=empty.id)['results'][0]

        self.assertIsNone(row['progress'])

    def test_unfinished_progress_rows_do_not_count_over_http(self):
        student = make_student('rows-unfin@test.com', 'rowsunfin')
        enroll(student, self.course)
        for lecture in self.lectures[:5]:
            LectureProgress.objects.create(
                user=student.student_profile, lecture=lecture, is_completed=False,
            )

        self.assertEqual(self._rows(course=self.course.id)['results'][0]['progress'], 0.0)

    def test_student_in_two_owned_courses_yields_two_rows(self):
        other = make_course(self.profile, title='Four lectures')
        other_lectures = list(add_section(other, order=1, lectures=4).lectures.order_by('order'))
        student = make_student('rows-two@test.com', 'rowstwo')
        enroll(student, self.course)
        enroll(student, other)
        complete_lectures(student, self.lectures[:1])
        complete_lectures(student, other_lectures[:2])

        data = self._rows()

        self.assertEqual(data['count'], 2)
        by_course = {row['course']['id']: row for row in data['results']}
        self.assertEqual(by_course[self.course.id]['progress'], 10.0)
        self.assertEqual(by_course[other.id]['progress'], 50.0)
        self.assertNotEqual(
            by_course[self.course.id]['id'], by_course[other.id]['id'],
            'each row must carry its own enrolment id',
        )

    def test_course_is_present_in_both_scopes(self):
        student = make_student('rows-scope@test.com', 'rowsscope')
        enroll(student, self.course)

        for kwargs in ({}, {'course': self.course.id}):
            row = self._rows(**kwargs)['results'][0]
            self.assertEqual(set(row['course'].keys()), COURSE_REF_KEYS)
            self.assertEqual(row['course']['title'], 'Ten lectures')

    def test_row_id_is_the_enrollment_id(self):
        student = make_student('rows-id@test.com', 'rowsid')
        enrollment = enroll(student, self.course)

        self.assertEqual(self._rows(course=self.course.id)['results'][0]['id'], enrollment.id)


class ProgressAgreementTests(RosterTestCase):
    """The roster's progress must equal what the student sees for the same course.

    FR-010 makes this an invariant rather than a coincidence: an instructor reads the
    roster to answer a student, so the two numbers have to match. Deliberately NOT 009's
    stricter analytics rule (every lecture completed AND every quiz passed) — a roster row
    can read 100% for a student analytics does not count as having completed the course.
    """

    def test_roster_and_student_dashboard_report_the_same_progress(self):
        owner, profile = make_instructor('agree-owner@test.com', 'agreeowner')
        course = make_course(profile, title='Agreement', is_published=True)
        lectures = list(add_section(course, order=1, lectures=8).lectures.order_by('order'))
        student = make_student('agree-stu@test.com', 'agreestu')
        enroll(student, course)
        complete_lectures(student, lectures[:3])

        roster = self.get(owner, self.url(course=course.id))
        self.assertEqual(roster.status_code, 200)
        roster_progress = roster.data['results'][0]['progress']

        self.client.force_authenticate(user=student)
        student_view = self.client.get(reverse('student_courses'))
        self.assertEqual(student_view.status_code, 200)
        student_progress = next(
            row['progress'] for row in student_view.data if str(row['id']) == str(course.id)
        )

        self.assertEqual(roster_progress, student_progress)
        self.assertEqual(roster_progress, 37.5)


class RosterOrderingTests(RosterTestCase):
    """The sort must be total, or paging repeats and skips with no writes (SC-003, R5)."""

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('order-owner@test.com', 'orderowner')
        self.course = make_course(self.profile, title='Ordering')

    def test_newest_enrollment_first(self):
        base = datetime(2026, 7, 1, 12, 0, tzinfo=dt_timezone.utc)
        expected = []
        for index in range(3):
            student = make_student(f'order-{index}@test.com', f'order{index}')
            enrollment = enroll(student, self.course)
            set_enrolled_at(enrollment, base + timedelta(days=index))
            expected.append(enrollment.id)

        rows = self.get(self.owner, self.url(course=self.course.id)).data['results']

        self.assertEqual([row['id'] for row in rows], list(reversed(expected)))

    def test_tied_timestamps_come_back_in_the_same_order_twice(self):
        tie = datetime(2026, 7, 1, 12, 0, tzinfo=dt_timezone.utc)
        for index in range(6):
            student = make_student(f'tie-{index}@test.com', f'tie{index}')
            set_enrolled_at(enroll(student, self.course), tie)

        first = [row['id'] for row in self.get(self.owner, self.url(course=self.course.id)).data['results']]
        second = [row['id'] for row in self.get(self.owner, self.url(course=self.course.id)).data['results']]

        self.assertEqual(first, second)

    def test_pages_of_a_tied_roster_are_disjoint_and_complete(self):
        # 25 enrolments sharing one timestamp, straddling the 20-row page boundary. This
        # is the case that fails intermittently without the '-id' tiebreak.
        tie = datetime(2026, 7, 1, 12, 0, tzinfo=dt_timezone.utc)
        created = set()
        for index in range(PAGE_SIZE + 5):
            student = make_student(f'span-{index}@test.com', f'span{index}')
            enrollment = enroll(student, self.course)
            set_enrolled_at(enrollment, tie)
            created.add(enrollment.id)

        page_one = self.get(self.owner, self.url(course=self.course.id)).data['results']
        page_two = self.get(self.owner, self.url(course=self.course.id, page=2)).data['results']

        ids_one = [row['id'] for row in page_one]
        ids_two = [row['id'] for row in page_two]

        self.assertEqual(len(ids_one), PAGE_SIZE)
        self.assertEqual(len(ids_two), 5)
        self.assertEqual(set(ids_one) & set(ids_two), set(), 'pages must not repeat a student')
        self.assertEqual(set(ids_one) | set(ids_two), created, 'pages must not skip a student')


# --------------------------------------------------------------------------
# T024 — User Story 2: search
# --------------------------------------------------------------------------

class RosterSearchTests(RosterTestCase):
    """FR-014 - FR-019.

    Most of this behaviour comes from SearchFilter's configuration rather than from code
    in the view, which is exactly why it needs tests: nothing in views.py states it.
    """

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('search-owner@test.com', 'searchowner')
        self.course = make_course(self.profile, title='Searchable')
        self.maria = make_student('s-maria@test.com', 'mgomez', first_name='Maria', last_name='Gomez')
        self.marco = make_student('s-marco@test.com', 'mrossi', first_name='Marco', last_name='Rossi')
        self.ahmed = make_student('s-ahmed@test.com', 'a_mansour', first_name='Ahmed', last_name='Mansour')
        self.odd = make_student('s-odd@test.com', 'fifty%off')
        for student in (self.maria, self.marco, self.ahmed, self.odd):
            enroll(student, self.course)

    def _names(self, term):
        response = self.get(self.owner, self.url(course=self.course.id, search=term))
        self.assertEqual(response.status_code, 200)
        return {row['name'] for row in response.data['results']}, response.data['count']

    def test_partial_match_on_first_name(self):
        names, count = self._names('mar')
        self.assertEqual(names, {'Maria Gomez', 'Marco Rossi'})
        self.assertEqual(count, 2)

    def test_search_is_case_insensitive(self):
        self.assertEqual(self._names('MARIA')[0], {'Maria Gomez'})
        self.assertEqual(self._names('maria')[0], {'Maria Gomez'})

    def test_surname_only_matches(self):
        self.assertEqual(self._names('rossi')[0], {'Marco Rossi'})

    def test_full_name_matches_across_both_fields(self):
        # SearchFilter ANDs whitespace-separated terms, ORing each across the fields.
        self.assertEqual(self._names('maria gomez')[0], {'Maria Gomez'})
        self.assertEqual(self._names('gomez maria')[0], {'Maria Gomez'})

    def test_full_name_of_two_different_people_matches_nobody(self):
        self.assertEqual(self._names('maria rossi')[0], set())

    def test_username_is_searchable_because_it_is_the_displayed_fallback(self):
        self.assertEqual(self._names('a_mansour')[0], {'Ahmed Mansour'})

    def test_a_lone_percent_matches_only_a_literal_percent(self):
        # The decisive form. A bare '%' reaching the LIKE pattern makes it '%%%', which
        # matches EVERY row; escaped, it matches only the one name containing a percent
        # sign. Searching 'fifty%' would pass either way, so it proves nothing.
        names, count = self._names('%')

        self.assertEqual(names, {'fifty%off'})
        self.assertEqual(count, 1, 'a lone % must not behave as a wildcard')

    def test_a_lone_underscore_matches_only_a_literal_underscore(self):
        # Same reasoning: '_' as a wildcard matches any single character, so it would
        # return all four students. Escaped, only the username with an underscore.
        names, count = self._names('_')

        self.assertEqual(names, {'Ahmed Mansour'})
        self.assertEqual(count, 1, 'a lone _ must not behave as a wildcard')

    def test_percent_inside_a_longer_term_still_matches(self):
        self.assertEqual(self._names('fifty%off')[0], {'fifty%off'})

    def test_whitespace_only_search_is_treated_as_no_search(self):
        _names, count = self._names('   ')
        self.assertEqual(count, 4)

    def test_count_reflects_matches_not_the_whole_roster(self):
        _names, count = self._names('gomez')
        self.assertEqual(count, 1)

    def test_no_matches_returns_an_empty_page_not_an_error(self):
        response = self.get(self.owner, self.url(course=self.course.id, search='zzzznobody'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])

    def test_search_covers_the_whole_roster_not_the_current_page(self):
        # Bury a match beyond the first page, then find it on page 1 of the search.
        tie = datetime(2026, 7, 1, 12, 0, tzinfo=dt_timezone.utc)
        for index in range(PAGE_SIZE + 5):
            filler = make_student(f'filler-{index}@test.com', f'filler{index}')
            set_enrolled_at(enroll(filler, self.course), tie)
        # The needle is the oldest enrolment, so it sorts last of all.
        needle = make_student('needle@test.com', 'zzneedle', first_name='Unique', last_name='Needle')
        set_enrolled_at(enroll(needle, self.course), datetime(2020, 1, 1, tzinfo=dt_timezone.utc))

        unfiltered = self.get(self.owner, self.url(course=self.course.id)).data
        self.assertNotIn('Unique Needle', {row['name'] for row in unfiltered['results']})

        names, count = self._names('needle')
        self.assertEqual(names, {'Unique Needle'})
        self.assertEqual(count, 1)

    def test_search_applies_in_the_aggregate_scope_too(self):
        other = make_course(self.profile, title='Second course')
        enroll(self.maria, other)

        response = self.get(self.owner, self.url(search='gomez'))

        self.assertEqual(response.data['count'], 2)
        self.assertEqual(
            {row['course']['id'] for row in response.data['results']},
            {self.course.id, other.id},
        )


# --------------------------------------------------------------------------
# T027 — User Story 3: paging
# --------------------------------------------------------------------------

class RosterPagingTests(RosterTestCase):
    """FR-021 - FR-025, including the bad-page inputs DRF would answer with a 404."""

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('page-owner@test.com', 'pageowner')
        self.course = make_course(self.profile, title='Paged')
        base = datetime(2026, 7, 1, 12, 0, tzinfo=dt_timezone.utc)
        self.total = PAGE_SIZE * 2 + 5  # 45 -> three pages
        for index in range(self.total):
            student = make_student(f'page-{index}@test.com', f'page{index}')
            set_enrolled_at(enroll(student, self.course), base + timedelta(minutes=index))

    def test_page_size_is_twenty(self):
        data = self.get(self.owner, self.url(course=self.course.id)).data
        self.assertEqual(len(data['results']), PAGE_SIZE)
        self.assertEqual(data['count'], self.total)

    def test_first_page_has_no_previous(self):
        data = self.get(self.owner, self.url(course=self.course.id)).data
        self.assertIsNone(data['previous'])
        self.assertIsNotNone(data['next'])

    def test_middle_page_has_both_links(self):
        data = self.get(self.owner, self.url(course=self.course.id, page=2)).data
        self.assertIsNotNone(data['previous'])
        self.assertIsNotNone(data['next'])
        self.assertEqual(len(data['results']), PAGE_SIZE)

    def test_last_page_has_no_next_and_the_remainder(self):
        data = self.get(self.owner, self.url(course=self.course.id, page=3)).data
        self.assertIsNone(data['next'])
        self.assertIsNotNone(data['previous'])
        self.assertEqual(len(data['results']), 5)

    def test_consecutive_pages_neither_repeat_nor_skip(self):
        seen = []
        for page in (1, 2, 3):
            seen += [
                row['id']
                for row in self.get(self.owner, self.url(course=self.course.id, page=page)).data['results']
            ]

        self.assertEqual(len(seen), self.total)
        self.assertEqual(len(set(seen)), self.total)

    def test_bad_page_values_fall_back_to_the_first_page_with_200(self):
        first_ids = [
            row['id'] for row in self.get(self.owner, self.url(course=self.course.id)).data['results']
        ]

        for bad in ('999', 'abc', '0', '-1', '1.5', ''):
            response = self.get(self.owner, self.url(course=self.course.id, page=bad))
            self.assertEqual(response.status_code, 200, f'?page={bad} must not error')
            self.assertEqual(
                [row['id'] for row in response.data['results']], first_ids,
                f'?page={bad} must return the first page',
            )

    def test_page_last_resolves_to_the_last_page(self):
        response = self.get(self.owner, self.url(course=self.course.id, page='last'))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), 5)
        self.assertIsNone(response.data['next'])

    def test_paging_applies_to_search_results_only(self):
        for index in range(25):
            student = make_student(
                f'match-{index}@test.com', f'match{index}',
                first_name='Pat', last_name='Searchable',
            )
            enroll(student, self.course)

        first = self.get(self.owner, self.url(course=self.course.id, search='Searchable')).data
        second = self.get(self.owner, self.url(course=self.course.id, search='Searchable', page=2)).data

        self.assertEqual(first['count'], 25)
        self.assertEqual(len(first['results']), PAGE_SIZE)
        self.assertEqual(len(second['results']), 5)
        self.assertIsNone(second['next'])

    def test_single_page_roster_has_no_links_either_way(self):
        small = make_course(self.profile, title='Small')
        enroll(make_student('small@test.com', 'small'), small)

        data = self.get(self.owner, self.url(course=small.id)).data

        self.assertEqual(data['count'], 1)
        self.assertIsNone(data['next'])
        self.assertIsNone(data['previous'])


# --------------------------------------------------------------------------
# T030 / T031 — User Story 5: access and privacy
# --------------------------------------------------------------------------

class RosterAccessTests(RosterTestCase):
    """US5 has almost no code of its own, so these assertions are the story."""

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('acc-owner@test.com', 'accowner')
        self.course = make_course(self.profile, title='Mine')
        self.my_student = make_student('acc-mine@test.com', 'accmine')
        self.my_enrollment = enroll(self.my_student, self.course)

        self.other, self.other_profile = make_instructor('acc-other@test.com', 'accother')
        self.other_course = make_course(self.other_profile, title='Theirs')
        self.their_student = make_student('acc-theirs@test.com', 'acctheirs')
        self.their_enrollment = enroll(self.their_student, self.other_course)

    def test_the_bad_course_ids_are_indistinguishable(self):
        responses = [
            self.get(self.owner, self.url(course=self.other_course.id)),
            self.get(self.owner, self.url(course=999999)),
            self.get(self.owner, self.url(course='abc')),
            self.get(self.owner, self.url(course=0)),
            self.get(self.owner, self.url(course=-1)),
        ]

        for response in responses:
            self.assertEqual(response.status_code, 404)
        # Same status AND same body, or the endpoint reveals which ids exist (FR-032).
        bodies = {json.dumps(response.data, sort_keys=True, default=str) for response in responses}
        self.assertEqual(len(bodies), 1, f'refusal bodies differ: {bodies}')

    def test_a_refusal_leaks_no_student_or_course_data(self):
        response = self.get(self.owner, self.url(course=self.other_course.id))

        body = json.dumps(response.data, default=str)
        self.assertNotIn('acctheirs', body)
        self.assertNotIn('Theirs', body)

    def test_aggregate_scope_never_includes_another_instructors_students(self):
        mine = self.get(self.owner, self.url())
        theirs = self.get(self.other, self.url())

        self.assertEqual([row['id'] for row in mine.data['results']], [self.my_enrollment.id])
        self.assertEqual([row['id'] for row in theirs.data['results']], [self.their_enrollment.id])

    def test_a_student_caller_is_refused(self):
        self.assertEqual(self.get(self.my_student, self.url()).status_code, 403)

    def test_an_anonymous_caller_is_refused(self):
        self.assertIn(self.get_anonymous(self.url()).status_code, (401, 403))

    def test_staff_without_an_instructor_profile_is_refused_cleanly(self):
        staff = CustomUser.objects.create_user(
            email='acc-staff@test.com', password='pass1234', username='accstaff',
            role='instructor', is_active=True,
        )
        staff.is_staff = True
        staff.save(update_fields=['is_staff'])
        InstructorProfile.objects.filter(user=staff).delete()
        staff.refresh_from_db()

        response = self.get(staff, self.url())

        # A handled 403 carrying 009's code — never a 500, and never a 200 empty page
        # that would read as "you have no students yet" (FR-029, FR-034).
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data.get('code'), 'no_instructor_profile')

    def test_write_methods_are_rejected(self):
        self.client.force_authenticate(user=self.owner)
        url = self.url()
        for method in (self.client.post, self.client.put, self.client.patch, self.client.delete):
            self.assertEqual(method(url).status_code, 405)


class RosterPrivacyTests(RosterTestCase):
    """Asserted over the RAW body, so a convenient extra field fails here (FR-033, SC-005)."""

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('priv-owner@test.com', 'privowner')
        self.course = make_course(self.profile, title='Private')
        lectures = list(
            add_section(self.course, order=1, lectures=4, quiz=True).lectures.order_by('order')
        )
        self.student = make_student(
            'priv-student@test.com', 'privstudent', first_name='Priv', last_name='Student',
        )
        enroll(self.student, self.course)
        complete_lectures(self.student, lectures[:2])

    def test_row_keys_are_exactly_the_contract(self):
        row = self.get(self.owner, self.url()).data['results'][0]

        self.assertEqual(set(row.keys()), ROW_KEYS)
        self.assertEqual(set(row['course'].keys()), COURSE_REF_KEYS)

    def test_no_forbidden_key_appears_anywhere_in_the_body(self):
        response = self.get(self.owner, self.url())

        keys = set(_all_keys(response.data))
        forbidden = {
            'email', 'phone', 'order', 'orders', 'transaction', 'transactions',
            'amount', 'price', 'receipt_url', 'quiz', 'quizzes', 'score', 'passed',
            'lecture', 'lectures', 'lecture_id', 'user', 'user_id', 'student_id',
            'is_active', 'profile_picture',
        }
        self.assertEqual(keys & forbidden, set(), f'forbidden keys present: {keys & forbidden}')

    def test_the_students_email_never_appears_in_the_serialized_text(self):
        body = json.dumps(self.get(self.owner, self.url()).data, default=str)

        self.assertNotIn('priv-student@test.com', body)
        self.assertNotIn('@test.com', body)


# --------------------------------------------------------------------------
# T033 — User Story 4: the aggregate scope
# --------------------------------------------------------------------------

class AggregateScopeTests(RosterTestCase):
    """The no-course scope (FR-026 - FR-029). Security is covered by RosterAccessTests."""

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('agg-owner@test.com', 'aggowner')
        self.first = make_course(self.profile, title='First', is_published=True)
        self.second = make_course(self.profile, title='Second', is_published=True)
        # A draft course with students still shows its roster (plan.md Assumptions).
        self.draft = make_course(self.profile, title='Draft', is_published=False)
        self.empty = make_course(self.profile, title='Nobody enrolled')

    def test_lists_students_from_every_owned_course_including_drafts(self):
        base = datetime(2026, 7, 1, 12, 0, tzinfo=dt_timezone.utc)
        for index, course in enumerate((self.first, self.second, self.draft)):
            student = make_student(f'agg-{index}@test.com', f'agg{index}')
            set_enrolled_at(enroll(student, course), base + timedelta(days=index))

        data = self.get(self.owner, self.url()).data

        self.assertEqual(data['count'], 3)
        self.assertEqual(
            {row['course']['title'] for row in data['results']},
            {'First', 'Second', 'Draft'},
        )

    def test_a_student_in_two_courses_appears_once_per_course(self):
        student = make_student('agg-both@test.com', 'aggboth')
        first_lectures = list(add_section(self.first, order=1, lectures=4).lectures.order_by('order'))
        add_section(self.second, order=1, lectures=2)
        enroll(student, self.first)
        enroll(student, self.second)
        complete_lectures(student, first_lectures[:1])

        data = self.get(self.owner, self.url()).data

        self.assertEqual(data['count'], 2)
        by_course = {row['course']['id']: row for row in data['results']}
        self.assertEqual(by_course[self.first.id]['progress'], 25.0)
        self.assertEqual(by_course[self.second.id]['progress'], 0.0)

    def test_ordering_pools_all_courses_rather_than_grouping_by_course(self):
        base = datetime(2026, 7, 1, 12, 0, tzinfo=dt_timezone.utc)
        # Alternate courses, so grouping by course would give a different order.
        expected = []
        for index in range(4):
            course = self.first if index % 2 == 0 else self.second
            student = make_student(f'agg-ord-{index}@test.com', f'aggord{index}')
            enrollment = enroll(student, course)
            set_enrolled_at(enrollment, base + timedelta(days=index))
            expected.append(enrollment.id)

        rows = self.get(self.owner, self.url()).data['results']

        self.assertEqual([row['id'] for row in rows], list(reversed(expected)))

    def test_an_instructor_with_courses_but_no_students_gets_an_empty_page(self):
        response = self.get(self.owner, self.url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])

    def test_an_instructor_with_no_courses_at_all_gets_an_empty_page(self):
        newcomer, _profile = make_instructor('agg-new@test.com', 'aggnew')

        response = self.get(newcomer, self.url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 0)


# --------------------------------------------------------------------------
# T036 — the query plan
# --------------------------------------------------------------------------

class RosterPerformanceTests(RosterTestCase):
    """A fixed query plan, flat in the number of rows.

    Aggregate scope: 4 — DRF's COUNT(*), the page, lecture totals, completions.
    Course scope:    5 — the same four, plus resolving `?course=` against the owned set.

    That fifth query is the ownership check (FR-032), and it cannot be folded into the
    main queryset: an owned course with no students has to stay distinguishable from a
    course the caller does not own, and an empty result cannot tell those apart.

    These are the guard against a SerializerMethodField quietly reintroducing the per-row
    version (~40 queries a page). If a number moves, read roster.py's docstring first.
    """

    COURSE_SCOPE_QUERIES = 5
    AGGREGATE_SCOPE_QUERIES = 4

    def setUp(self):
        super().setUp()
        self.owner, self.profile = make_instructor('perf-owner@test.com', 'perfowner')

    def _fill_one_course(self):
        course = make_course(self.profile, title='One course')
        lectures = list(add_section(course, order=1, lectures=5).lectures.order_by('order'))
        for index in range(PAGE_SIZE + 3):
            student = make_student(f'perf-a-{index}@test.com', f'perfa{index}')
            enroll(student, course)
            complete_lectures(student, lectures[: index % 5])
        return course

    def test_query_plan_for_a_full_page_in_the_course_scope(self):
        course = self._fill_one_course()

        with self.assertNumQueries(self.COURSE_SCOPE_QUERIES):
            response = self.get(self.owner, self.url(course=course.id))
        self.assertEqual(len(response.data['results']), PAGE_SIZE)

    def test_query_plan_for_a_full_page_in_the_aggregate_scope(self):
        self._fill_one_course()

        with self.assertNumQueries(self.AGGREGATE_SCOPE_QUERIES):
            response = self.get(self.owner, self.url())
        self.assertEqual(len(response.data['results']), PAGE_SIZE)

    def test_query_plan_is_flat_when_the_page_spans_twenty_different_courses(self):
        for index in range(PAGE_SIZE):
            course = make_course(self.profile, title=f'Course {index}')
            add_section(course, order=1, lectures=3)
            student = make_student(f'perf-b-{index}@test.com', f'perfb{index}')
            enroll(student, course)

        with self.assertNumQueries(self.AGGREGATE_SCOPE_QUERIES):
            response = self.get(self.owner, self.url())
        self.assertEqual(len(response.data['results']), PAGE_SIZE)

    def test_search_adds_no_query(self):
        course = self._fill_one_course()

        with self.assertNumQueries(self.COURSE_SCOPE_QUERIES):
            self.get(self.owner, self.url(course=course.id, search='perfa'))
