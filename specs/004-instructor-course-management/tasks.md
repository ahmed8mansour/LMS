# Tasks: Instructor Course Management — My Courses, Create, Edit & Course Workspace

**Input**: Design documents from `/specs/004-instructor-course-management/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/instructor-courses.md, quickstart.md

**Tests**: Backend `APITestCase` tests are included (Constitution IV mandates model/service tests, and
`contracts/instructor-courses.md` carries a test checklist). Frontend interaction tests are optional
(Constitution IV "SHOULD") and live in Polish.

**Organization**: Tasks are grouped by user story so each can be implemented and tested independently.

## Path Conventions

- **Backend**: `backend/apps/course/` (Django app `course`)
- **Frontend**: `front-end/src/` — feature module `featuers/instructor-courses/` (house `featuers` spelling),
  routes under `app/instructor/courses/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the feature module skeleton so all later work has a home.

- [X] T001 [P] Create the frontend feature-module directory structure under
  `front-end/src/featuers/instructor-courses/` with empty subfolders `api/`, `hooks/`, `components/`,
  `schemas/`, `types/`, and a stub `index.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend accommodations and shared frontend primitives that EVERY user story depends on
(the instructor read/write contract, the thumbnail field change, types, schemas, API client, Cloudinary helper).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Backend (instructor course contract)

- [X] T002 Change `Course.thumbnail` from `ImageField` to `URLField(max_length=500, null=True, blank=True)`
  in `backend/apps/course/models.py` (mirrors `profile_picture`).
- [X] T003 Create the additive migration for T002:
  `python manage.py makemigrations course` → new file `backend/apps/course/migrations/0017_*.py`
  (do NOT edit existing migrations). Apply with `python manage.py migrate`.
- [X] T004 Add `InstructorCourseSerializer` in `backend/apps/course/serializers.py`: `rating`,
  `subscribers_count`, `reviews_count`, `is_published` are **read-only**; default them on create
  (`rating=0`, counts `=0`, `is_published=False`); `thumbnail` (URL string), `language`, `goals_list`
  optional; reuse the existing nested `sections` / `instructor_profile` read representation. Do NOT modify
  the student-facing `CourseSerializer`.
- [X] T005 Wire `InstructorCourseViewSet` in `backend/apps/course/views.py` to use
  `InstructorCourseSerializer` (via `get_serializer_class`, or swap `serializer_class`); keep the existing
  `get_queryset` ownership filter and `perform_create` instructor binding unchanged.
- [X] T006 [P] Add `APITestCase` coverage in `backend/apps/course/tests.py` per
  `contracts/instructor-courses.md`: JSON create with required-only metadata → 201 draft with defaults;
  server fields ignored if sent; `thumbnail` URL accepted and optional; instructor A gets 404 on
  retrieve/patch/delete of B's course; list is ownership-scoped; user without instructor profile is
  graceful (no 500); PATCH without `thumbnail` preserves the existing URL.

### Frontend (shared module primitives)

- [X] T007 [P] Extract `uploadToCloudinary(file): Promise<string>` into `front-end/src/lib/cloudinary.ts`
  (moved from `featuers/auth/api/auth.api.ts`) and update `auth.api.ts` to import it — one shared
  implementation (uses `GET /auth/user/getCloudinarySignature/`).
- [X] T008 [P] Define types in
  `front-end/src/featuers/instructor-courses/types/instructorCourses.types.ts`: `InstructorCourse` (read
  shape incl. read-only `is_published`/`rating`/counts), `CourseStatus = 'draft' | 'published'`,
  `CourseFormData` (`title`, `description`, `price`, `category`, `level`, `language?`, `goals: string[]`,
  `thumbnail?: FileList`).
- [X] T009 [P] Define Zod schemas in
  `front-end/src/featuers/instructor-courses/schemas/instructorCourses.schma.ts`: `createCourseSchema`
  (title/description ≤255 non-empty; price coerced number 0–9999.99; category enum
  `development|business|design & UI/UX|marketing`; level enum `beginner|intermediate|advanced`; language
  optional; goals `string[]` of non-empty items; thumbnail optional image) and `editCourseSchema`
  (same, thumbnail optional/replace). (Depends on T008.)
- [X] T010 Implement `instructorCoursesAPI` in
  `front-end/src/featuers/instructor-courses/api/instructorCourses.api.ts`: `list()` (GET
  `courses/instructor/courses/`), `get(id)`, `create(data)` and `update(id, data)` — both upload the
  picked thumbnail via `uploadToCloudinary` then send **JSON** with `thumbnail` as the URL (omit when
  unchanged on update) — and `remove(id)` (DELETE). Reuse the shared `@/lib/axios` instance. (Depends on
  T007, T008.)
- [X] T011 Export the module's public surface from
  `front-end/src/featuers/instructor-courses/index.ts` (api, hooks, components, types as they are added).

**Checkpoint**: Backend create/read/update/delete is correct and ownership-safe; the frontend module has
types, schemas, an API client, and the Cloudinary helper. User stories can now proceed.

---

## Phase 3: User Story 1 — Browse my courses (Priority: P1) 🎯 MVP

**Goal**: An instructor sees a grid of every course they own with status badges, can filter (All /
Published / Draft) and search by title (client-side), and sees a focused empty state when they own none.

**Independent Test**: Sign in as an instructor with mixed-status courses → grid lists exactly their
courses with correct badges; each filter and the search narrow the grid; an instructor with no courses
sees the "create your first course" empty state; loading shows skeletons, failure shows a retry state.

- [X] T012 [P] [US1] Implement `useInstructorCourses` query hook in
  `front-end/src/featuers/instructor-courses/hooks/useInstructorCourses.tsx` (TanStack Query,
  `queryKey: ['instructor','courses']`, calls `instructorCoursesAPI.list`).
- [X] T013 [P] [US1] Implement `InstructorCourseCard` in
  `front-end/src/featuers/instructor-courses/components/InstructorCourseCard.tsx` — thumbnail, title,
  status badge (Draft/Published), and Edit / Manage actions (links to
  `/instructor/courses/{id}/edit` and `/instructor/courses/{id}`).
- [X] T014 [US1] Implement `MyCoursesGrid` in
  `front-end/src/featuers/instructor-courses/components/MyCoursesGrid.tsx` — status filter chips + title
  search over the fetched list (client-side), renders `InstructorCourseCard`s, `CourseCardSkeleton`
  loading state, retry-able error state, and the empty state (single "Create your first course" CTA).
  (Depends on T012, T013.)
- [X] T015 [US1] Replace the placeholder in `front-end/src/app/instructor/courses/page.tsx` (currently
  `ComingSoon`) with the My Courses page rendering `MyCoursesGrid` and a "+ New course" header action
  linking to `/instructor/courses/new`.

**Checkpoint**: My Courses is fully functional (browse/filter/search/empty/loading/error) and independently
demonstrable — this is the MVP.

---

## Phase 4: User Story 2 — Create a course (Priority: P1)

**Goal**: An instructor fills a validated form and creates a **draft** course owned by them, landing in
that course's workspace.

**Independent Test**: Open the create form; submit empty → inline field errors block save; submit valid
data (try price 0) → a new draft owned by the instructor is created and the app routes to
`/instructor/courses/{id}`.

- [X] T016 [P] [US2] Implement `GoalsListField` in
  `front-end/src/featuers/instructor-courses/components/GoalsListField.tsx` — repeatable add/remove text
  rows bound to a `string[]` form value (integrates with React Hook Form).
- [X] T017 [US2] Implement the shared `CourseForm` in
  `front-end/src/featuers/instructor-courses/components/CourseForm.tsx` — React Hook Form + `zodResolver`,
  fields title/description/price/category(select)/level(select)/language/goals(`GoalsListField`)/thumbnail
  (file input with image preview), inline field errors, pending/disabled submit (no double-submit).
  Accepts `mode: 'create' | 'edit'`, optional `defaultValues`, and an `onSubmit` handler. (Depends on
  T009, T016.)
- [X] T018 [P] [US2] Implement `useCreateCourse` mutation hook in
  `front-end/src/featuers/instructor-courses/hooks/useCreateCourse.tsx` — calls
  `instructorCoursesAPI.create`, invalidates `['instructor','courses']`, surfaces server field errors, and
  on success routes to `/instructor/courses/{id}`.
- [X] T019 [US2] Create the page `front-end/src/app/instructor/courses/new/page.tsx` rendering `CourseForm`
  in create mode wired to `useCreateCourse`, with a breadcrumb "Instructor / My Courses / New course".
  (Depends on T017, T018.)

**Checkpoint**: Create works end-to-end (validation → draft → redirect); with US1, an instructor can create
and then see their course.

---

## Phase 5: User Story 3 — Edit metadata & thumbnail (Priority: P1)

**Goal**: An instructor edits an owned course's metadata and replaces its thumbnail on a dedicated edit
route reusing the create form; non-owned courses are refused.

**Independent Test**: Edit an owned course's title/price/thumbnail → persists on reload; edit with invalid
input → inline errors; open another instructor's course edit by ID → refused (404/forbidden state), no
data shown; omit thumbnail on a later edit → existing image kept.

- [X] T020 [P] [US3] Implement `useInstructorCourse(id)` query hook in
  `front-end/src/featuers/instructor-courses/hooks/useInstructorCourse.tsx` (`queryKey:
  ['instructor','course', id]`, calls `instructorCoursesAPI.get`; surfaces 404 for not-owned).
- [X] T021 [P] [US3] Implement `useUpdateCourse` mutation hook in
  `front-end/src/featuers/instructor-courses/hooks/useUpdateCourse.tsx` — calls
  `instructorCoursesAPI.update`, invalidates `['instructor','courses']` and `['instructor','course', id]`,
  surfaces server field errors.
- [X] T022 [US3] Create the page `front-end/src/app/instructor/courses/[courseId]/edit/page.tsx` — loads the
  course via `useInstructorCourse`, renders `CourseForm` in edit mode with `defaultValues` prefilled
  (thumbnail omitted unless replaced) wired to `useUpdateCourse`; renders a clear not-found/forbidden
  state on 404 and loading/error states. (Depends on T017, T020, T021.)

**Checkpoint**: Full create/read/update loop works; ownership refusal verified.

---

## Phase 6: User Story 4 — Course workspace overview (Priority: P2)

**Goal**: Opening a course shows a workspace with a persistent tab bar (Overview · Curriculum · Analytics ·
Students · Reviews) and a course-title breadcrumb root; Overview summarises the course (read-only status);
later-spec tabs render placeholders.

**Independent Test**: Open an owned course → workspace shows the tab bar with Overview active and the
course summary; each other tab shows a "coming soon" placeholder (no crash); opening a non-owned course's
workspace by ID is refused.

- [X] T023 [P] [US4] Implement `CourseWorkspaceTabs` in
  `front-end/src/featuers/instructor-courses/components/CourseWorkspaceTabs.tsx` — tab bar linking to
  Overview/Curriculum/Analytics/Students/Reviews under `/instructor/courses/{id}/...`, marking the active
  tab from the current route.
- [X] T024 [P] [US4] Implement `CourseOverview` in
  `front-end/src/featuers/instructor-courses/components/CourseOverview.tsx` — thumbnail, title, **read-only**
  status badge, key metadata, and an Edit link to `/instructor/courses/{id}/edit`. (Any publish affordance
  is a placeholder — publishing is spec 007.)
- [X] T025 [US4] Create the workspace layout
  `front-end/src/app/instructor/courses/[courseId]/layout.tsx` — loads the course (title for breadcrumb),
  renders `CourseWorkspaceTabs` + a scrollable content area, and a not-found/forbidden state on 404.
  (Depends on T020, T023.)
- [X] T026 [US4] Create the Overview page `front-end/src/app/instructor/courses/[courseId]/page.tsx`
  rendering `CourseOverview` with loading/error states. (Depends on T024.)
- [X] T027 [P] [US4] Create placeholder tab pages rendering `ComingSoon` (title + description) at
  `front-end/src/app/instructor/courses/[courseId]/curriculum/page.tsx` (spec 005),
  `.../analytics/page.tsx` (009), `.../students/page.tsx` (010), and `.../reviews/page.tsx` (012).

**Checkpoint**: The per-course workspace is coherent from day one; later specs slot their tabs in.

---

## Phase 7: User Story 5 — Delete a course (Priority: P2)

**Goal**: An instructor deletes an owned course behind an enrollment-aware confirmation; only the owner can
delete.

**Independent Test**: Delete a course with no enrollments → light confirm → it disappears; delete a course
with enrolled students (`subscribers_count > 0`) → confirmation explicitly warns of permanent removal and
loss of student access; cancel changes nothing; non-owner delete by ID is refused.

- [X] T028 [P] [US5] Implement `useDeleteCourse` mutation hook in
  `front-end/src/featuers/instructor-courses/hooks/useDeleteCourse.tsx` — calls
  `instructorCoursesAPI.remove`, invalidates `['instructor','courses']`, surfaces errors.
- [X] T029 [US5] Implement `DeleteCourseDialog` in
  `front-end/src/featuers/instructor-courses/components/DeleteCourseDialog.tsx` using the `alert-dialog`
  atom — **enrollment-aware copy**: when `subscribers_count > 0`, explicitly state the course/content are
  permanently removed and enrolled students immediately lose access; otherwise a lighter confirm. Cancel is
  a no-op. (Depends on T028.)
- [X] T030 [US5] Wire `DeleteCourseDialog` into `InstructorCourseCard` (T013) and `CourseOverview` (T024) as
  a Delete action; on success the course leaves the My Courses grid.

**Checkpoint**: Full course lifecycle (browse/create/edit/workspace/delete) is complete and guarded.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification, optional frontend tests, and final consistency.

- [ ] T031 [P] (Optional) Frontend interaction tests for `CourseForm` validation (blocks invalid create/edit
  with field errors) and `DeleteCourseDialog` (enrollment-aware copy, cancel is a no-op).
- [ ] T032 [P] Reseed dev course data so `thumbnail` values are valid Cloudinary URLs after the field-type
  change (Option A — no data migration), and confirm existing published courses still render on the student
  catalog.
- [ ] T033 Run the `quickstart.md` walkthrough end-to-end in the browser preview: verify empty/loading/error
  states on every surface (FR-016/SC-007), that a draft never appears in the student catalog
  (FR-018/SC-008), and that the sidebar collapses responsively.
- [X] T034 [P] Update `front-end/src/featuers/instructor-courses/index.ts` and remove any dead placeholder
  code; confirm `tsc` and ESLint pass with no `any` (Constitution I).

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** must complete before any user story.
- Within Foundational: T002→T003 (migration follows model change); T004→T005 (viewset uses serializer);
  T008→T009 and T008→T010, T007→T010 (schemas/api depend on types + cloudinary). T006 is independent [P].
- **User stories** depend only on Foundational, and are largely independent:
  - **US1 (P1)** — MVP; no dependency on US2–US5.
  - **US2 (P1)** — introduces `CourseForm` (reused by US3).
  - **US3 (P1)** — reuses `CourseForm` (T017 from US2); otherwise independent.
  - **US4 (P2)** — reuses `useInstructorCourse` (T020 from US3) for the workspace title/guard; if built
    before US3, add T020 into US4. Edit page (US3) renders standalone until the US4 layout wraps it.
  - **US5 (P2)** — wires into `InstructorCourseCard` (US1) and `CourseOverview` (US4).
- **Polish (Phase 8)** last.

**Recommended order**: US1 → US2 → US3 → US4 → US5 (spec priority). US1 alone is a shippable MVP.

## Parallel Execution Examples

- **Foundational**: T006 (backend tests) ∥ T007 (cloudinary extract) ∥ T008 (types) can start together;
  then T009 ∥ T010 after T008.
- **US1**: T012 (hook) ∥ T013 (card) in parallel, then T014 → T015.
- **US2**: T016 (goals field) ∥ T018 (create hook) in parallel, then T017 → T019.
- **US4**: T023 (tabs) ∥ T024 (overview) ∥ T027 (placeholders) in parallel, then T025 → T026.

## Implementation Strategy

- **MVP = Phase 1 + Phase 2 + Phase 3 (US1)** — an instructor can browse their owned courses in the real
  shell. Ships value on its own.
- **Authoring core = + US2 + US3** — create and edit drafts (the P1 set).
- **Workspace & lifecycle = + US4 + US5** — per-course home and guarded deletion (P2).
- Backend (Phase 2) is small but blocking; do it first and keep the student-facing serializer untouched.
