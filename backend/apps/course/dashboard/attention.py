"""
Needs attention: which courses need the instructor, and in what order (spec 008).

Pure functions over already-evaluated data — no ORM access — so the ordering rules
(clarification Q2) are testable without a database (research R3, R4).

Readiness is 007's verdict and must never be re-derived here (FR-014): every decision
below reads the ReadinessReport, including "failed video", which is the existing
`lecture_video_failed` blocker. `lecture_video_processing` is deliberately NOT matched:
a processing video is waiting, not a problem (FR-016).
"""
from apps.course.publishing import ReadinessReport
from .dto import AttentionItem, AttentionTarget, AttentionType, CourseRef

RANK: dict[AttentionType, int] = {
    'live_needs_attention': 1,
    'video_failed': 2,
    'ready_to_publish': 3,
    'draft_in_progress': 4,
}

MAX_ITEMS = 5


def classify(course, report: ReadinessReport, active_students: int) -> AttentionItem | None:
    """
    Classify one course, first match wins, so a course yields at most one item under
    its most severe issue (FR-013). Returns None for a healthy published course.

    `course` needs only `id`, `title`, `is_published`, and `created_at`.
    """
    failed_lecture_ids = tuple(
        blocker.target['id']
        for blocker in report.blockers
        if blocker.code == 'lecture_video_failed' and blocker.target
    )

    if report.needs_attention:
        # Published and failing readiness. A failed video on a live course lands here
        # too, which is why 'video_failed' below only ever applies to drafts.
        item_type: AttentionType = 'live_needs_attention'
    elif course.is_published:
        return None
    elif failed_lecture_ids:
        item_type = 'video_failed'
    elif report.is_publishable:
        item_type = 'ready_to_publish'
    else:
        item_type = 'draft_in_progress'

    if item_type == 'video_failed' and len(failed_lecture_ids) == 1:
        target = AttentionTarget(kind='lecture', course_id=course.id, lecture_id=failed_lecture_ids[0])
    else:
        target = AttentionTarget(kind='course', course_id=course.id, lecture_id=None)

    return AttentionItem(
        type=item_type,
        course=CourseRef(id=course.id, title=course.title),
        is_published=course.is_published,
        blocker_count=len(report.blockers),
        active_students=active_students,
        failed_lecture_ids=failed_lecture_ids,
        target=target,
        created_at=course.created_at,
    )


def _sort_key(item: AttentionItem) -> tuple:
    if item.type in ('live_needs_attention', 'video_failed'):
        secondary = -item.active_students   # more students affected first
    elif item.type == 'draft_in_progress':
        secondary = item.blocker_count      # closest to publishable first
    else:
        secondary = 0                       # ready_to_publish: falls through to newest
    # -course.id is the final tiebreak: created_at isn't unique, and FR-017a requires
    # the same data to always produce the same five items.
    return (RANK[item.type], secondary, -item.created_at.timestamp(), -item.course.id)


def rank(items: list[AttentionItem]) -> list[AttentionItem]:
    """Order items by severity, then by the per-type rule in clarification Q2."""
    return sorted(items, key=_sort_key)
