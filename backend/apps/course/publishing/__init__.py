"""
Course publishing: the draft/published lifecycle and its readiness gate (spec 007).

    states.py     CourseState → DraftState | PublishedState, get_course_state()
    readiness.py  PublishReadinessService — the one definition of "ready"
    service.py    CoursePublishingService — atomic, locked, re-evaluated transitions
    dto.py        ReadinessItem, ReadinessReport, TransitionResult

Import from here, not from the submodules.
"""
from .dto import ReadinessItem, ReadinessReport, TransitionResult
from .readiness import PublishReadinessService
from .service import READINESS_PREFETCH, CoursePublishingService
from .states import get_course_state

__all__ = [
    'CoursePublishingService',
    'PublishReadinessService',
    'READINESS_PREFETCH',
    'ReadinessItem',
    'ReadinessReport',
    'TransitionResult',
    'get_course_state',
]
