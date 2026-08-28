# Phase 0 Research: Instructor Curriculum Builder

All unknowns from the Technical Context are resolved below. Each decision records what was chosen, why,
and the alternatives rejected. There are **no remaining NEEDS CLARIFICATION** items (the four spec-level
ambiguities were settled in `/speckit.clarify`).

---

## R1 — Questions & Choices authoring API (net-new backend surface)

**Decision**: Add `QuestionSerializer` and `ChoiceSerializer`, and two ownership-scoped viewsets
`InstructorQuestionViewSet` / `InstructorChoiceViewSet`, registered at
`/courses/instructor/questions/` and `/courses/instructor/choices/`, mirroring the existing
`InstructorSection/Lecture/QuizViewSet` pattern exactly:

- `permission_classes = [IsAuthenticated, isInstructor]`, `authentication_classes = [CookieJWTAuthentication]`.
- `get_queryset` filters through the owning course:
  - Questions: `Question.objects.filter(quiz__section__course__instructor=self.request.user.instructor_profile)`
  - Choices: `Choice.objects.filter(question__quiz__section__course__instructor=…)`
  - Wrapped in the same `try/except InstructorProfile.DoesNotExist → .none()` guard used everywhere else.
- `perform_create` re-checks that the referenced parent (`quiz` / `question`) belongs to the caller,
  raising `ValidationError({"error": …})` otherwise — identical to the section/lecture/quiz viewsets.
- **List filtering for the editor**: support `?quiz=<id>` on questions and `?question=<id>` on choices
  (simple `filterset`/`get_queryset` param) so the quiz editor can load one quiz's content. Choices are
  **also nested read-only inside `QuestionSerializer`**, so listing questions for a quiz returns each
  question with its choices in a single call (fewer round-trips).

**Rationale**: The pattern is already proven and ownership-safe in this codebase; copying it keeps the new
surface consistent and reviewable. Nesting choices for reads matches how `SectionSerializer` already nests
lectures/quiz. Writes stay flat (one resource per request) so create/update/delete remain simple REST.

**Alternatives considered**:
- *Fully nested writes* (submit a whole quiz with questions+choices in one payload) — rejected: heavier
  serializer logic, partial-update ambiguity, and worse inline-error mapping than per-item writes.
- *Reuse admin question/choice endpoints* — none exist; admin family only covers course/section/lecture/quiz.
- *GraphQL-style single endpoint* — out of stack; the project is REST-only.

---

## R2 — Ordering: auto-assign on create + collision-safe reorder (per-item, transactional)

**Decision**: Two complementary behaviours on the existing `InstructorSectionViewSet` /
`InstructorLectureViewSet` (and `order` on questions):

1. **Auto-assign order on create**: in `perform_create`, if `order` is omitted, set it to
   `(max sibling order or 0) + 1` so new items append to the end. The client never computes positions.
2. **Collision-safe reorder on order change**: when an update changes `order`, run a small helper
   (`apps/course/reorder.py`) inside `transaction.atomic()` that renumbers the affected parent's children
   so the target lands at the requested position and siblings shift, **without ever holding two rows at the
   same `(parent, order)`**. Because Postgres checks `UNIQUE` constraints per-statement (not deferred), the
   helper first moves the affected rows to a temporary **out-of-range offset** (e.g. `order + 100000` or
   negatives), then writes the final compacted `0..n-1` sequence — a standard two-phase renumber. This is
   still driven by a **per-item PATCH** (the client PATCHes the moved item's new `order`); the server does
   the safe renumber. **No new batch/bulk endpoint** is introduced (per the clarified decision).

For **questions**, `Question.order` has **no** DB uniqueness, so reorder is a plain value update; the same
helper is applied for gap-free consistency but cannot collide.

**Rationale**: Honors the clarified "per-item PATCH, transactional, no new endpoint" decision while
actually being safe under `unique_together`. The temp-offset two-phase renumber is the well-known way to
reorder rows under a non-deferrable unique constraint without a schema change. Auto-assign removes an
entire class of client/order races.

**Alternatives considered**:
- *Dedicated batch-reorder endpoint* accepting the full new order — explicitly rejected in clarification
  (and would be a new endpoint); kept in Out of Scope.
- *Deferrable unique constraint* (`DEFERRABLE INITIALLY DEFERRED`) so intermediate duplicates are allowed
  until commit — rejected: requires a **migration** altering the existing constraint (Hard Rule friction)
  and changes model semantics for the student/admin families.
- *Fractional ordering* (float/lexicographic ranks) — rejected: changes the `IntegerField` contract and
  the student/admin serializers; over-engineered for tens of items.

---

## R3 — Lecture duration: mm:ss entry, decimal-**minutes** storage (no migration)

**Decision**: Keep `Lecture.duration = DecimalField(max_digits=6, decimal_places=2)` unchanged and treat
its stored value as **minutes** (the existing convention). The instructor enters and reads **mm:ss**; a
frontend helper (`lib/duration.ts`) converts:

- parse `mm:ss` → `minutes = mm + ss/60`, rounded to 2 decimals, for the write payload;
- format `minutes` → `mm:ss` (`m = floor(v)`, `s = round((v - m) * 60)`, carry `60 → +1m`) for display.

Backend validation: `duration` must be a positive `Decimal` within the field's range; the mm:ss parsing
and "positive, well-formed" checks live in the Zod schema client-side, with the server as the backstop.

**Rationale**: The existing student surface already interprets `duration` as decimal minutes —
`front-end/src/featuers/courses/hooks/useCourseStats.tsx` does `totalMinutes += parseFloat(lecture.duration)`.
Storing minutes preserves that aggregation and the student course-detail display unchanged, with **no
migration and no student-side edit**. The ~0.6s rounding granularity (0.01 min) is immaterial for lecture
listings.

**Alternatives considered**:
- *Store total seconds* — rejected: would break `useCourseStats` (minutes) and any student duration
  display, and/or force a data migration and re-interpretation of existing rows.
- *Store raw `MM.SS` (e.g. 4.20 = 4:20)* — rejected: mathematically wrong for summation (4.20 + 4.50 ≠
  9:10) and would corrupt `useCourseStats`.
- *Change the field to a `DurationField`/interval* — rejected: migration + student-side changes, out of
  scope.

---

## R4 — Drag-to-reorder interaction library

**Decision**: Add **`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`** for the section and
lecture reorder interactions, wrapped in a single `SortableList` component. Provide keyboard reordering
(dnd-kit's built-in `KeyboardSensor`) as the accessible path, and optimistic UI with rollback on the
reorder mutation's error.

**Rationale**: No drag library is currently installed. `@dnd-kit` is the de-facto React sortable library,
is React 19 compatible, is accessible (keyboard + screen-reader announcements) satisfying Constitution
principle II's UX bar, and is tree-shakeable with no global state. The spec and wireframes call for drag
handles (`⋮⋮`); dnd-kit delivers this without hand-rolling pointer math.

**Alternatives considered**:
- *Native HTML5 drag-and-drop* — rejected: poor touch support, no built-in keyboard/a11y, fiddly for
  vertical lists.
- *`react-beautiful-dnd`* — rejected: effectively unmaintained and not React 19-ready.
- *Up/Down buttons only (no dep)* — rejected as the primary interaction (spec says "drag"), but the same
  reorder mutation powers dnd-kit's keyboard sensor, so an equivalent accessible fallback exists for free.

---

## R5 — `Quiz.questions_count`: server-managed, and the latent create bug it fixes

**Decision**: Make `questions_count` **read-only with default `0`** in `QuizSerializer`, and **recompute**
it (`quiz.questions_count = quiz.question.count()`, saved) after every question create and delete in
`InstructorQuestionViewSet.perform_create` / `perform_destroy`. Clients never send it.

**Rationale**: The clarified decision is server-maintained counts. As a bonus this fixes a real latent bug:
`Quiz.questions_count` is a required `IntegerField` with **no default**, so today creating a quiz through
the instructor endpoint would require the client to supply a count — brittle and mass-assignable. Making it
read-only+default mirrors 004's treatment of `rating`/`subscribers_count`/`is_published` on the instructor
course serializer. Recompute-on-write (rather than increment/decrement) is idempotent and self-healing.

**Alternatives considered**:
- *Django signals on `Question` post_save/post_delete* — viable, but the codebase favors explicit
  view/service logic; recompute in the viewset keeps the behaviour local and testable. (Signals noted as an
  acceptable equivalent.)
- *Client-supplied count* — rejected in clarification (drift risk).
- *Drop the field / compute on read* — rejected: would be a model change (migration) and alter the
  student/admin quiz shape.

---

## R6 — Exactly-one-correct choice enforcement

**Decision**: Enforce server-side. When a choice is created or updated with `is_correct = true`, within
`transaction.atomic()` set `is_correct = false` on all **other** choices of the same question before
saving the target. A question is considered **complete** (for UI flagging and the future 007 readiness
check) when it has text, ≥2 choices, and exactly one correct choice — but incomplete questions may persist
mid-edit (not blocked).

**Rationale**: Matches FR-009/FR-010. Server enforcement guarantees the invariant regardless of client
behaviour or race conditions; the transaction prevents a window with zero or two correct choices.

**Alternatives considered**:
- *Client-only enforcement* — rejected: invariant could be violated by direct API calls (the ownership
  gate lets an owner hit the endpoint directly).
- *DB partial unique index (`is_correct = true` unique per question)* — rejected: requires a migration and
  makes the "unset old, set new" update order-sensitive/fragile; app-level swap in a transaction is
  simpler and needs no schema change.

---

## R7 — Reading the curriculum tree (reuse) vs. quiz content (new)

**Decision**: Load **structure** (sections → lectures → quiz-stub) from the existing
`GET /courses/instructor/courses/{id}/` (the `InstructorCourseSerializer` already nests it), selecting the
`sections` slice via a `useCurriculum` hook over the course query — no new structure endpoint. Load **quiz
content** (questions + nested choices) from the new `GET /courses/instructor/questions/?quiz=<id>` when the
quiz editor opens.

**Rationale**: The structural read is already paid for by the workspace, so the builder is instant and
consistent with the Overview/Curriculum tabs sharing one cache entry. Only the genuinely-absent data
(questions/choices) needs a new read. Keeps round-trips minimal and cache invalidation simple (structure
mutations invalidate the course query; quiz mutations invalidate the quiz-content query).

**Alternatives considered**:
- *New dedicated curriculum-tree endpoint* — rejected: duplicates data the course retrieve already returns.
- *Nest questions/choices into the course/quiz retrieve* — rejected: bloats the workspace payload with quiz
  internals rarely needed on the Curriculum/Overview tabs; lazy-load per quiz instead.

---

## R8 — Enrollment-aware delete confirmation (reuse of 004's pattern)

**Decision**: Reuse the enrollment-aware confirmation approach established in 004's `DeleteCourseDialog`:
a single `DeleteCurriculumItemDialog` whose copy escalates when the containing course has enrolled
students (naming the permanent-removal + loss-of-access consequence) and is lighter otherwise. Enrollment
presence is read from the course the workspace already knows (or a cheap count), never modified.

**Rationale**: Consistency with the course-level delete guard (spec 004, FR-014) and the clarified
requirement (FR-013). No new backend needed — cascade delete already exists on the models.

**Alternatives considered**:
- *Always-heavy confirmation* — rejected: needless friction for empty drafts (spec calls for a lighter
  path when there are no enrollments).
- *No confirmation for leaf items (choices/questions)* — rejected: FR-013 requires explicit confirmation
  before any curriculum deletion; leaf deletions use the lighter copy.
