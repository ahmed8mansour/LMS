"""The earnings snapshot and its parts (spec 013, data-model §3). to_dict() is the wire format.

**Money leaves this module as a quantised string, never a float.** JSON has one numeric
type and it is a float; cents do not survive it, and this page's entire claim is that its
columns add up to its tiles (research P3). A `float()` anywhere in this file renders fine
and stops reconciling somewhere past the fourth row, which is the hardest kind of bug to
be told about. The client's `formatMoney(amount: string)` already expects this shape, and
the Zod schema rejects anything that is not `^\\d+\\.\\d{2}$`.

No buyer ever appears here: only amounts, counts, dates, and course ids and titles
(FR-033).
"""
from dataclasses import dataclass
from decimal import Decimal

from .periods import Bucket, Period, Window

CENTS = Decimal('0.01')


def _money(value: Decimal) -> str:
    return f"{value.quantize(CENTS)}"


def _iso(value):
    return value.isoformat() if value is not None else None


@dataclass(frozen=True)
class EarningsStats:
    total_revenue: Decimal
    refunds: Decimal
    net: Decimal
    sales: int


@dataclass(frozen=True)
class CourseEarnings:
    course_id: int
    title: str
    sales: int
    revenue: Decimal


@dataclass(frozen=True)
class EarningsSnapshot:
    period: Period
    window: Window
    stats: EarningsStats
    trend: tuple[Bucket, ...]
    courses: tuple[CourseEarnings, ...]
    courses_count: int
    has_sales_ever: bool
    currency: str = 'USD'

    def to_dict(self) -> dict:
        return {
            'period': self.period.value,
            'window': {'start': _iso(self.window.start), 'end': _iso(self.window.end)},
            'currency': self.currency,
            'stats': {
                'total_revenue': _money(self.stats.total_revenue),
                'refunds': _money(self.stats.refunds),
                'net': _money(self.stats.net),
                'sales': self.stats.sales,
            },
            'trend': [
                {'start': _iso(b.start), 'end': _iso(b.end), 'amount': _money(b.amount)}
                for b in self.trend
            ],
            'courses': [
                {
                    'id': c.course_id,
                    'title': c.title,
                    'sales': c.sales,
                    'revenue': _money(c.revenue),
                }
                for c in self.courses
            ],
            'courses_count': self.courses_count,
            'has_sales_ever': self.has_sales_ever,
        }
