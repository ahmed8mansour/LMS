"""
Plain data carriers for the instructor dashboard (spec 008, data-model.md §4).

Nothing here is persisted: every value is computed on read from existing tables and
thrown away after the response. Frozen, with tuples rather than lists, following
publishing/dto.py, so a snapshot can't be edited after the service builds it.

`AttentionItem.created_at` exists only so attention.rank() can break ties by course
age. It is not part of the API contract, so to_dict() drops it.
"""
from dataclasses import asdict, dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal

from rest_framework import serializers

AttentionType = Literal['live_needs_attention', 'video_failed', 'ready_to_publish', 'draft_in_progress']
Mode = Literal['onboarding', 'full']


@dataclass(frozen=True)
class PersonRef:
    name: str
    avatar: str | None


@dataclass(frozen=True)
class CourseRef:
    id: int
    title: str


@dataclass(frozen=True)
class RecentEnrollment:
    id: int
    enrolled_at: datetime
    student: PersonRef
    course: CourseRef


@dataclass(frozen=True)
class RecentReview:
    id: int
    rating: int
    comment: str
    created_at: datetime
    reviewer: PersonRef
    course: CourseRef


# ======================================

@dataclass(frozen=True)
class AttentionTarget:
    kind: Literal['course', 'lecture']
    course_id: int
    lecture_id: int | None


@dataclass(frozen=True)
class AttentionItem:
    type: AttentionType
    course: CourseRef
    is_published: bool
    blocker_count: int
    active_students: int
    failed_lecture_ids: tuple[int, ...]
    target: AttentionTarget
    # Sorting only — never serialized (see module docstring).
    created_at: datetime


@dataclass(frozen=True)
class NeedsAttention:
    total: int
    items: tuple[AttentionItem, ...]


# ======================================

@dataclass(frozen=True)
class OnboardingProgress:
    profile_complete: bool
    has_course: bool
    has_curriculum: bool
    has_ready_video: bool
    has_published_course: bool


# ======================================

@dataclass(frozen=True)
class CourseCounts:
    total: int
    published: int


@dataclass(frozen=True)
class StudentCounts:
    distinct: int
    enrollments: int


@dataclass(frozen=True)
class Rating:
    avg_rating: float | None
    reviews_count: int


@dataclass(frozen=True)
class Earnings:
    amount: Decimal
    currency: str = 'USD'


# ======================================

def _datetime(value: datetime) -> str:
    # Same formatting (and timezone handling) as every DateTimeField in the API.
    return serializers.DateTimeField().to_representation(value)


@dataclass(frozen=True)
class DashboardSnapshot:
    mode: Mode
    instructor_name: str
    courses: CourseCounts
    students: StudentCounts
    rating: Rating
    earnings: Earnings
    recent_enrollments: tuple[RecentEnrollment, ...]
    recent_reviews: tuple[RecentReview, ...]
    needs_attention: NeedsAttention
    onboarding: OnboardingProgress

    def to_dict(self) -> dict:
        # asdict() keeps tuples as tuples and datetimes/Decimals as Python objects; the
        # contract is JSON arrays, ISO strings, and a decimal string for money (never a
        # float). response.data should already match the wire format.
        return {
            'mode': self.mode,
            'instructor_name': self.instructor_name,
            'courses': asdict(self.courses),
            'students': asdict(self.students),
            'rating': asdict(self.rating),
            'earnings': {
                'amount': f"{self.earnings.amount.quantize(Decimal('0.01'))}",
                'currency': self.earnings.currency,
            },
            'recent_enrollments': [
                {
                    'id': e.id,
                    'enrolled_at': _datetime(e.enrolled_at),
                    'student': asdict(e.student),
                    'course': asdict(e.course),
                }
                for e in self.recent_enrollments
            ],
            'recent_reviews': [
                {
                    'id': r.id,
                    'rating': r.rating,
                    'comment': r.comment,
                    'created_at': _datetime(r.created_at),
                    'reviewer': asdict(r.reviewer),
                    'course': asdict(r.course),
                }
                for r in self.recent_reviews
            ],
            'needs_attention': {
                'total': self.needs_attention.total,
                'items': [
                    {
                        'type': item.type,
                        'course': asdict(item.course),
                        'is_published': item.is_published,
                        'blocker_count': item.blocker_count,
                        'active_students': item.active_students,
                        'failed_lecture_ids': list(item.failed_lecture_ids),
                        'target': asdict(item.target),
                    }
                    for item in self.needs_attention.items
                ],
            },
            'onboarding': asdict(self.onboarding),
        }
