"""
The analytics snapshot and its parts (spec 009, data-model §5). to_dict() is the wire format.

Student identity never appears here: only counts, rates, dates, and course/section
ids and titles (FR-028).
"""
from dataclasses import dataclass
from typing import Literal

from .periods import Bucket, Period, Window


@dataclass(frozen=True)
class CompletionStat:
    rate: float | None
    completed: int
    total: int


@dataclass(frozen=True)
class QuizPassStat:
    rate: float | None
    passed: int
    attempted: int
    has_quizzes: bool


@dataclass(frozen=True)
class SectionDropOff:
    section_id: int
    title: str
    order: int
    count: int


@dataclass(frozen=True)
class CourseDropOff:
    course_id: int
    title: str
    drop_off_rate: float
    not_completed: int
    total: int


def _iso(value):
    return value.isoformat() if value is not None else None


@dataclass(frozen=True)
class AnalyticsSnapshot:
    scope: Literal['course', 'instructor']
    course: dict | None
    period: Period
    window: Window
    completion: CompletionStat
    quiz_pass: QuizPassStat
    active_students: int
    enrollments_over_time: tuple[Bucket, ...]
    section_drop_off: tuple[SectionDropOff, ...] | None = None
    course_drop_off: tuple[CourseDropOff, ...] | None = None
    courses_count: int | None = None

    def to_dict(self) -> dict:
        data = {'scope': self.scope}
        if self.scope == 'course':
            data['course'] = self.course
        data.update({
            'period': self.period.label,
            'window': {'start': _iso(self.window.start), 'end': _iso(self.window.end)},
            'completion': {
                'rate': self.completion.rate,
                'completed': self.completion.completed,
                'total': self.completion.total,
            },
            'quiz_pass': {
                'rate': self.quiz_pass.rate,
                'passed': self.quiz_pass.passed,
                'attempted': self.quiz_pass.attempted,
                'has_quizzes': self.quiz_pass.has_quizzes,
            },
            'active_students': self.active_students,
            'enrollments_over_time': [
                {'start': _iso(b.start), 'end': _iso(b.end), 'count': b.count}
                for b in self.enrollments_over_time
            ],
        })
        if self.scope == 'course':
            data['section_drop_off'] = [
                {'section_id': s.section_id, 'title': s.title, 'order': s.order, 'count': s.count}
                for s in (self.section_drop_off or ())
            ]
        else:
            data['courses_count'] = self.courses_count or 0
            data['course_drop_off'] = [
                {
                    'course_id': c.course_id,
                    'title': c.title,
                    'drop_off_rate': c.drop_off_rate,
                    'not_completed': c.not_completed,
                    'total': c.total,
                }
                for c in (self.course_drop_off or ())
            ]
        return data
