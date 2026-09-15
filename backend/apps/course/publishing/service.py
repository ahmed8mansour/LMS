"""
The transition facade (research R8).

For instructors, every publish and unpublish goes through here and only here
(invariant I2). The order is the whole point:

1. Open a transaction and lock the course row with select_for_update(), so two
   concurrent requests for the same course queue behind each other instead of
   racing, and the response reports the state actually persisted (FR-032).
2. Evaluate readiness INSIDE that transaction, against the row as it is now —
   never a verdict computed earlier for a checklist. That earlier verdict may be
   minutes stale; this one cannot be (FR-014).
3. Let the lifecycle state decide (states.py).
4. Write `is_published` and nothing else, and only if the state changed it.

Why only `is_published`: `last_updated` is auto_now, and Django only refreshes
an auto_now field when it is listed in update_fields. Leaving it out is
deliberate — students see "Last updated" on the public course page, and
republishing an old course must not present unchanged content as fresh.
"""
from django.db import transaction

from apps.course.models import Course
from .dto import ReadinessReport, TransitionResult
from .readiness import PublishReadinessService
from .states import get_course_state

# The same paths InstructorCourseViewSet prefetches; readiness reads only these.
READINESS_PREFETCH = ('section_set__lectures', 'section_set__quiz__question__choice')


class CoursePublishingService:
    def __init__(self, readiness: PublishReadinessService | None = None):
        self.readiness = readiness or PublishReadinessService()

    def publish(self, course: Course) -> tuple[TransitionResult, ReadinessReport]:
        return self._transition(course, lambda state, locked, report: state.publish(locked, report))

    def unpublish(self, course: Course) -> tuple[TransitionResult, ReadinessReport]:
        # The unpublish lambda ignores the report: readiness is never a condition
        # for unpublishing (FR-016). It is still computed so the response can show
        # what now stands between this draft and republishing.
        return self._transition(course, lambda state, locked, report: state.unpublish(locked))

    def _transition(self, course, apply):
        with transaction.atomic():
            # Re-read rather than trust the caller's instance: it may be stale,
            # and it isn't locked. Prefetch runs as follow-up queries inside the
            # same transaction.
            locked = (
                Course.objects.select_for_update()
                .prefetch_related(*READINESS_PREFETCH)
                .get(pk=course.pk)
            )
            report = self.readiness.evaluate(locked)
            result = apply(get_course_state(locked), locked, report)

            if result.changed:
                locked.save(update_fields=['is_published'])
                # status and needs_attention depend on is_published, so the report
                # taken before the flip is out of date. Re-evaluating costs no
                # queries — the relations are already cached on `locked`.
                report = self.readiness.evaluate(locked)

        return result, report
