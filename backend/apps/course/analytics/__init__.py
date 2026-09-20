"""
Instructor analytics: per-course and aggregate learning insight for a period (spec 009).

    periods.py    Period, windows and UTC enrollment buckets — pure, no ORM
    metrics.py    Completion, quiz pass, stuck section and drop-off definitions — pure, no ORM
    dto.py        AnalyticsSnapshot and its parts; to_dict() is the wire format
    service.py    CourseAnalyticsService — the fixed query plan feeding metrics.py

This `__init__` is the only import surface; views import from here.
"""
from .dto import AnalyticsSnapshot
from .periods import InvalidPeriod, Period, parse_period
from .service import CourseAnalyticsService

__all__ = [
    'AnalyticsSnapshot',
    'CourseAnalyticsService',
    'InvalidPeriod',
    'Period',
    'parse_period',
]
