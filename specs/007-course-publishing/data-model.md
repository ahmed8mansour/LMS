# Phase 1 Data Model: Course Publishing & Readiness Gate

**Migrations: none.** No model gains, loses, or changes a field. This document describes the *derived*
structures (the state machine and the readiness report) and the invariants they enforce over data that
already exists.

---

## 1. Persisted data — unchanged

| Model | Field | Role in this feature |
|-------|-------|----------------------|
| `Course` | `is_published: BooleanField` | **The single persisted fact** of the lifecycle. Already filtered on by every student-facing query (`StudentCourseViewSet`, homepage, section/lecture/quiz student querysets), by enrollment (`CreatePaymentSerializer`, free enrollment), and by `get_instructor_rating()`. This feature writes it **only** through `CoursePublishingService`. |
| `Course` | `thumbnail: URLField(null=True)` | Blocking condition (a). Null or blank ⇒ blocker. |
| `Course` | `language`, `goals_list` | Advisory conditions only. Never block. |
| `Course` | `price` | Read for nothing. Explicitly **not** a condition — zero is valid (FR-011). |
| `Course` | `subscribers_count` | Read-only, for the unpublish confirmation's student count (R11). |
| `Course` | `last_updated: auto_now` | **Not** bumped by publish/unpublish — `update_fields=['is_published']` skips `auto_now`, and students see this field on the public course page (R8). |
| `Section` | `course` FK (reverse: `section_set`) | Blocking conditions (b) and (c). |
| `Lecture` | `section` FK (reverse: `lectures`), `video_status`, `video_public_id` | Blocking condition (d). Only `COMPLETED` qualifies. |
| `Quiz` | `section` O2O (reverse: `quiz`) | Blocking condition (e) — **only when present**. |
| `Question` | `quiz` FK (reverse: `question`), `text` | Blocking condition (e). |
| `Choice` | `question` FK (reverse: `choice`), `is_correct` | Blocking condition (e). |

Reverse accessor spellings above are the existing ones, singular `question` / `choice` included.

**Write surface**: `is_published` stays `read_only` on `InstructorCourseSerializer` (as it is today), so no
metadata path can change it (FR-003). The admin `CourseSerializer` keeps its existing writable access — the
admin surface is untouched by this feature.

---

## 2. The lifecycle state machine (derived, not stored)

```text
                    publish()  [gated: readiness.is_publishable]
        ┌─────────┐ ──────────────────────────────────────────▶ ┌───────────────┐
        │  DRAFT  │                                              │   PUBLISHED   │
        │         │ ◀────────────────────────────────────────── │               │
        └─────────┘            unpublish()  [ungated]            └───────────────┘
             ▲                                                         ▲
             │ unpublish() → no-op (changed=False)                      │ publish() → no-op (changed=False)
             └─────────────────────────────────────────────────────────┘

get_course_state(course) = PublishedState() if course.is_published else DraftState()
```

### Transition matrix

| Current state | Action | Readiness consulted | Outcome |
|---|---|---|---|
| `DraftState` | `publish()` | **Yes** | Ready ⇒ `is_published = True`, `changed=True`. Not ready ⇒ **refused**, nothing written, blockers returned. |
| `DraftState` | `unpublish()` | No | No-op. `changed=False`, `already=True`. |
| `PublishedState` | `publish()` | No | No-op. `changed=False`, `already=True`. |
| `PublishedState` | `unpublish()` | No | `is_published = False`, `changed=True`. |

### Invariants

- **I1 — The state is never persisted.** `is_published` is the only stored fact; the state object is built
  from it on each use. There is no second source of truth to drift.
- **I2 — Only `CoursePublishingService` writes `is_published`** (for instructors). Every write happens
  inside `transaction.atomic()` on a `select_for_update()`-locked row, with `update_fields=['is_published']`.
- **I3 — The gate is evaluated inside the write transaction**, never reused from an earlier read (FR-014).
- **I4 — A refused publish writes nothing.** No partial state, no counters touched, no side effects.
- **I5 — No automatic transition exists.** Nothing in the codebase may flip `is_published` outside an
  explicit instructor or admin action (FR-023). There is no signal, no scheduled job, and no cascade that
  can unpublish a course.
- **I6 — Unpublishing touches nothing else.** No `Enrollment`, `Order`, `Transaction`, `LectureProgress`,
  `QuizAttempt`, or `Review` row is read for a write or modified (FR-031). Enrolled students keep access
  because no progress or video-access path filters on `is_published` — verified: `apps/progress/views.py`
  gates on active enrollment alone, and `can_access_lecture_video()` on enrollment/ownership/admin.

---

## 3. The readiness report (computed, not stored)

```text
ReadinessReport
├── status: 'draft' | 'published'        # the current state's name
├── is_publishable: bool                 # no blocking items
├── needs_attention: bool                # status == 'published' and not is_publishable
├── blockers:   list[ReadinessItem]      # severity == 'blocking'
└── advisories: list[ReadinessItem]      # severity == 'advisory'

ReadinessItem
├── code: str          # stable machine identifier — the client's link key
├── severity: 'blocking' | 'advisory'
├── message: str       # display-ready human text
└── target: dict|None  # {'kind': 'course'|'section'|'lecture'|'quiz', 'id': int, 'section_id': int?}
```

All three are frozen dataclasses in `publishing/dto.py`. They are serialized by hand in the action (plain
dicts), not by a DRF serializer — there is no model behind them and the shape is flat.

### Blocking codes

| Code | Raised when | `target` | Maps to |
|---|---|---|---|
| `missing_thumbnail` | `thumbnail` is null or blank | `{kind: 'course', id}` | FR-009a |
| `no_sections` | the course has zero sections | `{kind: 'course', id}` | FR-009b |
| `empty_section` | a section has zero lectures — **one item per offending section** | `{kind: 'section', id}` | FR-009c |
| `lecture_video_missing` | `video_status == 'PENDING'` (strictly: no video attached, per 006) | `{kind: 'lecture', id, section_id}` | FR-009d |
| `lecture_video_processing` | `video_status == 'PROCESSING'` | `{kind: 'lecture', id, section_id}` | FR-009d |
| `lecture_video_failed` | `video_status == 'FAILED'` | `{kind: 'lecture', id, section_id}` | FR-009d |
| `quiz_no_questions` | a quiz exists with zero questions | `{kind: 'quiz', id, section_id}` | FR-009e |
| `quiz_incomplete_question` | a quiz has ≥1 incomplete question — **one item per quiz**, message names how many | `{kind: 'quiz', id, section_id}` | FR-009e |

Three distinct video codes rather than one: FR-015 and the spec's edge cases require the instructor to be
told *which* problem it is, because the remedy differs — wait, retry, or upload.

`empty_section` is per-section (the instructor needs to know *which* ones) while
`quiz_incomplete_question` is per-quiz with a count (the quiz editor is the single destination for all of
its questions, so per-question items would be noise with identical links).

### Advisory codes

| Code | Raised when |
|---|---|
| `no_language` | `language` is blank |
| `no_goals` | `goals_list` is empty |
| `no_quizzes` | no section has a quiz |

Advisories are informational only and never affect `is_publishable` (FR-012). They exist so the checklist
reads as guidance rather than a pass/fail wall.

### The read-side completeness predicate

A question is **complete** when: `text` is non-blank after stripping, it has **at least two** choices, and
**exactly one** of them has `is_correct=True`. This mirrors 005 FR-010 and the client's
`isQuestionComplete()`; see research R4 for why the duplication across tiers is unavoidable and how it is
contained. Cross-reference comments live at both sites.

### Evaluation order and cost

Conditions are evaluated cheapest-first (course fields, then sections, then lectures, then quizzes) but
**all** are always evaluated — the report is never short-circuited, because the instructor needs every
blocker at once, not the first one (FR-015).

Cost is zero additional queries when the course was loaded through
`InstructorCourseViewSet.get_queryset()`, which prefetches `section_set__lectures` and
`section_set__quiz__question__choice` (research R5). The service reads only prefetched relations and must
not introduce a `.filter()` on a related manager, which would defeat the prefetch.

---

## 4. Serializer additions

`InstructorCourseSerializer` (instructor only — the student `CourseSerializer` is untouched):

| Field | Type | Source |
|---|---|---|
| `is_publishable` | `bool`, read-only | `PublishReadinessService.evaluate(obj).is_publishable` |
| `needs_attention` | `bool`, read-only | `… .needs_attention` |

Both are `SerializerMethodField`s. They deliberately expose only the booleans: the full itemized report is
one extra round trip on the Overview, and the card needs nothing more than a badge (research R6).

---

## 5. Frontend types

```ts
type ReadinessSeverity = 'blocking' | 'advisory';

type ReadinessCode =
  | 'missing_thumbnail' | 'no_sections' | 'empty_section'
  | 'lecture_video_missing' | 'lecture_video_processing' | 'lecture_video_failed'
  | 'quiz_no_questions' | 'quiz_incomplete_question'
  | 'no_language' | 'no_goals' | 'no_quizzes';

interface ReadinessTarget { kind: 'course' | 'section' | 'lecture' | 'quiz'; id: number; section_id?: number }
interface ReadinessItem   { code: ReadinessCode; severity: ReadinessSeverity; message: string; target: ReadinessTarget | null }
interface ReadinessReport {
  status: CourseStatus; is_publishable: boolean; needs_attention: boolean;
  blockers: ReadinessItem[]; advisories: ReadinessItem[];
}
```

`InstructorCourse` gains `is_publishable: boolean` and `needs_attention: boolean`.

`readinessHref(courseId, item)` maps a code to the route that fixes it. Because `ReadinessCode` is a literal
union, a `switch` over it is exhaustiveness-checked — adding a code on the backend without mapping it becomes
a TypeScript error rather than a silently dead link.

| Code | Destination |
|---|---|
| `missing_thumbnail`, `no_language`, `no_goals` | `/instructor/courses/{courseId}/edit` |
| `no_sections`, `empty_section`, `no_quizzes` | `/instructor/courses/{courseId}/curriculum` |
| `lecture_video_*` | `/instructor/courses/{courseId}/curriculum/lectures/{target.id}` |
| `quiz_*` | `/instructor/courses/{courseId}/quizzes/{target.id}` |
