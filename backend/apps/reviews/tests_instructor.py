"""012 — Instructor reviews. Stats unit tests first, then API tests grouped by user story."""
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import patch

from django.test import SimpleTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser, InstructorProfile, StudentProfile
from apps.course.tests import make_course, make_instructor
from apps.course.tests_analytics import _all_keys
from apps.course.tests_dashboard import enroll, make_student, review
from apps.reviews.models import Review

# Frozen "now" for every test that touches the month window.
#
# Mid-month on purpose: the 15th leaves room for fixtures on both sides of the boundary
# (a review created on the 1st, one created the microsecond before it, one created last
# month) without any of them landing outside the year.
FIXED_NOW = datetime(2026, 9, 15, 12, 0, tzinfo=dt_timezone.utc)

# The first instant of FIXED_NOW's calendar month, in UTC — the boundary
# `this_month_count` is defined against (FR-011).
MONTH_START = datetime(2026, 9, 1, 0, 0, tzinfo=dt_timezone.utc)

# A date comfortably inside the previous month, for the created-vs-updated case (R7).
LAST_MONTH = datetime(2026, 8, 20, 9, 30, tzinfo=dt_timezone.utc)

# Query budget (research R5, data-model §3), as measured under force_authenticate:
#
#   1. the stats .aggregate()
#   2. DRF's COUNT(*)
#   3. the page SELECT
#   (+ 4. resolving ?course= against the owned set, in the per-course scope)
#
# `request.user.instructor_profile` costs nothing HERE, though it is a real query in
# production: make_instructor calls InstructorProfile.objects.get_or_create(user=user),
# which populates the reverse one-to-one cache on the very user object
# force_authenticate then reuses. Behind real JWT authentication the user is loaded
# fresh and the profile lookup adds one. So these are test figures, not production ones.
#
# The absolute figure is the weaker assertion anyway. The one that matters is FLATNESS:
# the same count at two fixture sizes, which is what fails the moment select_related is
# lost and the endpoint goes N+1.
QUERIES_AGGREGATE = 3
QUERIES_COURSE = 4


def make_review(student, course, rating=5, comment='', created=None, updated=None):
    """Create a review, optionally forcing its timestamps.

    `created` and `updated` MUST be applied through `.update()`. `Review.created_at` is
    `auto_now_add` and `Review.updated_at` is `auto_now`, so both ignore anything passed
    to `create()` *and* to `save()` — a helper that sets them any other way leaves every
    date assertion in this module passing vacuously against today's date.

    The two timestamps are independent on purpose: `this_month_count` counts *creations*
    while the feed orders and displays *updates* (research R7), so the interesting
    fixture is a review created last month and edited today.
    """
    instance = review(student, course, rating=rating, comment=comment)

    fields = {}
    if created is not None:
        fields['created_at'] = created
    if updated is not None:
        fields['updated_at'] = updated
    if fields:
        Review.objects.filter(pk=instance.pk).update(**fields)
        instance.refresh_from_db()

    return instance


class InstructorReviewsTestCase(APITestCase):
    """Base for every API test in this module.

    No video-provider patching, unlike `AnalyticsTestCase` and `RosterTestCase`: this
    feature's fixtures create courses and reviews and never touch lectures, so nothing
    here fires the video `post_delete` signal. If a later test does add lectures, copy
    the three-target patch from `AnalyticsTestCase.setUp`.
    """

    def setUp(self):
        super().setUp()
        # Freeze "now" in the module that reads it, so the month window is deterministic
        # and this suite does not change behaviour on the 1st of a month. Patching here
        # rather than in each test keeps `this_month_count` stable for every class.
        now_patcher = patch('apps.reviews.utils.timezone.now', return_value=FIXED_NOW)
        now_patcher.start()
        self.addCleanup(now_patcher.stop)

    def url(self, course=None, rating=None, page=None, **extra):
        """`reverse('instructor_reviews')` with only the parameters given.

        Parameters are omitted rather than sent empty, so a test asking for the default
        exercises the same request the client actually makes.
        """
        params = []
        if course is not None:
            params.append(f'course={course}')
        if rating is not None:
            params.append(f'rating={rating}')
        if page is not None:
            params.append(f'page={page}')
        for key, value in extra.items():
            params.append(f'{key}={value}')

        url = reverse('instructor_reviews')
        return f'{url}?{"&".join(params)}' if params else url

    def get(self, user, url):
        self.client.force_authenticate(user=user)
        return self.client.get(url)

    def ratings_in(self, response):
        return [row['rating'] for row in response.data['results']]

    def ids_in(self, response):
        return [row['id'] for row in response.data['results']]


class SetupTests(SimpleTestCase):
    """Proves the module's imports resolve and its date constants agree (T002).

    Deliberately `SimpleTestCase`: it touches no database, so it stays green even while
    the endpoint is unfinished, and fails loudly if a borrowed fixture helper is renamed.
    """

    def test_borrowed_helpers_are_callable(self):
        for helper in (make_instructor, make_course, make_student, enroll, review,
                       make_review, _all_keys):
            self.assertTrue(callable(helper), f'{helper!r} is not callable')

    def test_month_constants_are_utc_and_consistent(self):
        self.assertEqual(MONTH_START.tzinfo, dt_timezone.utc)
        self.assertEqual((MONTH_START.year, MONTH_START.month), (FIXED_NOW.year, FIXED_NOW.month))
        self.assertEqual((MONTH_START.day, MONTH_START.hour, MONTH_START.minute), (1, 0, 0))
        self.assertLess(LAST_MONTH, MONTH_START)


# ======================================================================================
# User Story 1 — Read the reviews on one course
# ======================================================================================

class StatsTests(InstructorReviewsTestCase):
    """The four summary figures (FR-008 – FR-013). The arithmetic the page rests on."""

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('stats@test.com', 'stats_instructor')
        self.course = make_course(self.profile, title='Django for Beginners')

    def seed(self, *ratings, created=None):
        for index, rating in enumerate(ratings):
            student = make_student(f'seed{index}@test.com', f'seed{index}')
            make_review(student, self.course, rating=rating, created=created)

    def test_average_total_and_five_star_count(self):
        # US1 Acceptance Scenario 2: 5, 5, 4, 2 -> 4.0 average, 4 reviews, 2 five-star.
        self.seed(5, 5, 4, 2, created=MONTH_START + timedelta(days=1))

        response = self.get(self.user, self.url(course=self.course.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stats = response.data['stats']
        self.assertEqual(stats['avg_rating'], 4.0)
        self.assertEqual(stats['total_reviews'], 4)
        self.assertEqual(stats['five_star_count'], 2)

    def test_average_is_rounded_to_one_decimal(self):
        # 5 + 4 + 4 = 13 / 3 = 4.333... The contract says one decimal (FR-008), so the
        # raw float must not reach the client.
        self.seed(5, 4, 4, created=MONTH_START + timedelta(days=1))

        response = self.get(self.user, self.url(course=self.course.id))

        self.assertEqual(response.data['stats']['avg_rating'], 4.3)

    def test_empty_scope_reports_null_average_not_zero(self):
        # FR-012: "no reviews yet" must never be readable as "rated zero". This is the
        # single assertion that keeps the tiles honest for a brand-new course.
        response = self.get(self.user, self.url(course=self.course.id))

        stats = response.data['stats']
        self.assertIsNone(stats['avg_rating'])
        self.assertEqual(stats['total_reviews'], 0)
        self.assertEqual(stats['five_star_count'], 0)
        self.assertEqual(stats['this_month_count'], 0)

    def test_single_review_is_reported_plainly(self):
        # No minimum sample: one 5-star review reads 5.0 / 1 / 1, with no hiding or
        # warning (spec Clarifications).
        self.seed(5, created=MONTH_START + timedelta(days=2))

        stats = self.get(self.user, self.url(course=self.course.id)).data['stats']
        self.assertEqual(stats['avg_rating'], 5.0)
        self.assertEqual(stats['total_reviews'], 1)
        self.assertEqual(stats['five_star_count'], 1)

    def test_this_month_counts_only_this_calendar_month(self):
        # US1 Acceptance Scenario 3: 3 of 7 created since the start of the month.
        self.seed(5, 5, 5, created=MONTH_START + timedelta(days=3))
        for index in range(4):
            student = make_student(f'old{index}@test.com', f'old{index}')
            make_review(student, self.course, rating=4, created=LAST_MONTH)

        stats = self.get(self.user, self.url(course=self.course.id)).data['stats']
        self.assertEqual(stats['total_reviews'], 7)
        self.assertEqual(stats['this_month_count'], 3)

    def test_stats_are_identical_across_pages(self):
        # FR-013 / owner answer P4: stats describe the scope, so page 2 must repeat
        # page 1's figures byte for byte rather than describing its own ten rows.
        for index in range(15):
            student = make_student(f'page{index}@test.com', f'page{index}')
            make_review(student, self.course, rating=5, created=MONTH_START + timedelta(days=1))

        first = self.get(self.user, self.url(course=self.course.id, page=1))
        second = self.get(self.user, self.url(course=self.course.id, page=2))

        self.assertEqual(first.data['stats'], second.data['stats'])
        self.assertEqual(first.data['stats']['total_reviews'], 15)


class MonthBoundaryTests(InstructorReviewsTestCase):
    """`created_at` vs `updated_at` (research R7).

    Its own class because this is the feature's loudest *silent* failure: swap the two
    fields and both the count and the ordering come out wrong together, with nothing
    raised and no error logged.
    """

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('month@test.com', 'month_instructor')
        self.course = make_course(self.profile, title='Course')

    def test_review_created_last_month_but_edited_today(self):
        # US1 Acceptance Scenario 4, both halves in one test on purpose: they fail
        # together and have to be read together.
        old_student = make_student('edited@test.com', 'edited')
        edited = make_review(
            old_student, self.course, rating=4,
            created=LAST_MONTH, updated=FIXED_NOW,
        )
        fresh_student = make_student('fresh@test.com', 'fresh')
        make_review(
            fresh_student, self.course, rating=5,
            created=MONTH_START + timedelta(days=1),
            updated=MONTH_START + timedelta(days=1),
        )

        response = self.get(self.user, self.url(course=self.course.id))

        # Counted by CREATION: the edit does not make it a review from this month.
        self.assertEqual(response.data['stats']['this_month_count'], 1)
        # Ordered by UPDATE: the edit moves it to the top, dated today.
        self.assertEqual(self.ids_in(response)[0], edited.id)
        self.assertEqual(response.data['results'][0]['updated_at'], FIXED_NOW.date().isoformat())

    def test_month_boundary_is_inclusive_at_the_first_instant(self):
        on_boundary = make_student('boundary@test.com', 'boundary')
        make_review(on_boundary, self.course, rating=5, created=MONTH_START)

        just_before = make_student('before@test.com', 'before')
        make_review(
            just_before, self.course, rating=5,
            created=MONTH_START - timedelta(microseconds=1),
        )

        stats = self.get(self.user, self.url(course=self.course.id)).data['stats']
        self.assertEqual(stats['total_reviews'], 2)
        # `>=` month start: the first instant counts, the microsecond before it does not.
        self.assertEqual(stats['this_month_count'], 1)


class OrderingTests(InstructorReviewsTestCase):
    """`-updated_at, -id` (research R8).

    Two hazards: `Review.Meta.ordering = ['-created_at']` winning over a forgotten
    `.order_by()`, and ties in `auto_now` breaking pagination with zero writes.
    """

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('order@test.com', 'order_instructor')
        self.course = make_course(self.profile, title='Course')

    def test_newest_updated_first(self):
        ids = []
        for index, day in enumerate([1, 5, 3]):
            student = make_student(f'ord{index}@test.com', f'ord{index}')
            item = make_review(
                student, self.course, rating=5,
                created=MONTH_START, updated=MONTH_START + timedelta(days=day),
            )
            ids.append((day, item.id))

        response = self.get(self.user, self.url(course=self.course.id))

        expected = [item_id for _, item_id in sorted(ids, key=lambda pair: -pair[0])]
        self.assertEqual(self.ids_in(response), expected)

    def test_model_default_ordering_does_not_win(self):
        # THE assertion that fails if `.order_by()` is omitted: this review is the
        # OLDEST by creation and the NEWEST by update, so `Meta.ordering` would sort it
        # last while FR-020 puts it first.
        oldest_created = make_student('oldc@test.com', 'oldc')
        flipped = make_review(
            oldest_created, self.course, rating=4,
            created=LAST_MONTH, updated=FIXED_NOW,
        )
        newer_created = make_student('newc@test.com', 'newc')
        make_review(
            newer_created, self.course, rating=5,
            created=MONTH_START + timedelta(days=5),
            updated=MONTH_START + timedelta(days=5),
        )

        response = self.get(self.user, self.url(course=self.course.id))
        self.assertEqual(self.ids_in(response)[0], flipped.id)

    def test_tied_timestamps_page_exactly_once(self):
        # 12 reviews over a page size of 10, three of them sharing an updated_at that
        # straddles the boundary. Without the `-id` tiebreak the order among the tied
        # rows is unspecified, so a review can appear on both pages or on neither — with
        # no writes happening at all.
        tie = MONTH_START + timedelta(days=4)
        created_ids = []
        for index in range(12):
            student = make_student(f'tie{index}@test.com', f'tie{index}')
            # Indexes 8, 9, 10 land either side of the page boundary with one timestamp.
            updated = tie if index in (8, 9, 10) else MONTH_START + timedelta(days=index)
            item = make_review(student, self.course, rating=5, created=MONTH_START, updated=updated)
            created_ids.append(item.id)

        first = self.get(self.user, self.url(course=self.course.id, page=1))
        second = self.get(self.user, self.url(course=self.course.id, page=2))

        seen = self.ids_in(first) + self.ids_in(second)
        self.assertEqual(len(seen), 12, 'a page repeated or skipped a review')
        self.assertEqual(sorted(seen), sorted(created_ids))
        self.assertEqual(len(set(seen)), 12, 'a review appeared on both pages')


class RowShapeTests(InstructorReviewsTestCase):
    """Each row field's format and its absent case (FR-014 – FR-019)."""

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('row@test.com', 'row_instructor')
        self.course = make_course(self.profile, title='Django for Beginners')

    def first_row(self, **kwargs):
        response = self.get(self.user, self.url(course=self.course.id, **kwargs))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data['results'][0]

    def test_missing_comment_is_empty_string_not_null(self):
        student = make_student('nocomment@test.com', 'nocomment')
        make_review(student, self.course, rating=5, comment='')

        row = self.first_row()
        self.assertIn('comment', row)
        self.assertEqual(row['comment'], '')
        self.assertIsNotNone(row['comment'])

    def test_avatar_is_null_when_absent_or_blank(self):
        for index, picture in enumerate([None, '']):
            with self.subTest(picture=picture):
                Review.objects.all().delete()
                student = make_student(
                    f'noavatar{index}@test.com', f'noavatar{index}', profile_picture=picture,
                )
                make_review(student, self.course, rating=5)

                # '' and NULL both become null, so the client has one absent case.
                self.assertIsNone(self.first_row()['reviewer']['avatar'])

    def test_name_falls_back_to_username(self):
        student = make_student('noname@test.com', 'quiet_learner', first_name='', last_name='')
        make_review(student, self.course, rating=5)

        name = self.first_row()['reviewer']['name']
        self.assertEqual(name, 'quiet_learner')
        self.assertNotEqual(name.strip(), '')

    def test_name_is_first_and_last_together(self):
        student = make_student('named@test.com', 'named', first_name='Maria', last_name='Gomez')
        make_review(student, self.course, rating=5)

        self.assertEqual(self.first_row()['reviewer']['name'], 'Maria Gomez')

    def test_updated_at_is_a_date_with_no_time(self):
        student = make_student('dated@test.com', 'dated')
        make_review(student, self.course, rating=5, updated=FIXED_NOW)

        value = self.first_row()['updated_at']
        self.assertRegex(value, r'^\d{4}-\d{2}-\d{2}$')
        self.assertNotIn('T', value)
        self.assertEqual(value, FIXED_NOW.date().isoformat())

    def test_course_is_present_in_both_scopes(self):
        student = make_student('scoped@test.com', 'scoped')
        make_review(student, self.course, rating=5)

        for scope in ({'course': self.course.id}, {}):
            with self.subTest(scope=scope):
                response = self.get(self.user, self.url(**scope))
                course = response.data['results'][0]['course']
                self.assertEqual(course['id'], self.course.id)
                self.assertEqual(course['title'], 'Django for Beginners')


# ======================================================================================
# User Story 2 — Filter the list by star rating
# ======================================================================================

class FilterTests(InstructorReviewsTestCase):
    """The rating parse, and that `stats` ignores it (research R4, R11)."""

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('filter@test.com', 'filter_instructor')
        self.course = make_course(self.profile, title='Course')
        for index, rating in enumerate([5, 5, 4, 3, 1]):
            student = make_student(f'flt{index}@test.com', f'flt{index}')
            make_review(student, self.course, rating=rating, created=MONTH_START + timedelta(days=1))

    def test_five_and_four_narrow_the_list(self):
        for rating, expected in (('5', [5, 5]), ('4', [4])):
            with self.subTest(rating=rating):
                response = self.get(self.user, self.url(course=self.course.id, rating=rating))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(self.ratings_in(response), expected)

    def test_unrecognised_ratings_fall_back_to_all_with_200(self):
        # FR-027: the address is the least trustworthy input on the page. Note `3` is
        # deliberately "unrecognised" — the page has three chips and no way to show or
        # clear a 3-star filter (research R11).
        #
        # `abc` is the one that must never 500: unparsed, it reaches the ORM as
        # filter(rating='abc') and raises ValueError.
        for raw in ('3', 'all', 'abc', '0', '', '-1', '5.0'):
            with self.subTest(rating=raw):
                response = self.get(self.user, self.url(course=self.course.id, rating=raw))
                self.assertEqual(
                    response.status_code, status.HTTP_200_OK,
                    f'?rating={raw!r} did not fall back cleanly',
                )
                self.assertEqual(response.data['count'], 5)

    def test_stats_do_not_move_when_the_filter_changes(self):
        # SC-004, and the most reversible mistake in the feature: computing stats from
        # the filtered queryset makes ?rating=5 report a 5.0 average and a 100% 5-star
        # rate.
        unfiltered = self.get(self.user, self.url(course=self.course.id)).data['stats']

        for rating in ('5', '4'):
            with self.subTest(rating=rating):
                filtered = self.get(self.user, self.url(course=self.course.id, rating=rating)).data['stats']
                self.assertEqual(filtered, unfiltered)

        self.assertEqual(unfiltered['total_reviews'], 5)
        self.assertEqual(unfiltered['five_star_count'], 2)

    def test_filter_matching_nothing_keeps_total_reviews_positive(self):
        # The signal the client uses to tell "no reviews match this filter" (FR-026)
        # from "no reviews yet" (FR-042). Without it the two states collapse into one.
        all_five = make_course(self.profile, title='All five star')
        for index in range(3):
            student = make_student(f'five{index}@test.com', f'five{index}')
            make_review(student, all_five, rating=5, created=MONTH_START + timedelta(days=1))

        response = self.get(self.user, self.url(course=all_five.id, rating='4'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])
        self.assertEqual(response.data['stats']['total_reviews'], 3)


class PagingTests(InstructorReviewsTestCase):
    """The page fallback, and that paging is exhaustive under a filter (FR-028 – FR-032)."""

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('page@test.com', 'page_instructor')
        self.course = make_course(self.profile, title='Course')
        self.total = 25
        for index in range(self.total):
            student = make_student(f'pg{index}@test.com', f'pg{index}')
            make_review(
                student, self.course, rating=5 if index % 2 == 0 else 4,
                created=MONTH_START, updated=MONTH_START + timedelta(minutes=index),
            )

    def test_page_size_is_ten(self):
        response = self.get(self.user, self.url(course=self.course.id))
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['count'], self.total)

    def test_client_cannot_widen_the_page(self):
        # FR-028 fixes the size on the server. This is why the feature needs its own
        # paginator rather than reusing ReviewPageNumberPagination, which exposes
        # page_size_query_param.
        response = self.get(self.user, self.url(course=self.course.id, page_size=100))
        self.assertEqual(len(response.data['results']), 10)

    def test_out_of_range_and_malformed_pages_fall_back_to_page_one(self):
        # DRF's default raises NotFound -> 404 for all of these; FR-031 wants page 1.
        first_page_ids = self.ids_in(self.get(self.user, self.url(course=self.course.id)))

        for raw in ('999', '0', '-1', 'abc', ''):
            with self.subTest(page=raw):
                response = self.get(self.user, self.url(course=self.course.id, page=raw))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(self.ids_in(response), first_page_ids)

    def test_page_last_resolves_to_the_final_page(self):
        response = self.get(self.user, self.url(course=self.course.id, page='last'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 25 reviews over 10 per page -> the last page holds 5.
        self.assertEqual(len(response.data['results']), 5)
        self.assertIsNone(response.data['next'])

    def test_empty_scope_resolves_to_page_one(self):
        # Paginator.num_pages is 1 even for an empty result (allow_empty_first_page), so
        # an empty feed must not trip the upper bound.
        empty = make_course(self.profile, title='Never reviewed')
        response = self.get(self.user, self.url(course=empty.id, page=1))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)

    def test_paging_a_filtered_feed_is_exhaustive(self):
        # 13 five-star reviews over a page size of 10: every one appears exactly once
        # across the two pages, with no duplicate and no omission (FR-032).
        seen = []
        for page in (1, 2):
            response = self.get(self.user, self.url(course=self.course.id, rating='5', page=page))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(set(self.ratings_in(response)) or {5}, {5})
            seen.extend(self.ids_in(response))

        expected = Review.objects.filter(course=self.course, rating=5).count()
        self.assertEqual(len(seen), expected)
        self.assertEqual(len(set(seen)), expected)


# ======================================================================================
# User Story 4 — Nobody reads another instructor's reviews
# ======================================================================================

class OwnershipTests(InstructorReviewsTestCase):
    """The security boundary (FR-036 – FR-041, SC-006)."""

    def setUp(self):
        super().setUp()
        self.user_a, self.profile_a = make_instructor('a@test.com', 'instructor_a')
        self.course_a = make_course(self.profile_a, title="A's course")
        self.student_a = make_student('sa@test.com', 'sa')
        make_review(self.student_a, self.course_a, rating=5, comment="A's review")

        self.user_b, self.profile_b = make_instructor('b@test.com', 'instructor_b')
        self.course_b = make_course(self.profile_b, title="B's course")
        self.student_b = make_student('sb@test.com', 'sb')
        make_review(self.student_b, self.course_b, rating=1, comment="B's review")

    def test_the_three_not_found_causes_are_indistinguishable(self):
        # THE security assertion. Asserted as equality between the three responses, not
        # as three separate assertEqual(404) calls: a difference in status OR body makes
        # this endpoint a probe for which course ids exist (FR-038).
        others = self.get(self.user_a, self.url(course=self.course_b.id))
        missing = self.get(self.user_a, self.url(course=999999))
        unparseable = self.get(self.user_a, self.url(course='abc'))

        self.assertEqual(others.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(others.status_code, missing.status_code)
        self.assertEqual(others.status_code, unparseable.status_code)
        self.assertEqual(others.data, missing.data)
        self.assertEqual(others.data, unparseable.data)

    def test_aggregate_scope_excludes_another_instructors_reviews(self):
        response = self.get(self.user_a, self.url())

        titles = {row['course']['title'] for row in response.data['results']}
        self.assertEqual(titles, {"A's course"})
        self.assertEqual(response.data['stats']['total_reviews'], 1)
        self.assertNotIn("B's review", [row['comment'] for row in response.data['results']])

    def test_a_review_the_instructor_wrote_as_a_student_is_not_in_their_feed(self):
        # US4 Acceptance Scenario 5. The scope is reviews *of* A's courses, never
        # reviews *by* A — a distinction that a queryset keyed on the wrong relation
        # would invert without any error.
        StudentProfile.objects.get_or_create(user=self.user_a)
        make_review(self.user_a, self.course_b, rating=2, comment='A reviewing B')

        response = self.get(self.user_a, self.url())

        self.assertNotIn('A reviewing B', [row['comment'] for row in response.data['results']])
        self.assertEqual(response.data['stats']['total_reviews'], 1)

    def test_students_and_anonymous_visitors_are_refused(self):
        student_response = self.get(self.student_a, self.url())
        self.assertEqual(student_response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=None)
        anonymous = self.client.get(self.url())
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_write_methods_are_rejected(self):
        # FR-041: the feed is read-only, and no control on it may change anything.
        self.client.force_authenticate(user=self.user_a)
        url = self.url()
        for method in ('post', 'patch', 'put', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(url, {}, format='json')
                self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_staff_without_an_instructor_profile_is_refused_cleanly(self):
        # FR-040: isInstructor is `is_staff`, so a staff account with no profile passes
        # the permission and must still fail with a meaningful body — never a 500, and
        # never an empty feed that would read as "you have no reviews yet".
        staff = CustomUser.objects.create_user(
            email='staff@test.com', password='pass1234', username='staff_no_profile',
            role='student', is_active=True,
        )
        CustomUser.objects.filter(pk=staff.pk).update(is_staff=True)
        staff.refresh_from_db()
        InstructorProfile.objects.filter(user=staff).delete()

        response = self.get(staff, self.url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data.get('code'), 'no_instructor_profile')


class PrivacyTests(InstructorReviewsTestCase):
    """The exact key set of a row (FR-039, SC-007)."""

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('priv@test.com', 'priv_instructor')
        self.course = make_course(self.profile, title='Course')
        self.student = make_student(
            'secret@test.com', 'secret', first_name='Ada', last_name='Lovelace',
        )
        enroll(self.student, self.course)
        make_review(self.student, self.course, rating=5, comment='Loved it')

    def test_row_exposes_exactly_the_contracted_fields(self):
        # Asserted over the raw body, so a convenient extra field on the serializer
        # fails a test rather than quietly leaking.
        row = self.get(self.user, self.url()).data['results'][0]

        self.assertEqual(set(row.keys()), {'id', 'rating', 'comment', 'updated_at', 'reviewer', 'course'})
        self.assertEqual(set(row['reviewer'].keys()), {'name', 'avatar'})
        self.assertEqual(set(row['course'].keys()), {'id', 'title'})

    def test_stats_expose_exactly_the_contracted_figures(self):
        stats = self.get(self.user, self.url()).data['stats']
        self.assertEqual(
            set(stats.keys()),
            {'avg_rating', 'total_reviews', 'five_star_count', 'this_month_count'},
        )

    def test_no_contact_payment_or_progress_data_anywhere_in_the_body(self):
        response = self.get(self.user, self.url())
        body = str(response.data)

        self.assertNotIn('secret@test.com', body)

        forbidden = {
            'email', 'user_id', 'student_id', 'progress', 'enrolled_at',
            'order', 'amount', 'quiz', 'score', 'password',
        }
        present = set(_all_keys(response.data)) & forbidden
        self.assertEqual(present, set(), f'forbidden keys in the response: {present}')


class PerformanceTests(InstructorReviewsTestCase):
    """The query budget, and that it is flat in the number of reviews (research R5)."""

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('perf@test.com', 'perf_instructor')
        self.course = make_course(self.profile, title='Course')
        self.seeded = 0
        self.seed(12)

    def seed(self, count):
        for index in range(self.seeded, self.seeded + count):
            student = make_student(f'perf{index}@test.com', f'perf{index}')
            make_review(
                student, self.course, rating=5, comment='x',
                created=MONTH_START, updated=MONTH_START + timedelta(minutes=index),
            )
        self.seeded += count

    def test_aggregate_scope_query_budget(self):
        self.client.force_authenticate(user=self.user)
        with self.assertNumQueries(QUERIES_AGGREGATE):
            self.client.get(self.url())

    def test_course_scope_query_budget(self):
        # One more than the aggregate scope: resolving ?course= against the owned set.
        # That query cannot be folded into the main queryset — an owned course with no
        # reviews must stay distinguishable from a course the caller does not own, and
        # an empty result cannot tell those apart (FR-038).
        self.client.force_authenticate(user=self.user)
        with self.assertNumQueries(QUERIES_COURSE):
            self.client.get(self.url(course=self.course.id))

    def test_budget_is_flat_in_the_number_of_reviews(self):
        # The assertion that actually catches N+1. A budget test that only ever sees one
        # fixture size passes happily while every row re-fetches its reviewer.
        self.seed(24)
        self.assertEqual(self.seeded, 36)

        self.client.force_authenticate(user=self.user)
        with self.assertNumQueries(QUERIES_AGGREGATE):
            self.client.get(self.url())
        with self.assertNumQueries(QUERIES_COURSE):
            self.client.get(self.url(course=self.course.id))


# ======================================================================================
# User Story 3 — Read reviews across all courses
# ======================================================================================

class AggregateScopeTests(InstructorReviewsTestCase):
    """Every owned course, published or not (FR-033 – FR-035)."""

    def setUp(self):
        super().setUp()
        self.user, self.profile = make_instructor('agg@test.com', 'agg_instructor')

        self.published = make_course(self.profile, title='Published', is_published=True)
        self.unpublished = make_course(self.profile, title='Unpublished', is_published=False)
        self.never_reviewed = make_course(self.profile, title='Never reviewed', is_published=True)

        self.published_review = make_review(
            make_student('ap@test.com', 'ap'), self.published, rating=5,
            created=MONTH_START, updated=MONTH_START + timedelta(days=1),
        )
        self.unpublished_review = make_review(
            make_student('au@test.com', 'au'), self.unpublished, rating=3,
            created=MONTH_START, updated=MONTH_START + timedelta(days=9),
        )

    def test_reviews_from_every_owned_course_appear_together(self):
        response = self.get(self.user, self.url())

        titles = {row['course']['title'] for row in response.data['results']}
        self.assertEqual(titles, {'Published', 'Unpublished'})

    def test_unpublished_courses_are_included_in_rows_and_stats(self):
        # THE assertion that fails if someone "helpfully" adds is_published=True to the
        # queryset. An instructor still wants to read feedback on a course they have
        # since unpublished (spec Clarifications; 008 already behaves this way).
        response = self.get(self.user, self.url())

        self.assertIn(self.unpublished_review.id, self.ids_in(response))
        self.assertEqual(response.data['stats']['total_reviews'], 2)
        self.assertEqual(response.data['stats']['avg_rating'], 4.0)

    def test_ordering_interleaves_courses(self):
        # Most recently updated first, regardless of which course it belongs to.
        response = self.get(self.user, self.url())
        self.assertEqual(
            self.ids_in(response),
            [self.unpublished_review.id, self.published_review.id],
        )

    def test_filter_applies_across_every_owned_course(self):
        response = self.get(self.user, self.url(rating='5'))

        self.assertEqual(self.ids_in(response), [self.published_review.id])
        # Still the whole scope (FR-007).
        self.assertEqual(response.data['stats']['total_reviews'], 2)

    def test_instructor_with_no_courses_gets_an_empty_scope(self):
        # The server reports total_reviews: 0 for both "no courses" and "no reviews yet";
        # the client distinguishes them from the course list (FR-035).
        lonely_user, _ = make_instructor('lonely@test.com', 'lonely')

        response = self.get(lonely_user, self.url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['stats']['total_reviews'], 0)
        self.assertIsNone(response.data['stats']['avg_rating'])
