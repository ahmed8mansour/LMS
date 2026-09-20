"""
Periods, windows and enrollment-over-time buckets (spec 009, research R4).

Pure: no ORM. Every date here is a UTC calendar date (settings.TIME_ZONE is 'UTC').

Why day-aligned windows rather than a true rolling "now − 30 × 24h": aligning to UTC
days makes "Last 30 days" exactly 30 comparable daily points (no partial first day),
and gives every viewer identical buckets for the same link (FR-011a). Enrollments up
to the moment of the request are still included, because today is in the window.

The API is strict about the period (an unknown value is a 400); the page-address
fallback to 30 days is a UI concern handled by the client (FR-004a).
"""
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from enum import Enum
from typing import Iterable


class Period(str, Enum):
    THIRTY = '30'
    NINETY = '90'
    ALL = 'all'

    @property
    def label(self) -> str:
        return {'30': '30d', '90': '90d', 'all': 'all'}[self.value]


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
    count: int


_SPAN_DAYS = {Period.THIRTY: 30, Period.NINETY: 90}


def parse_period(raw: str | None) -> Period:
    if raw is None or raw == '':
        return Period.THIRTY
    try:
        return Period(raw)
    except ValueError:
        raise InvalidPeriod(raw)


def _first_day(period: Period, today: date) -> date | None:
    span = _SPAN_DAYS.get(period)
    return today - timedelta(days=span - 1) if span else None


def cohort_start(period: Period, today: date) -> datetime | None:
    """Lower bound for `enrolled_at` (inclusive), or None for all time."""
    first = _first_day(period, today)
    return datetime.combine(first, time.min, tzinfo=dt_timezone.utc) if first else None


def window_for(period: Period, today: date, earliest_enrolled: date | None) -> Window:
    if period is Period.ALL:
        return Window(start=earliest_enrolled, end=today)
    return Window(start=_first_day(period, today), end=today)


def _bucket_ranges(period: Period, start: date, end: date) -> list[tuple[date, date]]:
    ranges = []
    cursor = start
    while cursor <= end:
        if period is Period.THIRTY:
            bucket_end = cursor
        elif period is Period.NINETY:
            # Monday-start weeks: run to this week's Sunday, clipped to the window.
            bucket_end = cursor + timedelta(days=6 - cursor.weekday())
        else:
            # Calendar months: run to the month's last day, clipped to the window.
            bucket_end = cursor.replace(day=monthrange(cursor.year, cursor.month)[1])
        bucket_end = min(bucket_end, end)
        ranges.append((cursor, bucket_end))
        cursor = bucket_end + timedelta(days=1)
    return ranges


def build_buckets(period: Period, window: Window, enrolled_dates: Iterable[date]) -> list[Bucket]:
    """Contiguous, non-overlapping buckets covering the window, zero-count ones included."""
    if window.start is None:
        return []
    ranges = _bucket_ranges(period, window.start, window.end)
    counts = [0] * len(ranges)
    for day in enrolled_dates:
        if not (window.start <= day <= window.end):
            continue
        # Buckets are few (≤ 30 / 14 / months-of-history); a linear scan is fine.
        for index, (start, end) in enumerate(ranges):
            if start <= day <= end:
                counts[index] += 1
                break
    return [Bucket(start=start, end=end, count=count) for (start, end), count in zip(ranges, counts)]
