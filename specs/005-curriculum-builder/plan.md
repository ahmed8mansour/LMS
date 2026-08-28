# Implementation Plan: Instructor Curriculum Builder — Sections, Lectures & Quizzes

**Branch**: `005-curriculum-builder` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-curriculum-builder/spec.md`

## Summary

Turn the placeholder **Curriculum** tab (scaffolded in 004) into a working authoring surface: inside a
course they own, an instructor structures the course into **sections**, fills each section with
**lectures** (title + mm:ss duration; video is a read-only status + placeholder, deferred to 006), and
authors an optional single **quiz** per section with **questions**, **choices**, and a marked-correct
answer. Reordering of sections and lectures is within-parent and collision-safe.

Unlike 004 (frontend-predominant on a ready API), 005 needs a **real but thin backend addition** because
**no instructor-facing management exists for questions or choices** today, and the existing
section/lecture viewsets need a few correctness accommodations. The reads for structure are largely
**free**: the existing `InstructorCourseSerializer` (`GET /courses/instructor/courses/{id}/`) already
returns the nested `sections → lectures → quiz` tree, so the builder loads structure from the course it is
already fetching. What is new:

1. **Question & Choice authoring API** — new `QuestionSerializer` / `ChoiceSerializer` and ownership-scoped
   `InstructorQuestionViewSet` / `InstructorChoiceViewSet` at `/courses/instructor/{questions,choices}/`,
   filtered through `…__quiz__section__course__instructor` and enforcing ownership on create, mirroring the
   existing instructor viewset pattern. Choices are nested (read-only) inside a question so the quiz editor
   loads a quiz's full content in one list call.
2. **Server-managed quiz question count** — `Quiz.questions_count` becomes read-only (default `0`) and is
   recomputed whenever a question is added or removed (per the clarified decision). This also fixes a
   latent create bug: today `questions_count` is a required field with no default.
3. **Auto-assigned `order` on create** — section/lecture/question create assigns the next order at the end
   of the parent when omitted, so the client never has to compute positions or risk a collision.
4. **Collision-safe reorder on order change** — for sections and lectures (which carry a
   `unique_together (parent, order)` constraint), an order-changing update renumbers the affected siblings
   inside a single `transaction.atomic()` using a temporary out-of-range offset, so no intermediate state
   violates uniqueness. **No new batch-reorder endpoint** is added — the existing per-item update path is
   reused (per the clarified decision).
5. **Exactly-one-correct enforcement** — marking a choice correct unsets any previously-correct choice for
   the same question, inside a transaction.
6. **Clean 4xx for guarded cases** — a second quiz on a section, or any cross-owner access, returns a
   `{"error": …}` 400/403/404 rather than a 500.

**No database migration is required** — this feature changes no model fields; every accommodation is
serializer/view logic. The bulk of the work is a new `featuers/instructor-curriculum` frontend module plus
two new instructor routes (lecture editor, quiz editor) and the real curriculum builder replacing the
`ComingSoon` on the curriculum tab.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16.1 / React 19.2) frontend; Python 3 / Django 6.0 + DRF backend
**Primary Dependencies**: Next.js App Router, TanStack Query, React Hook Form + Zod (`@hookform/resolvers`),
Axios (shared `@/lib/axios` with cookie auth + refresh), Tailwind CSS v4, Radix/shadcn atoms; **new**:
`@dnd-kit/core` + `@dnd-kit/sortable` for accessible drag-reorder (see research R4). Backend: DRF
`ModelViewSet`, `transaction.atomic`
**Storage**: PostgreSQL — **no migration** (no model field changes). `Section`/`Lecture` keep
`unique_together (parent, order)`; `Quiz` is one-per-section (`OneToOne`); `Question.order` has no DB
uniqueness (reorder is a plain value update)
**Testing**: Backend — Django `APITestCase` for the new question/choice endpoints (ownership, exactly-one-
correct, count maintenance, duplicate-quiz guard) and the reorder/order-assign logic on section/lecture.
Frontend — component/interaction tests for the builder (add/reorder/delete), mm:ss parsing, and the quiz
editor; manual quickstart verification in the browser preview
**Target Platform**: Responsive web (desktop-first workspace; sidebar collapses on narrow viewports)
**Project Type**: Web application (Next.js frontend + Django REST backend)
**Performance Goals**: Builder feels instant — structure comes from the single course fetch already made;
optimistic reorder with rollback on error; a full 2-section / 4-lecture course buildable in under 5
minutes (SC-001)
**Constraints**: Ownership enforced server-side on every write (defense in depth); drafts never leak to
students; building curriculum never changes publish status; reorder stays within a single parent (no
cross-section move); no new batch endpoint; no DB migration; `questions_count` server-managed; duration
stored as **decimal minutes** (existing convention — `useCourseStats` sums `parseFloat(duration)` as
minutes), entered/shown as mm:ss
**Scale/Scope**: Per-course sections/lectures are small and bounded (tens); this feature adds ~1 frontend
feature module, 2 new instructor routes, 2 new backend viewsets + 2 serializers, and view-logic
accommodations on 3 existing viewsets

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ PASS | New module is TypeScript-strict; explicit types for the section/lecture/quiz/question/choice tree and form inputs; Zod schemas validate every write (section title, lecture mm:ss, question text, ≥2 choices, exactly-one-correct). No `any`. |
| II. Component-First Architecture | ✅ PASS | Reuses atoms (`input`, `button`, `accordion`, `alert-dialog`, `skeleton`, `badge`) and the `ComingSoon`/workspace scaffolding from 004; new pieces are small, self-contained components with explicit props under the atomic-design tree. `@dnd-kit` wraps rows without changing their contracts. |
| III. Security-First Development | ✅ PASS | All writes go through `CookieJWTAuthentication` + `isInstructor`; ownership enforced by queryset filters (`…__course__instructor`) + `perform_create` checks — the authoritative gate. `questions_count` and `is_correct` invariants are server-enforced (no client mass-assignment of counts; exactly-one-correct set server-side). No raw SQL; ORM + `transaction.atomic` only. |
| IV. Testing Discipline | ✅ PASS | Backend `APITestCase` for the new endpoints and the model-adjacent invariants (ownership, count maintenance, one-correct, reorder collision-safety, duplicate-quiz guard). Frontend interaction tests for the builder and mm:ss parsing (complex interactions). |
| V. Documentation as Code | ✅ PASS | This plan + research/data-model/contracts/quickstart; the new question/choice/reorder contracts are documented; the "why" for count maintenance and the reorder offset trick is captured inline. |

**Result**: PASS — no violations. Complexity Tracking not required.

**Backend-change note (not a violation)**: The spec explicitly scopes 005 to add a thin
questions/choices surface plus reorder — this plan does exactly that and **adds no new model fields and no
migration**. The accommodations on existing viewsets (order auto-assign, transactional reorder,
`questions_count` default+maintenance, one-correct enforcement, clean 4xx) are *required for correctness*:
today a minimal quiz/question create fails (required `questions_count` with no default) and reorder under
`unique_together` can 500. All are additive, ownership-safe, and leave the student-facing JSON shape
unchanged (student viewsets and serializers are untouched).

**New dependency note**: `@dnd-kit/*` is a small, React-19-compatible, accessible drag-and-drop library
added solely to satisfy the spec's drag-reorder requirement (research R4); it introduces no global state
and no server coupling.

## Project Structure

### Documentation (this feature)

```text
specs/005-curriculum-builder/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (questions/choices API, reorder, mm:ss, dnd, count, reads)
├── data-model.md        # Phase 1 — entities, validation, order rules, mm:ss↔minutes, form↔payload
├── quickstart.md        # Phase 1 — manual verification walkthrough
├── contracts/
│   ├── curriculum-structure.md   # sections/lectures endpoints + order-assign + reorder semantics
│   └── quiz-authoring.md         # quiz + NEW questions/choices endpoints (ownership, one-correct, count)
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── tasks.md             # Phase 2 — created by /speckit.tasks (NOT here)
```

### Source Code (repository root)

```text
backend/apps/course/
├── serializers.py        # + QuestionSerializer (nested choices, read), + ChoiceSerializer;
│                         #   QuizSerializer: questions_count read-only default 0
├── views.py              # + InstructorQuestionViewSet, + InstructorChoiceViewSet (ownership-scoped);
│                         #   InstructorSectionViewSet / InstructorLectureViewSet: order auto-assign +
│                         #   transactional collision-safe reorder; InstructorQuizViewSet: duplicate-quiz 400;
│                         #   Question create/delete → recompute Quiz.questions_count
├── urls.py               # + router.register('instructor/questions'), ('instructor/choices')
├── reorder.py            # NEW small helper: atomic within-parent renumber (temp-offset) — keeps views thin
└── (no migration)        # no model field changes

front-end/
├── package.json          # + @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
└── src/
    ├── lib/
    │   └── duration.ts               # NEW mm:ss ↔ decimal-minutes helpers (parse/format/validate)
    ├── app/instructor/courses/[courseId]/
    │   ├── curriculum/page.tsx                         # REPLACES ComingSoon → real CurriculumBuilder
    │   ├── curriculum/lectures/[lectureId]/page.tsx    # NEW Lecture editor (title + mm:ss; video placeholder)
    │   └── quizzes/[quizId]/page.tsx                   # NEW Quiz editor (questions/choices/mark-correct)
    └── featuers/instructor-curriculum/
        ├── api/instructorCurriculum.api.ts   # namespaced instructorCurriculumAPI (sections/lectures/quizzes/questions/choices)
        ├── hooks/
        │   ├── useCurriculum.tsx             # structure tree (reuse GET instructor course; select sections)
        │   ├── useSectionMutations.tsx       # create/update/delete/reorder sections
        │   ├── useLectureMutations.tsx       # create/update/delete/reorder lectures
        │   ├── useQuizMutations.tsx          # create/delete quiz
        │   ├── useQuizContent.tsx            # questions+choices for a quiz (NEW list endpoint)
        │   ├── useQuestionMutations.tsx      # create/update/delete/reorder questions
        │   └── useChoiceMutations.tsx        # create/update/delete choice + setCorrect
        ├── components/
        │   ├── CurriculumBuilder.tsx         # accordion of sections + add-section + empty state
        │   ├── SectionAccordion.tsx          # one section: header (rename/delete), lecture list, quiz row
        │   ├── SortableList.tsx              # @dnd-kit wrapper (sections / lectures) + keyboard reorder
        │   ├── LectureRow.tsx                # drag handle, title, video-status badge, edit/delete
        │   ├── AddInlineRow.tsx              # inline "add section / add lecture" input row
        │   ├── LectureEditor.tsx             # title + mm:ss duration form; VideoSlotPlaceholder
        │   ├── VideoSlotPlaceholder.tsx      # read-only video status + "upload in a later update"
        │   ├── QuizEditor.tsx                # question list + add question + completeness flags
        │   ├── QuestionEditor.tsx            # question text + choices + mark-correct + add choice
        │   ├── ChoiceRow.tsx                 # choice text + correct radio + delete
        │   └── DeleteCurriculumItemDialog.tsx# enrollment-aware confirm (section/lecture/quiz/question/choice)
        ├── schemas/instructorCurriculum.schma.ts  # section/lecture(mm:ss)/question/choice Zod schemas
        ├── store/instructorCurriculum.store.ts     # view-local: expanded sections, active drag (Zustand)
        ├── types/instructorCurriculum.types.ts     # Section/Lecture/Quiz/Question/Choice + form types
        └── index.ts
```

**Structure Decision**: Web application. Frontend follows the established house convention
(`featuers/{feature}/{api,hooks,components,schemas,types,index.ts}`, the `featuers` spelling, `*.schma.ts`,
`use{Action}.tsx`, namespaced `{feature}API`) and slots pages into the existing
`app/instructor/courses/[courseId]/*` workspace from 004 (reusing its tab bar, breadcrumb root, and
`ComingSoon`). Backend changes are confined to `apps/course` serializers/views/urls plus one small
`reorder.py` helper — **no migration**. Structure reads reuse the existing instructor course retrieve
(nested tree); only quiz **content** (questions/choices) needs the new list endpoints.

## Complexity Tracking

No constitution violations — table intentionally omitted.
