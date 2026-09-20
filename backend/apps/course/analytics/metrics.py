"""
The analytics definitions (spec 009, research R5). Pure: no ORM.

The service turns rows into these plain shapes; everything the clarifications decided
lives here, so each definition is a database-free unit test.
"""
from dataclasses import dataclass, field
from typing import Iterable, Mapping

from .dto import CourseDropOff, SectionDropOff


@dataclass(frozen=True)
class SectionShape:
    section_id: int
    title: str
    order: int
    lecture_count: int
    quiz_id: int | None


@dataclass(frozen=True)
class CourseShape:
    course_id: int
    title: str
    # Curriculum order.
    sections: tuple[SectionShape, ...]

    @property
    def lecture_total(self) -> int:
        return sum(section.lecture_count for section in self.sections)

    @property
    def quiz_ids(self) -> tuple[int, ...]:
        return tuple(section.quiz_id for section in self.sections if section.quiz_id is not None)


@dataclass(frozen=True)
class StudentCourseProgress:
    # section_id -> number of completed lectures in it (current lectures only).
    done_by_section: Mapping[int, int] = field(default_factory=dict)
    passed_quiz_ids: frozenset[int] = frozenset()
    attempted_quiz_ids: frozenset[int] = frozenset()


def section_completed(section: SectionShape, progress: StudentCourseProgress) -> bool:
    # Restates the rule of apps.progress.utils.is_section_unlocked (the next section
    # unlocks once this one's quiz is passed, or — without a quiz — once every lecture
    # is done). That helper is per-student and runs several queries per section, so it
    # can't serve a cohort; an agreement test pins the two together (research R6).
    if section.quiz_id is not None:
        return section.quiz_id in progress.passed_quiz_ids
    return section.lecture_count >= 1 and progress.done_by_section.get(section.section_id, 0) >= section.lecture_count


def _section_has_open_work(section: SectionShape, progress: StudentCourseProgress) -> bool:
    lectures_open = progress.done_by_section.get(section.section_id, 0) < section.lecture_count
    quiz_open = section.quiz_id is not None and section.quiz_id not in progress.passed_quiz_ids
    return lectures_open or quiz_open


def course_completed(course: CourseShape, progress: StudentCourseProgress) -> bool:
    # Deliberately stricter than review eligibility (lectures only): every current
    # lecture AND every current quiz (clarification Q4), so a student stuck on a quiz
    # is never counted as finished and always has a stuck section.
    if course.lecture_total == 0 and not course.quiz_ids:
        return False
    return not any(_section_has_open_work(section, progress) for section in course.sections)


def stuck_section(course: CourseShape, progress: StudentCourseProgress) -> SectionShape | None:
    """The section right after the highest-ordered completed one (FR-015); None if completed."""
    if not course.sections or course_completed(course, progress):
        return None

    highest = None
    for index, section in enumerate(course.sections):
        if section_completed(section, progress):
            highest = index

    if highest is None:
        return course.sections[0]
    if highest + 1 < len(course.sections):
        return course.sections[highest + 1]

    # Every section counts as completed by the unlock rule, yet the course isn't —
    # progress is no longer contiguous after a curriculum edit (e.g. a lecture added
    # to a section whose quiz was already passed). Point at the first open work.
    for section in course.sections:
        if _section_has_open_work(section, progress):
            return section
    return course.sections[-1]


def rate(numerator: int, denominator: int) -> float | None:
    if denominator == 0:
        return None
    return round(numerator / denominator, 4)


def quiz_pair_counts(progresses: Iterable[StudentCourseProgress]) -> tuple[int, int]:
    """(passed, attempted) over (student, quiz) pairs — retakes collapse into one pair."""
    passed = attempted = 0
    for progress in progresses:
        attempted += len(progress.attempted_quiz_ids)
        passed += len(progress.passed_quiz_ids & progress.attempted_quiz_ids)
    return passed, attempted


def section_drop_off(course: CourseShape, progresses: Iterable[StudentCourseProgress]) -> list[SectionDropOff]:
    """Every current section in curriculum order, with how many students are stuck there."""
    counts = {section.section_id: 0 for section in course.sections}
    for progress in progresses:
        section = stuck_section(course, progress)
        if section is not None:
            counts[section.section_id] += 1
    return [
        SectionDropOff(section_id=s.section_id, title=s.title, order=s.order, count=counts[s.section_id])
        for s in course.sections
    ]


def course_drop_off(entries: Iterable[tuple[CourseShape, int, int]]) -> list[CourseDropOff]:
    """entries: (course, completed, total). Lowest completion first (FR-019a).

    Ranked by rate, not count, so the courses students least often finish surface
    regardless of size; the counts travel with each bar, so a tiny course reads as tiny.
    """
    bars = []
    for course, completed, total in entries:
        if total == 0:
            continue
        not_completed = total - completed
        bars.append(CourseDropOff(
            course_id=course.course_id,
            title=course.title,
            drop_off_rate=round(not_completed / total, 4),
            not_completed=not_completed,
            total=total,
        ))
    bars.sort(key=lambda bar: (-bar.drop_off_rate, -bar.not_completed, bar.title, bar.course_id))
    return bars
