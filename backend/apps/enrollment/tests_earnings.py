"""013 — Instructor earnings. Period unit tests first, then API tests grouped by user story."""
import json
import re
from datetime import date, datetime
from datetime import timezone as dt_timezone
from decimal import Decimal
from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser
from apps.course.tests import make_course, make_instructor
from apps.course.tests_dashboard import make_student
from apps.enrollment.earnings.periods import (
    InvalidPeriod,
    Period,
    build_buckets,
    parse_period,
    window_for,
)
from apps.enrollment.models import Enrollment, Order


# --------------------------------------------------------------------------
# Fixtures (T002)
# --------------------------------------------------------------------------

def sell(user, course, amount='50.00', status='paid', when=None):
    """One order, placed on a date you choose.

    `Order.created_at` is `auto_now_add`, so it ignores anything passed to `create()`
    AND to `save()` — the only way to place an order in the past is the `.update()`
    below. A helper that forgets it makes every period assertion in this module
    vacuous: each order silently lands on today, and the windows all agree because
    everything is inside every one of them.

    `when=None` means "now", which is inside all three periods.

    A paid or refunded order also gets its Enrollment, because that is what the real
    fulfilment path writes and what the T006 backfill reads.
    """
    order = Order.objects.create(
        course=course,
        user=user,
        status=status,
        amount=Decimal(amount),
        currency='USD',
        stripe_payment_intent_id='test',
    )
    if status in ('paid', 'refunded'):
        Enrollment.objects.get_or_create(
            course=course, user=user,
            defaults={'order': order, 'is_active': status == 'paid'},
        )
    Order.objects.filter(pk=order.pk).update(created_at=when or timezone.now())
    order.refresh_from_db()
    return order


class EarningsTestCase(APITestCase):
    """Shared helpers for every API test class below."""

    def url(self, period=None):
        url = reverse('instructor_earnings')
        return f'{url}?period={period}' if period else url

    def get(self, user, url):
        self.client.force_authenticate(user=user)
        try:
            return self.client.get(url)
        finally:
            self.client.force_authenticate(user=None)


class SetupTests(SimpleTestCase):
    """The module runs green before the endpoint exists (T002)."""

    def test_fixture_helpers_are_importable(self):
        for helper in (make_instructor, make_course, make_student, sell):
            self.assertTrue(callable(helper))


# --------------------------------------------------------------------------
# T009 — periods.py, with no database and no HTTP.
# --------------------------------------------------------------------------

TODAY = date(2026, 9, 23)          # a Wednesday, mid-month, mid-year
SEPT = date(2026, 9, 1)


class PeriodTests(SimpleTestCase):
    """The calendar maths, against a fixed `today` rather than the real clock."""

    def test_parse_period_defaults_to_month(self):
        self.assertIs(parse_period(None), Period.MONTH)
        self.assertIs(parse_period(''), Period.MONTH)

    def test_parse_period_accepts_the_three_values(self):
        self.assertIs(parse_period('month'), Period.MONTH)
        self.assertIs(parse_period('year'), Period.YEAR)
        self.assertIs(parse_period('all'), Period.ALL)

    def test_parse_period_rejects_anything_else(self):
        # '30' and '90' are analytics' periods; accepting them here would silently
        # serve a different window than the caller asked for (research R5, R8).
        for raw in ('week', '30', '90', 'MONTH', 'this-month', 'null'):
            with self.subTest(raw=raw), self.assertRaises(InvalidPeriod):
                parse_period(raw)

    def test_window_month_starts_on_the_first(self):
        window = window_for(Period.MONTH, TODAY, None)
        self.assertEqual(window.start, SEPT)
        self.assertEqual(window.end, TODAY)

    def test_window_year_starts_on_january_first(self):
        window = window_for(Period.YEAR, TODAY, None)
        self.assertEqual(window.start, date(2026, 1, 1))
        self.assertEqual(window.end, TODAY)

    def test_window_all_is_month_aligned_to_the_earliest_sale(self):
        # Month-aligned so the window covers exactly the buckets the chart draws: a
        # window starting mid-March with buckets starting 1 March would disagree.
        window = window_for(Period.ALL, TODAY, date(2026, 3, 17))
        self.assertEqual(window.start, date(2026, 3, 1))

    def test_window_all_without_sales_has_no_start(self):
        self.assertIsNone(window_for(Period.ALL, TODAY, None).start)

    def test_month_buckets_include_every_empty_day(self):
        window = window_for(Period.MONTH, TODAY, None)
        buckets = build_buckets(
            Period.MONTH, window,
            {date(2026, 9, 4): Decimal('30.00'), date(2026, 9, 20): Decimal('12.50')},
        )
        self.assertEqual(len(buckets), 23)                      # the 1st through today
        self.assertEqual(buckets[0].start, SEPT)
        self.assertEqual(buckets[-1].end, TODAY)
        self.assertEqual(buckets[3].amount, Decimal('30.00'))   # the 4th
        # A day nobody bought anything is a real zero, not a missing bar (FR-018).
        self.assertEqual(buckets[4].amount, Decimal('0'))
        self.assertEqual(sum(b.amount for b in buckets), Decimal('42.50'))

    def test_month_buckets_are_single_days(self):
        buckets = build_buckets(Period.MONTH, window_for(Period.MONTH, TODAY, None), {})
        self.assertTrue(all(b.start == b.end for b in buckets))

    def test_year_buckets_run_january_to_the_current_month(self):
        buckets = build_buckets(
            Period.YEAR, window_for(Period.YEAR, TODAY, None),
            {date(2026, 2, 1): Decimal('99.00')},
        )
        self.assertEqual(len(buckets), 9)
        self.assertEqual(buckets[0].start, date(2026, 1, 1))
        self.assertEqual(buckets[0].end, date(2026, 1, 31))
        self.assertEqual(buckets[1].amount, Decimal('99.00'))
        # The last bucket stops at today, not at the end of the month.
        self.assertEqual(buckets[-1].start, SEPT)
        self.assertEqual(buckets[-1].end, TODAY)

    def test_all_buckets_span_years_without_a_gap(self):
        window = window_for(Period.ALL, TODAY, date(2025, 11, 20))
        buckets = build_buckets(Period.ALL, window, {})
        self.assertEqual(len(buckets), 11)                      # Nov 2025 -> Sep 2026
        self.assertEqual(buckets[0].start, date(2025, 11, 1))
        self.assertEqual(buckets[2].start, date(2026, 1, 1))    # the year rolls over

    def test_all_without_sales_has_no_buckets(self):
        # Not one empty bar: there is no range to describe (FR-018's companion).
        self.assertEqual(build_buckets(Period.ALL, window_for(Period.ALL, TODAY, None), {}), [])

    def test_buckets_never_overlap_or_leave_a_gap(self):
        for period, earliest in (
            (Period.MONTH, None), (Period.YEAR, None), (Period.ALL, date(2025, 6, 9)),
        ):
            with self.subTest(period=period):
                buckets = build_buckets(period, window_for(period, TODAY, earliest), {})
                for previous, current in zip(buckets, buckets[1:]):
                    self.assertEqual((current.start - previous.end).days, 1)
                    self.assertLessEqual(previous.start, previous.end)


# --------------------------------------------------------------------------
# US1 (T024, T025) — what counts, and for how much.
# --------------------------------------------------------------------------

MONEY = re.compile(r'^\d+\.\d{2}$')
MONEY_KEYS = ('total_revenue', 'refunds', 'net', 'amount', 'revenue')


def money_values(node, found=None):
    """Every value sitting under a money key, anywhere in the payload."""
    found = [] if found is None else found
    if isinstance(node, dict):
        for key, value in node.items():
            if key in MONEY_KEYS:
                found.append((key, value))
            else:
                money_values(value, found)
    elif isinstance(node, list):
        for item in node:
            money_values(item, found)
    return found


class MoneyRuleTests(EarningsTestCase):
    """Which orders move a tile, and by how much (FR-007 – FR-011a).

    Every case runs at `period=all`, so the window is never the variable under test.
    """

    def setUp(self):
        self.user, self.profile = make_instructor('money@test.com', 'money_i')
        self.course = make_course(self.profile, title='Django for Beginners')
        self.student = make_student('buyer@test.com', 'buyer')

    def stats(self):
        response = self.get(self.user, self.url('all'))
        self.assertEqual(response.status_code, 200)
        return response.data['stats']

    def test_paid_order_is_revenue_and_net(self):
        sell(self.student, self.course, '50.00')
        self.assertEqual(
            self.stats(),
            {'total_revenue': '50.00', 'refunds': '0.00', 'net': '50.00', 'sales': 1},
        )

    def test_refunded_order_counts_in_revenue_and_in_refunds(self):
        # The case that fails if someone "tidies" 'refunded' out of COUNTED_STATUSES:
        # revenue would drop to 50.00 and refunds would be unshowable.
        sell(self.student, self.course, '50.00')
        sell(make_student('b2@test.com', 'b2'), self.course, '20.00', status='refunded')
        self.assertEqual(
            self.stats(),
            {'total_revenue': '70.00', 'refunds': '20.00', 'net': '50.00', 'sales': 2},
        )

    def test_pending_and_failed_move_nothing(self):
        sell(self.student, self.course, '50.00')
        sell(make_student('b3@test.com', 'b3'), self.course, '999.00', status='pending')
        sell(make_student('b4@test.com', 'b4'), self.course, '888.00', status='failed')
        stats = self.stats()
        self.assertEqual(stats['total_revenue'], '50.00')
        self.assertEqual(stats['sales'], 1)

    def test_free_enrolment_is_not_a_sale(self):
        # FR-008a: zero-amount orders are enrolments, not earnings — and they must not
        # inflate the sale count either.
        free = make_course(self.profile, title='Free course', price=Decimal('0.00'))
        for i in range(3):
            sell(make_student(f'f{i}@test.com', f'f{i}'), free, '0.00')
        payload = self.get(self.user, self.url('all')).data
        self.assertEqual(payload['stats']['sales'], 0)
        self.assertEqual(payload['stats']['net'], '0.00')
        self.assertEqual(payload['courses'], [])

    def test_historic_amount_survives_a_repricing(self):
        sell(self.student, self.course, '50.00')
        self.course.price = Decimal('250.00')
        self.course.save(update_fields=['price'])
        self.assertEqual(self.stats()['net'], '50.00')

    def test_fully_refunded_period_reads_zero_not_empty(self):
        # FR-011a: $0.00 is the floor, and it is a real figure — `sales` stays above 0
        # so the page renders numbers rather than an empty state (FR-037).
        sell(self.student, self.course, '40.00', status='refunded')
        self.assertEqual(
            self.stats(),
            {'total_revenue': '40.00', 'refunds': '40.00', 'net': '0.00', 'sales': 1},
        )

    def test_net_is_revenue_minus_refunds(self):
        sell(self.student, self.course, '19.99')
        sell(make_student('b5@test.com', 'b5'), self.course, '5.01', status='refunded')
        stats = self.stats()
        self.assertEqual(
            Decimal(stats['net']),
            Decimal(stats['total_revenue']) - Decimal(stats['refunds']),
        )

    def test_every_money_value_is_a_two_decimal_string(self):
        # A float introduced anywhere in dto.py fails here rather than in a browser,
        # where it would look right until the fourth row stopped adding up (research P3).
        sell(self.student, self.course, '19.99')
        sell(make_student('b6@test.com', 'b6'), self.course, '0.01', status='refunded')
        pairs = money_values(self.get(self.user, self.url('all')).data)
        self.assertTrue(pairs)
        for key, value in pairs:
            with self.subTest(key=key, value=value):
                self.assertIsInstance(value, str)
                self.assertRegex(value, MONEY)


class DashboardParityTests(EarningsTestCase):
    """FR-014 — all-time net equals the dashboard's Earnings tile, asserted against the
    live dashboard endpoint rather than a hand-computed number."""

    def setUp(self):
        self.user, self.profile = make_instructor('parity@test.com', 'parity_i')
        self.course = make_course(self.profile, title='Parity')

    def figures(self):
        dashboard = self.get(self.user, reverse('instructor_dashboard'))
        earnings = self.get(self.user, self.url('all'))
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(earnings.status_code, 200)
        return dashboard.data['earnings']['amount'], earnings.data['stats']['net']

    def test_all_time_net_matches_the_dashboard_tile(self):
        sell(make_student('p1@test.com', 'p1'), self.course, '60.00')
        sell(make_student('p2@test.com', 'p2'), self.course, '15.00', status='refunded')
        sell(make_student('p3@test.com', 'p3'), self.course, '0.00')            # free
        sell(make_student('p4@test.com', 'p4'), self.course, '77.00', status='pending')
        dashboard_amount, earnings_net = self.figures()
        self.assertEqual(dashboard_amount, earnings_net)
        self.assertEqual(earnings_net, '60.00')

    def test_an_order_with_no_date_would_break_parity(self):
        # The demonstration of why migration 0021 exists (research R4): an order the
        # dashboard counts but the earnings window cannot place. After the backfill no
        # such row survives in a real database, so parity holds — this test states what
        # skipping the migration would have cost, and pins the divergence if one ever
        # reappears.
        order = sell(make_student('p5@test.com', 'p5'), self.course, '30.00')
        Order.objects.filter(pk=order.pk).update(created_at=None)
        dashboard_amount, earnings_net = self.figures()
        self.assertEqual(dashboard_amount, '30.00')
        self.assertEqual(earnings_net, '0.00')


# --------------------------------------------------------------------------
# US2 (T027) — the three windows and their edges.
# --------------------------------------------------------------------------

FROZEN = datetime(2026, 9, 23, 12, 0, tzinfo=dt_timezone.utc)


def frozen_clock():
    """Freeze only the service's clock.

    The orders below are placed at explicit datetimes by `sell`, so the window edges are
    testable exactly. Patching the global clock instead would make the assertions depend
    on the day the suite happens to run — and on 1 January "in the year but not in the
    month" has no room at all.
    """
    return patch('apps.enrollment.earnings.service.timezone.now', return_value=FROZEN)


class PeriodApiTests(EarningsTestCase):
    """Windows, UTC edges, and the strict parameter (FR-015 – FR-015c)."""

    def setUp(self):
        self.user, self.profile = make_instructor('period@test.com', 'period_i')
        self.course = make_course(self.profile, title='Periods')

    def payload(self, period=None):
        with frozen_clock():
            response = self.get(self.user, self.url(period))
        self.assertEqual(response.status_code, 200)
        return response.data

    def test_last_instant_of_last_month_is_outside_this_month(self):
        # 23:59:59 UTC on 31 August — one second before the window opens.
        sell(self.student_for('aug'), self.course, '10.00',
             when=datetime(2026, 8, 31, 23, 59, 59, tzinfo=dt_timezone.utc))
        self.assertEqual(self.payload('month')['stats']['net'], '0.00')
        self.assertEqual(self.payload('year')['stats']['net'], '10.00')
        self.assertEqual(self.payload('all')['stats']['net'], '10.00')

    def test_first_instant_of_this_month_is_inside_it(self):
        sell(self.student_for('sep'), self.course, '10.00',
             when=datetime(2026, 9, 1, 0, 0, 0, tzinfo=dt_timezone.utc))
        self.assertEqual(self.payload('month')['stats']['net'], '10.00')

    def test_a_previous_year_is_all_time_only(self):
        sell(self.student_for('old'), self.course, '25.00',
             when=datetime(2025, 12, 31, 23, 59, 59, tzinfo=dt_timezone.utc))
        self.assertEqual(self.payload('month')['stats']['net'], '0.00')
        self.assertEqual(self.payload('year')['stats']['net'], '0.00')
        self.assertEqual(self.payload('all')['stats']['net'], '25.00')

    def test_window_matches_the_period(self):
        sell(self.student_for('w'), self.course, '5.00',
             when=datetime(2026, 3, 17, 9, 0, tzinfo=dt_timezone.utc))
        self.assertEqual(self.payload('month')['window'], {'start': '2026-09-01', 'end': '2026-09-23'})
        self.assertEqual(self.payload('year')['window'], {'start': '2026-01-01', 'end': '2026-09-23'})
        # All time is month-aligned to the earliest sale, so the window covers exactly
        # the buckets the chart draws.
        self.assertEqual(self.payload('all')['window'], {'start': '2026-03-01', 'end': '2026-09-23'})

    def test_all_time_without_sales_has_no_window_start(self):
        self.assertIsNone(self.payload('all')['window']['start'])

    def test_missing_period_defaults_to_month(self):
        self.assertEqual(self.payload()['period'], 'month')

    def test_period_is_echoed_back(self):
        # The client compares this to the chip it has selected, so a late response for
        # the period it just left is never painted as the new one (FR-039).
        for period in ('month', 'year', 'all'):
            self.assertEqual(self.payload(period)['period'], period)

    def test_unknown_period_is_rejected(self):
        response = self.get(self.user, self.url('lastweek'))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'invalid_period')

    def student_for(self, tag):
        return make_student(f'{tag}@test.com', f'{tag}_u')


# --------------------------------------------------------------------------
# US4 (T029) — the per-course breakdown.
# --------------------------------------------------------------------------

class CourseBreakdownTests(EarningsTestCase):
    """Which courses are listed, in what order, with which numbers (FR-022 – FR-029)."""

    def setUp(self):
        self.user, self.profile = make_instructor('rows@test.com', 'rows_i')
        self.top = make_course(self.profile, title='Top seller', is_published=True)
        self.quiet = make_course(self.profile, title='Quiet one', is_published=True)

    def courses(self, period='all'):
        response = self.get(self.user, self.url(period))
        self.assertEqual(response.status_code, 200)
        return response.data['courses']

    def buy(self, tag, course, amount='50.00', status='paid'):
        return sell(make_student(f'{tag}@test.com', tag), course, amount, status=status)

    def test_one_row_per_course_with_a_sale(self):
        self.buy('r1', self.top, '80.00')
        self.buy('r2', self.quiet, '20.00')
        rows = self.courses()
        self.assertEqual(
            rows,
            [
                {'id': self.top.id, 'title': 'Top seller', 'sales': 1, 'revenue': '80.00'},
                {'id': self.quiet.id, 'title': 'Quiet one', 'sales': 1, 'revenue': '20.00'},
            ],
        )

    def test_a_course_with_no_sales_is_not_listed(self):
        self.buy('r3', self.top, '80.00')
        self.assertEqual([row['id'] for row in self.courses()], [self.top.id])

    def test_an_unpublished_course_that_sold_is_listed(self):
        # The assertion that fails if someone adds is_published=True to the queryset out
        # of habit: a course can be unpublished after it has been bought (FR-025).
        draft = make_course(self.profile, title='Withdrawn', is_published=False)
        self.buy('r4', draft, '35.00')
        self.assertIn(draft.id, [row['id'] for row in self.courses()])

    def test_a_refunded_only_course_reads_one_sale_and_zero_revenue(self):
        self.buy('r5', self.top, '45.00', status='refunded')
        self.assertEqual(
            self.courses(),
            [{'id': self.top.id, 'title': 'Top seller', 'sales': 1, 'revenue': '0.00'}],
        )

    def test_rows_are_ordered_by_revenue_then_title_then_id(self):
        self.buy('r6', self.top, '30.00')
        self.buy('r7', self.quiet, '30.00')        # a deliberate tie
        first, second = self.courses()
        self.assertEqual(first['title'], 'Quiet one')    # 'Q' sorts before 'T'
        self.assertEqual(second['title'], 'Top seller')
        # And the tie-break is stable: the same period twice gives the same order.
        self.assertEqual(self.courses(), [first, second])

    def test_columns_add_up_to_the_tiles(self):
        self.buy('r8', self.top, '80.00')
        self.buy('r9', self.top, '15.00', status='refunded')
        self.buy('r10', self.quiet, '20.00')
        payload = self.get(self.user, self.url('all')).data
        rows, stats = payload['courses'], payload['stats']
        self.assertEqual(
            sum(Decimal(row['revenue']) for row in rows), Decimal(stats['net']),
        )
        self.assertEqual(sum(row['sales'] for row in rows), stats['sales'])

    def test_a_renamed_course_shows_its_current_title(self):
        self.buy('r11', self.top, '10.00')
        self.top.title = 'Top seller (2nd edition)'
        self.top.save(update_fields=['title'])
        self.assertEqual(self.courses()[0]['title'], 'Top seller (2nd edition)')


# --------------------------------------------------------------------------
# US5 (T031) — the boundary, from outside the interface.
# --------------------------------------------------------------------------

FORBIDDEN_KEYS = {
    'user', 'user_id', 'email', 'name', 'username', 'buyer', 'student',
    'stripe_payment_intent_id', 'payment_intent', 'payment_gateway', 'receipt_url',
    'gateway_reference', 'gateway_charge_id', 'order', 'order_id', 'idempotency_key',
}


def walk(node, path='$'):
    """Every (path, key, value) in the payload, for the privacy scan."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield path, key, value
            yield from walk(value, f'{path}.{key}')
    elif isinstance(node, list):
        for index, item in enumerate(node):
            yield from walk(item, f'{path}[{index}]')


class AccessTests(EarningsTestCase):
    """Only the owner is served, and the payload carries no buyer (FR-030 – FR-035)."""

    def setUp(self):
        self.user_a, self.profile_a = make_instructor('a@earn.com', 'earn_a')
        self.user_b, self.profile_b = make_instructor('b@earn.com', 'earn_b')
        self.course_a = make_course(self.profile_a, title='A course')
        self.course_b = make_course(self.profile_b, title='B course')
        self.student = make_student('shopper@test.com', 'shopper')

    def test_another_instructors_sales_appear_nowhere(self):
        # Asserted on stats, courses AND trend: an ownership filter forgotten in one of
        # the service's queries would show up in only one of the three.
        sell(self.student, self.course_b, '500.00')
        payload = self.get(self.user_a, self.url('all')).data
        self.assertEqual(payload['stats'], {'total_revenue': '0.00', 'refunds': '0.00', 'net': '0.00', 'sales': 0})
        self.assertEqual(payload['courses'], [])
        self.assertEqual(payload['trend'], [])
        self.assertFalse(payload['has_sales_ever'])

    def test_money_the_instructor_spent_as_a_student_is_not_earnings(self):
        # A owns course_a and bought course_b. Only what their own course took in counts.
        sell(self.user_a, self.course_b, '99.00')
        sell(self.student, self.course_a, '10.00')
        payload = self.get(self.user_a, self.url('all')).data
        self.assertEqual(payload['stats']['net'], '10.00')

    def test_a_student_is_refused(self):
        self.assertEqual(self.get(self.student, self.url()).status_code, 403)

    def test_a_signed_out_visitor_is_refused(self):
        response = self.client.get(self.url())
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('stats', response.data)

    def test_staff_without_an_instructor_profile_gets_a_handled_refusal(self):
        # `isInstructor` is `is_staff`, so a staff account with no InstructorProfile
        # passes the permission and reaches the view — where it must get a meaningful
        # refusal rather than an unhandled RelatedObjectDoesNotExist (FR-034).
        #
        # The flag has to be set AFTER creation: `create_user` forces is_staff=False
        # (models.py:174), so passing it as a kwarg silently produces a plain student
        # who is refused by the permission instead — which is a different test that
        # would pass while proving nothing about this branch.
        staff = CustomUser.objects.create_user(
            email='staff@test.com', password='pass1234', username='staff_u',
            role='student', is_active=True,
        )
        staff.is_staff = True
        staff.save(update_fields=['is_staff'])
        self.assertFalse(hasattr(staff, 'instructor_profile'))

        response = self.get(staff, self.url())
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['code'], 'no_instructor_profile')

    def test_the_payload_carries_no_buyer(self):
        # A recursive scan, not a field-by-field check: a field-by-field check passes
        # the day someone adds a field (FR-033).
        sell(self.student, self.course_a, '10.00')
        payload = self.get(self.user_a, self.url('all')).data
        blob = json.dumps(payload)
        for fragment in ('shopper', '@test.com', 'test', 'free'):
            self.assertNotIn(fragment, blob, f'{fragment!r} leaked into the payload')
        for path, key, _ in walk(payload):
            self.assertNotIn(key, FORBIDDEN_KEYS, f'{path}.{key} exposes the buyer')


# --------------------------------------------------------------------------
# US3 (T033) — the trend.
# --------------------------------------------------------------------------

class TrendTests(EarningsTestCase):
    """Bucket granularity, completeness, and where a refund lands (FR-016 – FR-021)."""

    def setUp(self):
        self.user, self.profile = make_instructor('trend@test.com', 'trend_i')
        self.course = make_course(self.profile, title='Trending')

    def payload(self, period):
        with frozen_clock():
            response = self.get(self.user, self.url(period))
        self.assertEqual(response.status_code, 200)
        return response.data

    def buy(self, tag, amount, when, status='paid'):
        return sell(make_student(f'{tag}@test.com', tag), self.course, amount,
                    status=status, when=when)

    def test_month_has_one_bucket_per_day_including_empty_ones(self):
        self.buy('t1', '30.00', datetime(2026, 9, 4, 10, 0, tzinfo=dt_timezone.utc))
        self.buy('t2', '12.50', datetime(2026, 9, 20, 10, 0, tzinfo=dt_timezone.utc))
        trend = self.payload('month')['trend']
        self.assertEqual(len(trend), 23)
        self.assertEqual(trend[0], {'start': '2026-09-01', 'end': '2026-09-01', 'amount': '0.00'})
        self.assertEqual(trend[3]['amount'], '30.00')
        self.assertEqual(trend[19]['amount'], '12.50')

    def test_year_has_one_bucket_per_month(self):
        self.buy('t3', '60.00', datetime(2026, 2, 14, 10, 0, tzinfo=dt_timezone.utc))
        trend = self.payload('year')['trend']
        self.assertEqual(len(trend), 9)
        self.assertEqual(trend[1], {'start': '2026-02-01', 'end': '2026-02-28', 'amount': '60.00'})

    def test_all_time_runs_monthly_from_the_first_sale(self):
        self.buy('t4', '10.00', datetime(2025, 11, 5, 10, 0, tzinfo=dt_timezone.utc))
        trend = self.payload('all')['trend']
        self.assertEqual(len(trend), 11)
        self.assertEqual(trend[0]['start'], '2025-11-01')
        self.assertEqual(trend[-1]['end'], '2026-09-23')

    def test_the_bars_add_up_to_net(self):
        self.buy('t5', '30.00', datetime(2026, 9, 4, 10, 0, tzinfo=dt_timezone.utc))
        self.buy('t6', '12.50', datetime(2026, 5, 2, 10, 0, tzinfo=dt_timezone.utc))
        self.buy('t7', '7.00', datetime(2025, 5, 2, 10, 0, tzinfo=dt_timezone.utc))
        for period in ('month', 'year', 'all'):
            with self.subTest(period=period):
                payload = self.payload(period)
                self.assertEqual(
                    sum(Decimal(b['amount']) for b in payload['trend']),
                    Decimal(payload['stats']['net']),
                )

    def test_a_refund_lands_on_the_month_of_the_sale(self):
        """The single assertion that fails if attribution is moved to the refund's date.

        A sale made in August and refunded in September reduces AUGUST (FR-010). The
        refund's own date is not read anywhere — that is why `Transaction` is not
        touched at all (research R3).
        """
        self.buy('t8', '40.00', datetime(2026, 8, 10, 10, 0, tzinfo=dt_timezone.utc))
        self.buy('t9', '25.00', datetime(2026, 8, 12, 10, 0, tzinfo=dt_timezone.utc),
                 status='refunded')
        self.buy('t10', '15.00', datetime(2026, 9, 2, 10, 0, tzinfo=dt_timezone.utc))
        trend = {b['start']: b['amount'] for b in self.payload('year')['trend']}
        self.assertEqual(trend['2026-08-01'], '40.00')     # 65 sold, 25 came back
        self.assertEqual(trend['2026-09-01'], '15.00')     # September is untouched

    def test_a_fully_refunded_bucket_is_present_and_zero(self):
        # Present with 0.00, not omitted: a refunded week must not read as a quiet one
        # (FR-021).
        self.buy('t11', '40.00', datetime(2026, 9, 4, 10, 0, tzinfo=dt_timezone.utc),
                 status='refunded')
        trend = self.payload('month')['trend']
        self.assertEqual(trend[3], {'start': '2026-09-04', 'end': '2026-09-04', 'amount': '0.00'})
        self.assertEqual(self.payload('month')['stats']['sales'], 1)

    def test_all_time_without_sales_has_no_buckets(self):
        payload = self.payload('all')
        self.assertEqual(payload['trend'], [])
        self.assertIsNone(payload['window']['start'])


class QueryCountTests(EarningsTestCase):
    """Fixed query count, however many courses and orders exist (research R6)."""

    def setUp(self):
        self.user, self.profile = make_instructor('q@test.com', 'q_i')
        for index in range(5):
            course = make_course(self.profile, title=f'Course {index}')
            for buyer in range(4):
                sell(make_student(f'q{index}{buyer}@test.com', f'q{index}{buyer}'), course, '10.00')

    def counted(self, period):
        self.client.force_authenticate(user=self.user)
        with CaptureQueriesContext(connection) as captured:
            self.client.get(self.url(period))
        self.client.force_authenticate(user=None)
        # Session/auth lookups vary with the auth backend; only the service's own
        # queries are pinned, by counting the ones that touch its tables.
        return [
            query['sql'] for query in captured.captured_queries
            if 'enrollment_order' in query['sql'] or 'course_course' in query['sql']
        ]

    def test_month_takes_four_queries(self):
        # trend, per-course roll-up, owned-course count, lifetime existence check.
        self.assertEqual(len(self.counted('month')), 4)

    def test_all_time_takes_three(self):
        # `all` needs no lifetime check: its window already is the lifetime.
        self.assertEqual(len(self.counted('all')), 3)
