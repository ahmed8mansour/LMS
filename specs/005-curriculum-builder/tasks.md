# Tasks: Instructor Curriculum Builder — Sections, Lectures & Quizzes

**Input**: Design documents from `/specs/005-curriculum-builder/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md,
contracts/curriculum-structure.md, contracts/quiz-authoring.md, quickstart.md

**Tests**: Backend `APITestCase` tests are included (Constitution IV mandates model/service tests, and the
contracts carry test checklists for the new endpoints and the reorder/one-correct/count invariants).
Frontend interaction tests are optional (Constitution IV "SHOULD") and live in Polish.

**Organization**: Tasks are grouped by user story so each can be implemented and tested independently.

## Path Conventions

- **Backend**: `backend/apps/course/` (Django app `course`) — no migration (no model field changes).
- **Frontend**: `front-end/src/` — feature module `featuers/instructor-curriculum/` (house `featuers`
  spelling), routes under `app/instructor/courses/[courseId]/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the feature-module home and add the drag-and-drop dependency.

- [x] T001 [P] Create the frontend feature-module directory structure under
  `front-end/src/featuers/instructor-curriculum/` with empty subfolders `api/`, `hooks/`, `components/`,
  `schemas/`, `store/`, `types/`, and a stub `index.ts`.
- [x] T002 [P] Add drag-and-drop deps to `front-end/package.json` and install:
  `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (research R4).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend helper and frontend primitives that EVERY user story depends on (reorder
helper, types, schemas, API client, duration helper, structure read hook, dnd wrapper, delete dialog,
builder shell).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Backend (shared)

- [x] T003 Create `backend/apps/course/reorder.py` — a transactional, collision-safe within-parent renumber
  helper: given a model, a parent filter (e.g. `course=…` or `section=…`), a moved instance, and a target
  `order`, run inside `transaction.atomic()` using a two-phase temp-offset (shift affected rows to an
  out-of-range order, then write the final compact `0..n-1` sequence) so no intermediate state violates
  `unique_together` (research R2). Keep it generic so both section and lecture viewsets reuse it.

### Frontend (shared module primitives)

- [x] T004 [P] Define types in
  `front-end/src/featuers/instructor-curriculum/types/instructorCurriculum.types.ts`: `VideoStatus`,
  `Choice`, `Question` (with `choices: Choice[]`), `Quiz`, `Lecture` (`duration: string`, `video_status`,
  `video_url`), `Section` (with `lectures`, `quiz`), and form types per data-model.md.
- [x] T005 [P] Create `front-end/src/lib/duration.ts` — `parseMmSs(s): string` (mm:ss → decimal-minutes
  string, 2 dp), `formatMinutes(v): string` (decimal-minutes → mm:ss with 60→+1m carry), and a validator
  regex, per data-model.md.
- [x] T006 [P] Create the API client
  `front-end/src/featuers/instructor-curriculum/api/instructorCurriculum.api.ts` — namespaced
  `instructorCurriculumAPI` over the shared `@/lib/axios` with methods for sections, lectures, quizzes,
  questions (list `?quiz=`), and choices CRUD, per both contract files.
- [x] T007 [P] Define Zod schemas in
  `front-end/src/featuers/instructor-curriculum/schemas/instructorCurriculum.schma.ts`: `sectionSchema`
  (title non-empty ≤255), `lectureSchema` (title non-empty; `duration` mm:ss regex resolving to >0 and
  <10000 min via `lib/duration`), `questionSchema` (text), `choiceSchema` (text; `is_correct`).
- [x] T008 [P] Create view-local Zustand store
  `front-end/src/featuers/instructor-curriculum/store/instructorCurriculum.store.ts`: expanded-section ids
  and active-drag id (builder UI only; no server state).
- [x] T009 Create `front-end/src/featuers/instructor-curriculum/hooks/useCurriculum.tsx` — reads the course
  via the existing `GET /courses/instructor/courses/{id}/` (reuse 004's `useInstructorCourse` or query
  key), selects the `sections` tree for display, and exposes whether the course has enrolled students (for
  US4). Depends on T004, T006.
- [x] T010 [P] Create `front-end/src/featuers/instructor-curriculum/components/SortableList.tsx` — a
  generic `@dnd-kit` sortable wrapper (pointer + `KeyboardSensor`) that renders draggable rows with a
  handle and calls an `onReorder(orderedIds)` callback. Depends on T002.
- [x] T011 [P] Create
  `front-end/src/featuers/instructor-curriculum/components/DeleteCurriculumItemDialog.tsx` — a confirm
  dialog over the `alert-dialog` atom with a basic (non-enrollment-aware) message; enrollment-aware copy is
  added in US4 (T038).
- [x] T012 Replace the `ComingSoon` in
  `front-end/src/app/instructor/courses/[courseId]/curriculum/page.tsx` with a new
  `CurriculumBuilder` container that renders `useCurriculum` state with loading skeleton and retry-able
  error states (section interactions arrive in US1). Depends on T009.

**Checkpoint**: The Curriculum tab loads the real (read-only) section tree with loading/empty/error states;
shared helpers and the delete dialog exist.

---

## Phase 3: User Story 1 - Structure a course into sections (Priority: P1) 🎯 MVP

**Goal**: Add / rename / drag-reorder / delete sections, with consistent ordering and an empty state.

**Independent Test**: On an owned course's Curriculum tab, add several sections, rename one, drag-reorder
(persists on reload with no dup/gap), delete one; a new course shows "add your first section".

### Backend

- [x] T013 [US1] In `backend/apps/course/views.py`, enhance `InstructorSectionViewSet.perform_create` to
  auto-assign `order = (max sibling order or 0) + 1` when omitted (owner check already present).
- [x] T014 [US1] In `backend/apps/course/views.py`, override `InstructorSectionViewSet` update/
  `partial_update` so that when `order` changes it calls the `reorder.py` helper (parent = the section's
  course) inside a transaction; never raise a 500 for a valid target. Depends on T003.
- [x] T015 [P] [US1] Add `APITestCase` coverage in `backend/apps/course/tests.py` per
  `contracts/curriculum-structure.md`: create auto-assigns order to end; reorder renumbers unique + gap-free
  with no 500; instructor A gets no access to B's sections (create/patch/delete); rename persists; delete
  cascades to lectures/quiz.

### Frontend

- [x] T016 [US1] Create `front-end/src/featuers/instructor-curriculum/hooks/useSectionMutations.tsx` —
  create / rename (update) / delete / reorder section mutations with TanStack Query invalidation of the
  course query; reorder is optimistic with rollback on error. Depends on T006, T009.
- [x] T017 [US1] Create `front-end/src/featuers/instructor-curriculum/components/SectionAccordion.tsx` —
  a section header (title, inline rename, delete) with slots for its lecture list and quiz row (filled in
  US2/US3) using the `accordion` atom. Depends on T004.
- [x] T018 [US1] Create `front-end/src/featuers/instructor-curriculum/components/AddInlineRow.tsx` and wire
  an "add section" row + the "Add your first section" empty state into `CurriculumBuilder`. Depends on
  T012, T016.
- [x] T019 [US1] Wire section drag-reorder in `CurriculumBuilder` using `SortableList`, calling the reorder
  mutation. Depends on T010, T016.
- [x] T020 [US1] Wire section delete through `DeleteCurriculumItemDialog` (basic confirm) in
  `SectionAccordion`. Depends on T011, T016.

**Checkpoint**: Sections are fully manageable and independently demonstrable.

---

## Phase 4: User Story 2 - Add and order lectures within a section (Priority: P1)

**Goal**: Add lecture (title + mm:ss duration), edit, drag-reorder within section, delete; each row shows
read-only video status with a placeholder uploader.

**Independent Test**: In a section, add lectures with mm:ss durations, edit one, reorder within the section
(persists; cannot cross sections), delete one; each row shows a video-status badge and a placeholder.

### Backend

- [x] T021 [US2] In `backend/apps/course/views.py`, enhance `InstructorLectureViewSet`: `perform_create`
  auto-assigns `order` to end; update/`partial_update` reorders within the section via the `reorder.py`
  helper (parent = section) in a transaction and **rejects a changed `section`** with `400 {"error": …}`
  (no cross-section move). Depends on T003.
- [x] T022 [P] [US2] Add `APITestCase` coverage in `backend/apps/course/tests.py`: lecture create
  auto-orders and requires positive `duration`; reorder stays within section unique + gap-free; changing
  `section` is rejected; ownership enforced; delete keeps remaining lectures consistent.

### Frontend

- [x] T023 [US2] Create `front-end/src/featuers/instructor-curriculum/hooks/useLectureMutations.tsx` —
  create / update / delete / reorder lecture mutations (duration converted via `lib/duration`) with course-
  query invalidation; optimistic reorder. Depends on T006, T005.
- [x] T024 [US2] Create `front-end/src/featuers/instructor-curriculum/components/LectureRow.tsx` — drag
  handle, title, video-status badge, edit link (to the lecture editor), delete action. Depends on T004.
- [x] T025 [US2] In `SectionAccordion`, render the section's lectures with `SortableList` + `LectureRow`,
  add an "add lecture" `AddInlineRow`, and wire lecture drag-reorder + delete dialog. Depends on T017,
  T023, T010, T011.
- [x] T026 [US2] Create the lecture editor route
  `front-end/src/app/instructor/courses/[courseId]/curriculum/lectures/[lectureId]/page.tsx` with a title +
  mm:ss duration form (RHF + `lectureSchema` + `lib/duration`) saving via `useLectureMutations`. Depends on
  T007, T023.
- [x] T027 [US2] Create
  `front-end/src/featuers/instructor-curriculum/components/VideoSlotPlaceholder.tsx` (read-only video
  status + "video upload arrives in a later update") and render it in the lecture editor. Depends on T004.

**Checkpoint**: Sections + lectures fully manageable; video remains a read-only placeholder (spec 006).

---

## Phase 5: User Story 3 - Author a section quiz (Priority: P2)

**Goal**: Create the single quiz per section; add/edit/reorder/delete questions; add/edit/delete choices;
mark exactly one correct; flag incomplete questions.

**Independent Test**: Add a quiz to a section, add a question with 3 choices, mark one correct (switching
unmarks the prior), reorder questions, remove a choice, delete a question; a <2-choice or no-correct
question is flagged; a second quiz on the same section is refused.

### Backend

- [x] T028 [P] [US3] In `backend/apps/course/serializers.py`, add `QuestionSerializer`
  (`id, quiz, text, order, choices` with nested read-only `ChoiceSerializer(many=True)`, `order`
  read-only) and `ChoiceSerializer` (`id, question, text, is_correct`); set `QuizSerializer`
  `questions_count` read-only with default `0`.
- [x] T029 [US3] In `backend/apps/course/views.py`, add `InstructorQuestionViewSet` and
  `InstructorChoiceViewSet` (ownership querysets via `…course.instructor`, `?quiz=`/`?question=` filters,
  `order` auto-assign; choice writes with `is_correct=true` unset siblings in a transaction; question
  create/delete recompute `quiz.questions_count`); make `InstructorQuizViewSet.perform_create` return
  `400 {"error": "This section already has a quiz."}` on the OneToOne violation. Depends on T028, T003.
- [x] T030 [US3] Register the new viewsets in `backend/apps/course/urls.py`:
  `router.register('instructor/questions', InstructorQuestionViewSet, basename='instructor_questions')`
  and `('instructor/choices', InstructorChoiceViewSet, basename='instructor_choices')`. Depends on T029.
- [x] T031 [P] [US3] Add `APITestCase` coverage in `backend/apps/course/tests.py` per
  `contracts/quiz-authoring.md`: question/choice ownership refusal; exactly-one-correct swap on create and
  update; `questions_count` recomputed on add/delete; duplicate quiz → 400 (not 500); `?quiz=` returns
  nested choices.

### Frontend

- [x] T032 [US3] Create hooks `useQuizMutations.tsx` (create/delete quiz) and `useQuizContent.tsx` (list
  questions `?quiz=` with nested choices) in `front-end/src/featuers/instructor-curriculum/hooks/`.
  Depends on T006.
- [x] T033 [US3] Create hooks `useQuestionMutations.tsx` (create/update/delete/reorder) and
  `useChoiceMutations.tsx` (create/update/delete + `setCorrect`) with quiz-content invalidation. Depends on
  T006.
- [x] T034 [US3] Create the quiz editor route
  `front-end/src/app/instructor/courses/[courseId]/quizzes/[quizId]/page.tsx` — question list, add-question
  row, and per-question completeness flag (text + ≥2 choices + exactly one correct). Depends on T032.
- [x] T035 [US3] Create `QuestionEditor.tsx` and `ChoiceRow.tsx` in
  `front-end/src/featuers/instructor-curriculum/components/` — question text, choice rows with a
  mark-correct radio, add-choice, and delete, wired to `useQuestionMutations`/`useChoiceMutations`.
  Depends on T033.
- [x] T036 [US3] In `SectionAccordion`, render the quiz row: "+ Quiz" when none (single quiz per section)
  else "Edit quiz" linking to the editor, plus quiz delete via the dialog. Depends on T017, T032.
- [x] T037 [US3] Add question drag-reorder in the quiz editor using `SortableList`. Depends on T010, T033.

**Checkpoint**: Full section-quiz authoring works, with server-enforced invariants.

---

## Phase 6: User Story 4 - Delete content enrolled students depend on (Priority: P2)

**Goal**: Escalate the delete confirmation to name permanent removal + loss-of-access when the course has
enrolled students; lighter otherwise; cancel changes nothing.

**Independent Test**: Delete a lecture in a no-enrollment course (light confirm); delete a section in a
course with enrolled students (confirmation names the consequence); cancel leaves everything unchanged.

- [x] T038 [US4] Enhance
  `front-end/src/featuers/instructor-curriculum/components/DeleteCurriculumItemDialog.tsx` to accept a
  `hasEnrollments` flag and item kind, showing the escalated copy (item + contents permanently removed;
  enrolled students immediately lose access) for section/lecture/quiz deletes when enrollments exist, and
  the lighter copy otherwise. Depends on T011.
- [x] T039 [US4] Pass the course's enrollment-presence (from `useCurriculum`, T009) into every
  `DeleteCurriculumItemDialog` usage across `CurriculumBuilder`, `SectionAccordion`, `LectureRow`, and the
  quiz editor. Depends on T038, T009.

**Checkpoint**: All deletions are guarded; enrolled-course deletions warn about loss of access.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T040 [P] DEFERRED — Frontend interaction tests: builder add/reorder/delete (sections + lectures),
  `lib/duration` mm:ss parse/format round-trip, and quiz mark-correct switching. No frontend test runner is
  configured in `front-end/` (no vitest/jest); Constitution IV marks frontend tests as "SHOULD" (optional).
  Deferred pending a test-harness decision; backend `APITestCase` coverage (the mandatory tier) is complete.
  Manual quickstart (T044) verified these flows instead.
- [x] T041 [P] Audit loading / empty / error states across the curriculum tab, lecture editor, and quiz
  editor (empty section, empty quiz, load failure) per FR-015; add any missing states.
- [x] T042 [P] Accessibility pass on drag-reorder: confirm keyboard reordering (dnd-kit `KeyboardSensor`)
  works for sections, lectures, and questions, with focus-visible handles.
- [x] T043 Update `front-end/src/featuers/instructor-curriculum/index.ts` to export the module's public
  hooks/components/types.
- [x] T044 Run `specs/005-curriculum-builder/quickstart.md` end-to-end and fix any gaps.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS all user stories**.
- **User Stories (Phase 3–6)**: all depend on Foundational.
  - US1 (P1) and US2 (P1) are the MVP; US2 renders lectures inside US1's `SectionAccordion`, so US1's
    T017 precedes US2's T025 (same file). US3 (P2) and US4 (P2) follow.
- **Polish (Phase 7)**: after the desired stories are complete.

### User Story Dependencies

- **US1 (P1)**: after Foundational. Independent.
- **US2 (P1)**: after Foundational; shares `SectionAccordion` (T017) with US1 — sequence US1 → US2 for that
  file, though backend T021/T022 are independent of US1.
- **US3 (P2)**: after Foundational; touches `SectionAccordion` (T036) for the quiz row — sequence after
  T017. Backend (T028–T031) is fully independent and [P]-parallelizable with US1/US2 backend.
- **US4 (P2)**: enhances the shared delete dialog (T011) and reuses `useCurriculum` — best done after US1–US3
  so all delete sites exist.

### Within Each User Story

- Backend view/serializer changes before their `APITestCase`.
- Hooks before the components that consume them; components before route wiring.
- Reorder helper (T003) before any reorder wiring.

### Parallel Opportunities

- Setup: T001, T002 in parallel.
- Foundational: T004, T005, T006, T007, T008, T010, T011 in parallel (distinct files); T009 after T004/T006;
  T012 after T009. T003 (backend) parallel with all frontend foundational.
- US1: T015 (tests) parallel with frontend T016–T020; T013/T014 (same file) sequential.
- US3 backend (T028–T031) can proceed in parallel with US1/US2 frontend once Foundational is done.
- Polish: T040, T041, T042 in parallel.

---

## Parallel Example: Foundational primitives

```bash
# After T001/T002, launch the independent foundational files together:
Task: "Types in featuers/instructor-curriculum/types/instructorCurriculum.types.ts"
Task: "lib/duration.ts mm:ss helpers"
Task: "api/instructorCurriculum.api.ts client"
Task: "schemas/instructorCurriculum.schma.ts Zod schemas"
Task: "store/instructorCurriculum.store.ts Zustand slice"
Task: "components/SortableList.tsx dnd wrapper"
Task: "components/DeleteCurriculumItemDialog.tsx"
Task: "backend/apps/course/reorder.py transactional renumber helper"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 US1 (sections) → **validate independently**.
3. Phase 4 US2 (lectures) → **validate**: a course can now be structured end-to-end (video still deferred).
4. Demo the authoring skeleton.

### Incremental Delivery

1. Foundation ready.
2. US1 → sections manageable (MVP slice 1).
3. US2 → lectures + editor (MVP complete for structure).
4. US3 → quiz authoring (adds assessments; net-new backend).
5. US4 → enrollment-aware delete guards.
6. Polish → tests, a11y, states, quickstart.

### Notes

- [P] tasks = different files, no incomplete dependencies.
- No database migration in this feature — do not run `makemigrations` for `course`.
- Keep student-facing serializers/viewsets untouched; all new logic is instructor-scoped.
- Commit after each task or logical group; stop at any checkpoint to validate a story.
