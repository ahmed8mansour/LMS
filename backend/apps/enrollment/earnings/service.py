"""InstructorEarningsService — one earnings snapshot for one instructor (spec 013).

- Scope comes from the signed-in profile and nothing else. This service is never passed
  an id from the client, because the endpoint accepts none (research P5b) — so there is
  no ownership check here that could be forgotten on some other code path.
- Four queries, fixed however many courses or orders exist — three for `all`, which
  needs no lifetime check because its window already is the lifetime. Pinned by a test.
- `Transaction` is deliberately not read. It would only carry the date a refund was
  issued or a partial amount, and the spec uses neither: a refund is attributed to the
  sale it reverses (FR-010) and refunds are whole-order (research R3). Reading it would
  add a second, divergable definition of "refunded" beside `Order.status`.
- Nothing is serialized here. The view builds and serializes in one try, so a failure
  anywhere is a single error, never a partial snapshot.
"""
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth
from django.utils import timezone

from apps.course.models import Course
from apps.enrollment.models import Order
from .dto import CourseEarnings, EarningsSnapshot, EarningsStats
from .periods import Period, build_buckets, window_for, window_start_datetime

ZERO = Decimal('0')

# An order is paid-for when its status says money arrived. A refunded order IS counted:
# FR-007 puts it in total revenue and FR-010 takes it out again as a refund, so dropping
# it here would make refunds unshowable.
COUNTED_STATUSES = ('paid', 'refunded')


class InstructorEarningsService:

    def build(self, profile, period: Period) -> EarningsSnapshot:
        today = timezone.now().date()

        # For `month` and `year` the window is pure calendar arithmetic, so the lower
        # bound is known before any query. For `all` there is no lower bound at all.
        start = None
        if period is not Period.ALL:
            start = window_start_datetime(window_for(period, today, None))

        # The trend is fetched first because, for `all`, its earliest key IS the month
        # of the earliest counted sale — which is what the window needs. Deriving it
        # here saves the separate Min() query that would otherwise be a fourth round
        # trip for a number the database has already grouped by.
        amounts = self._trend_amounts(profile, period, start)
        earliest = min(amounts) if (period is Period.ALL and amounts) else None
        window = window_for(period, today, earliest)

        rows = self._course_rows(profile, start)
        courses = self._courses(rows)
        stats = self._stats(rows)

        return EarningsSnapshot(
            period=period,
            window=window,
            stats=stats,
            trend=tuple(build_buckets(period, window, amounts)),
            courses=tuple(courses),
            courses_count=Course.objects.filter(instructor=profile).count(),
            has_sales_ever=(
                stats.sales > 0 if period is Period.ALL else self._has_sales_ever(profile)
            ),
        )

    # ------------------------------------------------------------------
    # The one ownership boundary, written once.
    # ------------------------------------------------------------------

    def _counted_sales(self, profile, start=None):
        """Every counted sale for this instructor, optionally from `start` onwards.

        Each clause is a requirement:
          course__instructor      — ownership; the only scope this endpoint has (FR-031)
          status__in              — pending and failed never took money (FR-008)
          amount__gt=0            — a free enrolment is not a sale (FR-008a). This, and
                                    NOT `payment_gateway != 'free'`: the amount is what
                                    decides whether money actually moved.
          created_at__isnull      — an order that cannot be placed in time would land in
                                    the tiles but not in the dateless chart, and the two
                                    would stop agreeing (FR-041). After the backfill
                                    migration this excludes nothing.
        """
        queryset = Order.objects.filter(
            course__instructor=profile,
            status__in=COUNTED_STATUSES,
            amount__gt=0,
            created_at__isnull=False,
        )
        return queryset.filter(created_at__gte=start) if start else queryset

    # ------------------------------------------------------------------
    # Query 1 — the per-course roll-up. The stats are read off the same rows.
    # ------------------------------------------------------------------

    def _course_rows(self, profile, start) -> list[dict]:
        return list(
            self._counted_sales(profile, start)
            .values('course_id', 'course__title')
            .annotate(
                sales=Count('id'),
                gross=Sum('amount'),
                refunded=Sum('amount', filter=Q(status='refunded')),
            )
        )

    @staticmethod
    def _money(row, key) -> Decimal:
        # Sum() is None for an empty set, and `refunded` is empty on any course whose
        # sales all stuck. Coerce at every read, not just the obvious ones.
        return row[key] or ZERO

    def _courses(self, rows) -> list[CourseEarnings]:
        courses = [
            CourseEarnings(
                course_id=row['course_id'],
                title=row['course__title'],
                # Purchases made, INCLUDING those later refunded (FR-023) — so this
                # column reconciles with the total-revenue tile while `revenue` below
                # reconciles with net. A course sold once and refunded reads 1 · $0.00.
                sales=row['sales'],
                revenue=self._money(row, 'gross') - self._money(row, 'refunded'),
            )
            for row in rows
        ]
        # Highest revenue first, then title, then id — a total order, so the same period
        # always renders the same table (FR-026). Sorted in Python because `revenue` is
        # computed above; the row count is bounded by courses owned.
        courses.sort(key=lambda c: (-c.revenue, c.title, c.course_id))
        return courses

    def _stats(self, rows) -> EarningsStats:
        """The three tiles, summed from the per-course rows rather than queried again.

        FR-027 requires the table's columns to add up to the tiles. A second aggregate
        would satisfy that only for as long as both carried identical filters forever,
        and the first divergence — a filter fixed in one place — produces a page that is
        quietly wrong in a way nobody reports. Summing the same rows makes it an
        identity (research R6), and costs one query less.
        """
        gross = sum((self._money(row, 'gross') for row in rows), ZERO)
        refunds = sum((self._money(row, 'refunded') for row in rows), ZERO)
        return EarningsStats(
            total_revenue=gross,
            refunds=refunds,
            net=gross - refunds,
            sales=sum(row['sales'] for row in rows),
        )

    # ------------------------------------------------------------------
    # Query 2 — the trend.
    # ------------------------------------------------------------------

    def _trend_amounts(self, profile, period: Period, start) -> dict:
        """{bucket start date: net amount} — the database does the grouping.

        The series is NET, so its bars add up to the Net tile (FR-016). A month whose
        every sale was refunded still produces a key, with a zero amount: the bucket
        exists and reads $0.00 rather than vanishing (FR-021). Gaps between keys are
        filled by `build_buckets`, which SQL cannot do.
        """
        trunc = TruncDay if period is Period.MONTH else TruncMonth
        rows = (
            self._counted_sales(profile, start)
            .annotate(bucket=trunc('created_at'))
            .values('bucket')
            .annotate(net=Sum('amount', filter=Q(status='paid')))
        )
        # Trunc* on a DateTimeField returns a datetime; bucket keys are dates.
        return {row['bucket'].date(): (row['net'] or ZERO) for row in rows}

    # ------------------------------------------------------------------
    # Query 4 (month and year only).
    # ------------------------------------------------------------------

    def _has_sales_ever(self, profile) -> bool:
        """Separates "never sold anything" from "sold nothing this period" (FR-036/037)."""
        return self._counted_sales(profile).exists()
