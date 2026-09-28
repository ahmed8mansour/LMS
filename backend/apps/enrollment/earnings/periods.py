"""Calendar periods, windows and trend buckets (spec 013, research R5).

Pure: no ORM. Every date here is a UTC calendar date (settings.TIME_ZONE is 'UTC').

**Do not merge this with `apps/course/analytics/periods.py`.** That module's Period is
`30 | 90 | all` — rolling, day-aligned spans. This one is `month | year | all` — calendar
month-to-date and year-to-date. The two wear the same word and mean different things;
folding them into one branching module would give each spec members it has to reject.

Buckets are always whole calendar units — a day for `month`, a calendar month for `year`
and `all` — so a bucket's start date is exactly the key Postgres' own TruncDay/TruncMonth
grouping produces, and the service can look one up without scanning (R6). That is also
why the `all` window starts on the FIRST of the earliest sale's month rather than on the
sale's own date: the window and the chart then describe the same range (FR-017).

The API is strict about the period (an unknown value is a 400); the page-address fallback
to `month` is a UI concern handled by the client (FR-015c, R8).
"""
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal
from enum import Enum


class Period(str, Enum):
    MONTH = 'month'
    YEAR = 'year'
    ALL = 'all'


class InvalidPeriod(ValueError):
    pass


@dataclass(frozen=True)
class Window:
    start: date | None
    end: date


@dataclass(frozen=True)
class Bucket:
    start: date
    end: date
    amount: Decimal


def parse_period(raw: str | None) -> Period:
    """`month` by default; anything unrecognised raises rather than guessing (R8)."""
    if raw is None or raw == '':
        return Period.MONTH
    try:
        return Period(raw)
    except ValueError:
        raise InvalidPeriod(raw)


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _month_end(day: date) -> date:
    return day.replace(day=monthrange(day.year, day.month)[1])


def window_for(period: Period, today: date, earliest_sale: date | None) -> Window:
    """The range the period resolves to. `end` is always today; `start` may be None.

    `start` is None only for `all` with no counted sale at all — there is no range to
    describe, which is what tells the chart to render nothing rather than one empty bar.
    """
    if period is Period.MONTH:
        return Window(start=_month_start(today), end=today)
    if period is Period.YEAR:
        return Window(start=date(today.year, 1, 1), end=today)
    # ALL: month-aligned, so the window covers exactly the buckets the chart draws.
    return Window(
        start=_month_start(earliest_sale) if earliest_sale else None,
        end=today,
    )


def window_start_datetime(window: Window) -> datetime | None:
    """The inclusive lower bound for `created_at`, or None for an unbounded window."""
    if window.start is None:
        return None
    return datetime.combine(window.start, time.min, tzinfo=dt_timezone.utc)


def _bucket_ranges(period: Period, start: date, end: date) -> list[tuple[date, date]]:
    ranges: list[tuple[date, date]] = []
    cursor = start
    while cursor <= end:
        bucket_end = cursor if period is Period.MONTH else _month_end(cursor)
        bucket_end = min(bucket_end, end)
        ranges.append((cursor, bucket_end))
        cursor = bucket_end + timedelta(days=1)
    return ranges


def build_buckets(
    period: Period,
    window: Window,
    amounts_by_date: dict[date, Decimal],
) -> list[Bucket]:
    """Contiguous, non-overlapping buckets covering the window — empty ones included.

    `amounts_by_date` is keyed by the bucket's start date, which is what the database's
    TruncDay/TruncMonth already returns, so this is an exact lookup rather than a scan.
    A missing key is a real zero: a day nobody bought anything is a visible gap in the
    chart, not a day the chart leaves out (FR-018).
    """
    if window.start is None:
        return []
    return [
        Bucket(start=start, end=end, amount=amounts_by_date.get(start, Decimal('0')))
        for start, end in _bucket_ranges(period, window.start, window.end)
    ]
