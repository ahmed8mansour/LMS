"""
The course lifecycle, modelled with the State pattern (research R1).

Each state owns what it permits:

                  publish()                  unpublish()
    DraftState    gated on readiness         no-op (already a draft)
    PublishedState no-op (already live)      ungated flip back to draft

Two rules keep this deliberately small:

- The state is DERIVED from `course.is_published` on every use and never
  stored. The boolean stays the single source of truth that every student-facing
  query already filters on, so there is no second copy to drift (invariant I1).
- States own transitions only. They are HANDED a readiness report; they never
  inspect sections, lectures, or quizzes themselves — that is readiness.py.
  A state that also knew the gate's rules would be the god object this pattern
  is meant to prevent.

States change the in-memory course and report what happened. Persisting that
change — atomically, on a locked row — is CoursePublishingService's job.
"""
from abc import ABC, abstractmethod

from apps.course.models import Course
from .dto import ReadinessReport, TransitionResult


class CourseState(ABC):
    name: str

    @abstractmethod
    def publish(self, course: Course, readiness: ReadinessReport) -> TransitionResult:
        ...

    @abstractmethod
    def unpublish(self, course: Course) -> TransitionResult:
        ...


class DraftState(CourseState):
    name = 'draft'

    def publish(self, course, readiness):
        if not readiness.is_publishable:
            # Refuse without touching the course (invariant I4) and hand back
            # every blocker, not just the first (FR-015).
            return TransitionResult(
                changed=False,
                status=self.name,
                detail="This course isn't ready to publish yet.",
                refused=True,
                blockers=readiness.blockers,
            )
        course.is_published = True
        return TransitionResult(
            changed=True, status=PublishedState.name, detail='Your course is live.'
        )

    def unpublish(self, course):
        return TransitionResult(
            changed=False, status=self.name, detail='This course is already a draft.'
        )


class PublishedState(CourseState):
    name = 'published'

    def publish(self, course, readiness):
        # Already live: nothing to gate and nothing to write. A double-click
        # must not come back as an error (FR-005).
        return TransitionResult(
            changed=False, status=self.name, detail='This course is already published.'
        )

    def unpublish(self, course):
        # Ungated by design (FR-016): an instructor can always pull a course,
        # including a broken one — that is often exactly why they are pulling it.
        course.is_published = False
        return TransitionResult(
            changed=True,
            status=DraftState.name,
            detail='Your course is no longer in the catalog.',
        )


def get_course_state(course: Course) -> CourseState:
    """The one place the boolean is mapped to a lifecycle state."""
    return PublishedState() if course.is_published else DraftState()
