# Tasks: Course Publishing & Readiness Gate

**Input**: Design documents from `/specs/007-course-publishing/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/course-publishing.md, quickstart.md

**Tests**: Backend `APITestCase` tests are **included and non-optional**. Constitution IV mandates unit tests
for models/services, the gate is the feature's entire value, and User Story 5 (ownership) has *no*
implementation tasks at all — its tests are the only thing that proves it. Frontend component tests are
optional (Constitution IV "SHOULD") and live in Polish.

**Organization**: Grouped by user story, per the spec's priorities. The domain layer
(`apps/course/publishing/`) is **Phase 2 Foundational** because all five stories sit on the same state
machine and the same readiness service — splitting it across story phases would mean building it three
times. Each story phase then owns its endpoint, its UI, and its tests.

**No migration.** No model is touched. If you find yourself writing one, stop — re-read `data-model.md` §1.

## Path Conventions

- **Backend**: `backend/apps/course/` (Django app `course`); new subpackage `publishing/`; settings in
  `backend/config/settings.py`; tests in `backend/apps/course/tests_publishing.py`.
- **Frontend**: `front-end/src/` — extends the existing `featuers/instructor-courses/` module (house
  `featuers` spelling). No new feature module (plan *Structure Decision*).

---

## Phase 1: Setup

**Purpose**: the two things everything else imports or reads.

- [X] T001 [P] Add `'course_publish': '20/min'` to `DEFAULT_THROTTLE_RATES` in
  `backend/config/settings.py`, with a comment that publishing is a student-visible catalog change and this
  is a churn ceiling, not a security boundary (research R10).
- [X] T002 Create the package directory `backend/apps/course/publishing/` with an empty `__init__.py` (its
  public surface is filled in T007). Mirrors the `video/` and `enrollment/payments/` layout.

**Checkpoint**: `from apps.course import publishing` imports; settings resolve with no new env var.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the state machine, the readiness service, the transition facade, and the shared viewset /
serializer / client wiring that every story below consumes.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

- [X] T003 [P] Create `backend/apps/course/publishing/dto.py` with frozen dataclasses `ReadinessItem`
  (`code`, `severity`, `message`, `target`), `ReadinessReport` (`status`, `is_publishable`,
  `needs_attention`, `blockers`, `advisories`) and `TransitionResult` (`changed`, `status`, `detail`,
  `blockers`). Shapes exactly as in `data-model.md` §3.
- [X] T004 Create `backend/apps/course/publishing/states.py`: `CourseState` ABC with `name`,
  `publish(course, readiness)`, `unpublish(course)`; concrete `DraftState` and `PublishedState`; and the
  `get_course_state(course)` factory deriving state from `course.is_published`. Implement all four cells of
  the `data-model.md` §2 matrix, **including both idempotent no-ops** (FR-005). Document in the module
  docstring that the state is derived and never persisted (invariant I1), and that state classes own
  transitions only — readiness is passed in, never inspected here (research R1).
- [X] T005 Create `backend/apps/course/publishing/readiness.py` with `PublishReadinessService.evaluate(course)
  -> ReadinessReport`. Implement all eight blocking codes and three advisory codes from `data-model.md` §3,
  plus the read-side `_is_question_complete()` predicate (non-blank text, ≥2 choices, exactly one correct).
  Evaluate **every** condition — never short-circuit (FR-015). Read only prefetched relations (no `.filter()`
  on a related manager, which would defeat T008's prefetch). Derive `needs_attention` as
  `is_published and not is_publishable`.
  *Implemented on the product owner's structure* (`_find_blockers` / `_find_advisories` appending to
  per-call lists, inline `ReadinessItem`s), with `# FIX:` comments marking each correction: import path,
  lists reset per `evaluate()` call, the inverted `is_publishable`, the missing return, the full
  question-completeness rule inlined (no separate `_is_question_complete()`), advisory `target`s, item
  titles in messages, and `course.section_set` instead of `Section.objects.filter` (12 → 0 queries for
  3 courses, pinned by T043).
- [X] T006 Create `backend/apps/course/publishing/service.py` with `CoursePublishingService` exposing
  `publish(course)` and `unpublish(course)`. Each opens `transaction.atomic()`, re-reads the course with
  `select_for_update()`, evaluates readiness **inside** the transaction, delegates to
  `get_course_state(course)`, and saves with `update_fields=['is_published']` only when the state says
  `changed` (research R8, invariants I2–I4). Return a `TransitionResult` plus the fresh `ReadinessReport`.
- [X] T007 Fill `backend/apps/course/publishing/__init__.py` with the package's public surface:
  `get_course_state`, `PublishReadinessService`, `CoursePublishingService`, and the three DTOs. Everything
  else stays private to the package.
- [X] T008 Add `prefetch_related('section_set__lectures', 'section_set__quiz__question__choice')` to
  `InstructorCourseViewSet.get_queryset()` in `backend/apps/course/views.py`, with a comment that readiness
  evaluation depends on it and that removing it turns the My Courses list into an N+1 (research R5). Keep
  the existing `InstructorProfile.DoesNotExist → Course.objects.none()` branch untouched — it is what makes
  FR-029 work.
- [X] T009 Add read-only `is_publishable` and `needs_attention` `SerializerMethodField`s to
  `InstructorCourseSerializer` in `backend/apps/course/serializers.py`, sourced from
  `PublishReadinessService`. **Do not touch `CourseSerializer`** (the student shape stays byte-identical)
  and leave `is_published` in `read_only_fields` exactly as it is (FR-003).
- [X] T010 Add `get_throttles()` to `InstructorCourseViewSet` in `backend/apps/course/views.py`, scoping `course_publish` to the `publish` and
  `unpublish` actions only, falling through to `super().get_throttles()` otherwise. Include the comment from
  research R10 explaining why `@action(throttle_scope=...)` is rejected by initkwargs validation and why a
  class-level `throttle_scope` would wrongly throttle `list`/`retrieve`/`create`/`destroy`.
- [X] T011 [P] Add the readiness types to
  `front-end/src/featuers/instructor-courses/types/instructorCourses.types.ts`: `ReadinessSeverity`,
  `ReadinessCode` (string-literal union), `ReadinessTarget`, `ReadinessItem`, `ReadinessReport`; add
  `is_publishable: boolean` and `needs_attention: boolean` to `InstructorCourse`; and add
  `readinessHref(courseId, item)` using an exhaustive `switch` over `ReadinessCode` so an unmapped code is a
  `tsc` error, not a dead link (`data-model.md` §5).
- [X] T012 [P] Add `readiness(id)`, `publish(id)`, and `unpublish(id)` to `instructorCoursesAPI` in
  `front-end/src/featuers/instructor-courses/api/instructorCourses.api.ts`, typed against
  `ReadinessReport`. Reuse the shared `axiosInstance` and the existing `BASE` constant.
- [X] T013 Create `backend/apps/course/tests_publishing.py` with the shared fixtures every story's tests
  need: an instructor + a second instructor + a student, a `make_ready_course()` helper that builds a course
  satisfying all of FR-009 (thumbnail, two sections, lectures with `video_status='COMPLETED'`, a complete
  quiz), and a `break_one(course, condition)` helper that violates exactly one condition. Patch
  `get_video_provider` at the module level so no test touches Cloudinary.
- [X] T014 Add unit tests for the state machine and facade to `tests_publishing.py` (no HTTP): all four cells
  of the transition matrix, both idempotent no-ops return `changed=False` and write nothing, a refused
  publish leaves `is_published` and `last_updated` unchanged, and readiness is re-evaluated inside
  `publish()` rather than accepted from the caller.

**Checkpoint**: the domain layer is complete and unit-tested; `is_publishable`/`needs_attention` appear on
instructor course payloads. No endpoint exists yet, so nothing is reachable over HTTP.

---

## Phase 3: User Story 1 - Publish a finished course (Priority: P1) 🎯 MVP

**Goal**: an instructor can move a complete course they own into the student catalog, from the workspace, in
one explicit action — and cannot move a broken one.

**Independent Test**: take a course satisfying every readiness condition, publish it from the Overview,
confirm it appears in the student catalog and is enrollable; then break a condition and confirm publish is
refused with nothing written.

- [X] T015 [US1] Add `@action(detail=True, methods=['post']) def publish()` to `InstructorCourseViewSet` in
  `backend/apps/course/views.py`: resolve via `self.get_object()`, call `CoursePublishingService().publish()`,
  return 200 with the transition+report payload on success or on an idempotent no-op, and 400
  `{"error": ..., "blockers": [...]}` when the gate refuses (contract *POST publish*, research R7). Keep the
  action thin — no rules in the view.
- [X] T016 [US1] Create `front-end/src/featuers/instructor-courses/hooks/usePublishCourse.tsx` exposing a
  `publish` mutation that invalidates `['instructor', 'course', id]` and `['instructor', 'courses']`, and
  surfaces the refusal through `handleAuthError` with the server's `error` message (not a generic string).
- [X] T017 [US1] Create `front-end/src/featuers/instructor-courses/components/PublishPanel.tsx`: show the
  course's current status, offer **Publish** for a draft, disable it when `is_publishable` is false **with
  the reason visible** rather than an unexplained disabled control (FR-019), and report the idempotent
  "already published" case as information rather than an error (FR-005). Compose from the existing `button`
  atom and house tokens.
- [X] T018 [US1] Replace the read-only status placeholder in
  `front-end/src/featuers/instructor-courses/components/CourseOverview.tsx` with `PublishPanel`, removing
  the 004 FR-013 comment that defers publishing to this spec.
- [X] T019 [P] [US1] Tests in `tests_publishing.py` for the publish endpoint: ready course → 200 with
  `changed=true` and `is_published` True in the DB; already-published → 200 with `changed=false` and no
  write; unready → 400 carrying `blockers`, with `is_published` still False.
- [X] T020 [P] [US1] Test the time-of-check gap (FR-014) in `backend/apps/course/tests_publishing.py`: evaluate a ready course, then remove its only
  lecture video, then publish — expect 400 naming the video, proving the gate re-reads state at request time
  rather than trusting an earlier verdict.
- [X] T021 [P] [US1] Test the student-visible effect (FR-001, SC-002) in
  `backend/apps/course/tests_publishing.py`: after a successful publish the course appears in the student
  course list, detail, and homepage, and is enrollable.

**Checkpoint**: publishing works end to end. An instructor can ship a course; a broken course is refused,
though the refusal is not yet itemized in the UI — that is US2.

---

## Phase 4: User Story 2 - See exactly why a course cannot be published yet (Priority: P1)

**Goal**: the blocked instructor is told which specific items are blocking and can reach each one in a click.

**Independent Test**: break one condition at a time — no thumbnail, no sections, an empty section, a lecture
with no/processing/failed video, a quiz with a malformed question — and confirm each appears as a named
blocker with a working link, and that advisories never block.

- [X] T022 [US2] Add `@action(detail=True, methods=['get']) def readiness()` to `InstructorCourseViewSet` in `backend/apps/course/views.py`,
  returning the `ReadinessReport` payload from `PublishReadinessService`. Read-only — it MUST write nothing
  (contract *GET readiness*).
- [X] T023 [US2] Create `front-end/src/featuers/instructor-courses/hooks/useCourseReadiness.tsx` querying at
  `['instructor', 'course', id, 'readiness']`. Comment **why that key shape**: it sits under the prefix every
  existing curriculum/lecture/video mutation already invalidates, which is what makes FR-020 and FR-026 work
  without touching those hooks (research R9).
- [X] T024 [US2] Create `front-end/src/featuers/instructor-courses/components/ReadinessChecklist.tsx`
  rendering blockers and advisories as visually distinct groups (FR-012), each item showing its message and
  linking via `readinessHref()` to the place that fixes it (FR-018). Switch on `code`, never parse `message`.
- [X] T025 [US2] Add the defined loading, error, and **unknown-readiness** states to `ReadinessChecklist` and
  `PublishPanel` (both in `front-end/src/featuers/instructor-courses/components/`): on an unavailable readiness report, say so, offer retry, and keep publish **unavailable** —
  never a misleading ready state, a blank region, or an enabled control (FR-021, FR-022).
- [X] T026 [US2] Add `queryClient.invalidateQueries({ queryKey: ['instructor', 'course'] })` to the
  `invalidate` helper in both
  `front-end/src/featuers/instructor-curriculum/hooks/useQuestionMutations.tsx` and
  `.../useChoiceMutations.tsx`, so editing a question or a choice refreshes readiness. This is the one gap in
  R9's free-refresh finding; the prefix form needs no `courseId` and matches what `useUploadVideo` /
  `useDeleteVideo` already do.
- [X] T027 [P] [US2] Tests in `backend/apps/course/tests_publishing.py` for each blocking code in isolation — `missing_thumbnail` (null **and** blank string),
  `no_sections`, `empty_section` (targeting the right section id), `lecture_video_missing`,
  `lecture_video_processing`, `lecture_video_failed`, `quiz_no_questions`, and `quiz_incomplete_question`
  (blank text / one choice / zero correct choices).
- [X] T028 [P] [US2] Tests in `backend/apps/course/tests_publishing.py`: multiple simultaneous blockers are **all** returned; a fully ready course returns
  `is_publishable=true` with `blockers=[]`; blank language, empty `goals_list`, and no quizzes anywhere
  produce advisories while staying publishable; `price=0` is publishable (FR-010, FR-011, FR-012).
- [X] T029 [P] [US2] Test in `backend/apps/course/tests_publishing.py` that `GET readiness` is pure:
  `is_published` and `last_updated` are identical before and after the call.

**Checkpoint**: a blocked instructor knows exactly what to fix and can get there in one click. Stories 1 and 2
together are the complete publish experience.

---

## Phase 5: User Story 3 - Take a live course back off the catalog (Priority: P1)

**Goal**: unpublishing is available at any time, confirmed honestly, and costs enrolled students nothing.

**Independent Test**: publish a course, enroll a student, unpublish it. The catalog no longer shows it and it
cannot be newly enrolled in, while the enrolled student keeps full access and progress. Republish and confirm
the gate re-runs.

- [X] T030 [US3] Add `@action(detail=True, methods=['post']) def unpublish()` to `InstructorCourseViewSet` in `backend/apps/course/views.py`,
  calling `CoursePublishingService().unpublish()`. **Never consult readiness** (FR-016). Return 200 for both
  the real transition and the already-a-draft no-op (contract *POST unpublish*).
- [X] T031 [US3] Add the `unpublish` mutation to `usePublishCourse.tsx` with the same invalidation set as
  `publish`.
- [X] T032 [US3] Create `front-end/src/featuers/instructor-courses/components/UnpublishDialog.tsx` on the
  existing `alert-dialog` atom, modelled on `DeleteCourseDialog`. The copy MUST state **both** halves
  (FR-006): the course leaves the catalog and takes no new enrollments, **and** students already enrolled
  keep full access and their progress — naming the count from `subscribers_count` when it is above zero
  (research R11).
- [X] T033 [US3] Wire `UnpublishDialog` into `PublishPanel` in `front-end/src/featuers/instructor-courses/components/` so a published course offers **Unpublish** in
  place of Publish (FR-004), and guard against double-submission while the request is in flight (FR-032, spec
  US3 scenario 7).
- [X] T034 [P] [US3] Tests in `backend/apps/course/tests_publishing.py`: published → unpublish → 200
  `changed=true`, draft in the DB; draft → unpublish → 200 `changed=false`, no write; a **published course
  that fails a blocking condition still unpublishes**
  (proving the gate is not applied to this direction).
- [X] T035 [P] [US3] Tests in `backend/apps/course/tests_publishing.py` for the promise in FR-031 — the most important ones in this phase: after an
  unpublish an enrolled student can still fetch course progress, section content, and a video URL; the course
  cannot be newly enrolled in (paid or free); and `Enrollment`, `Order`, `Transaction`, `LectureProgress`,
  `Review`, and `subscribers_count` rows are unchanged.
- [X] T036 [P] [US3] Test in `backend/apps/course/tests_publishing.py` that republishing re-runs the gate:
  unpublish a course, break a condition, attempt publish → 400; fix it → 200 and back in the catalog
  (FR-007).

**Checkpoint**: publishing is fully reversible and the reversal is safe. All three P1 stories are done.

---

## Phase 6: User Story 4 - Find out when a live course develops a problem (Priority: P2)

**Goal**: a published course that stops meeting the bar is flagged to its owner — and is never unpublished by
the system.

**Independent Test**: publish a ready course, then remove a lecture's video. The course stays published and
stays in the catalog, while the workspace and My Courses both flag it as needing attention, naming the
lecture. Restore the video and the flag clears without republishing.

- [X] T037 [US4] Add the needs-attention banner to `PublishPanel.tsx`: when `needs_attention` is true, show a
  prominent warning above the normal status, naming and linking the failing items from the readiness report
  (FR-024). It must read as "your live course has a problem", not as an error in the page.
- [X] T038 [US4] Add a needs-attention indicator to
  `front-end/src/featuers/instructor-courses/components/InstructorCourseCard.tsx` alongside the existing
  status badge, so a problem course is distinguishable from a healthy published one at a glance (FR-025).
  Leave `MyCoursesGrid`'s All/Published/Draft filters unchanged — this is a flag, not a fourth status.
- [X] T039 [US4] Add the live-course reminder to
  `front-end/src/featuers/instructor-courses/components/CourseForm.tsx`: when editing a published course,
  state inline that changes are immediately visible to enrolled students (FR-027). Static, derived from
  `is_published` only (research R12).
  *Implemented in `front-end/src/app/instructor/courses/[courseId]/edit/page.tsx` instead*: that page already
  holds the course, while `CourseForm` is shared with Create and knows nothing about publish state —
  threading a prop through it for one notice would couple the form to publishing for no gain.
- [X] T040 [P] [US4] Tests in `backend/apps/course/tests_publishing.py`: a published course failing a blocking condition serializes `needs_attention=true`;
  a **draft** failing the same condition serializes `false`; a healthy published course serializes `false`.
- [X] T041 [P] [US4] Test FR-023 / SC-008 explicitly in `backend/apps/course/tests_publishing.py` — remove the video from a published course's lecture and
  assert `is_published` is **still True**. Nothing in the system may transition a course on its own.
- [X] T042 [P] [US4] Test in `backend/apps/course/tests_publishing.py` that the flag clears when the underlying items are fixed, with no publish call in
  between (FR-026).
- [X] T043 [P] [US4] Assert with `assertNumQueries` in `backend/apps/course/tests_publishing.py` that the My
  Courses list's query count does **not** grow with the number of owned courses, proving T008's prefetch is
  doing its job (research R5, SC-013).
  *Scoped during implementation*: the list as a whole is **already** O(N) in queries before this feature,
  because of the pre-existing `sections` and `instructor_profile` serializer fields, so the whole-list
  assertion as written could never pass. The test asserts what R5 actually promises: readiness adds **0**
  queries over a prefetched queryset. Mutation-checked — the un-prefetched `Section.objects.filter` read
  costs 12 queries for 3 courses.

**Checkpoint**: a live course can no longer break silently, and the platform still never touches an
instructor's publish status.

---

## Phase 7: User Story 5 - Nobody publishes another instructor's course (Priority: P1)

**Goal**: prove that the ownership guarantee holds on all three routes.

**This phase has no implementation tasks — by design.** Ownership comes from `@action` resolving through the
existing `get_queryset()` filter (research R2), so there is no new code to write and nothing to forget. The
flip side is that **these tests are the only evidence the guarantee holds**, which is why they are not
optional despite the phase adding no features.

**Independent Test**: as instructor B, attempt all three routes against instructor A's course by id; every
attempt refused, nothing exposed, A's course unchanged — verified against the backend, not the UI.

- [X] T044 [P] [US5] Tests in `backend/apps/course/tests_publishing.py`: instructor B against instructor A's course id → 404 on `readiness`, `publish`,
  and `unpublish`; A's `is_published` unchanged in every case; no course data in any response body (FR-028).
- [X] T045 [P] [US5] Tests in `backend/apps/course/tests_publishing.py` for the other callers: a student account → 403 on all three; a staff account with
  **no** `InstructorProfile` → 404 (not a 500, not an `AttributeError`) (FR-029); an anonymous caller → 401/403.
- [X] T046 [P] [US5] Test in `backend/apps/course/tests_publishing.py` that `is_published` is still rejected as a write on `POST` and `PATCH`
  `/courses/instructor/courses/` — publishing MUST NOT be reachable through a metadata save (FR-003).
- [X] T047 [P] [US5] Test in `backend/apps/course/tests_publishing.py` that a draft course is absent from the
  student course list, course detail, and homepage, and is not enrollable (FR-030, SC-011).

**Checkpoint**: every requirement in the spec has coverage. Feature complete.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T048 [P] Export the new surface from `front-end/src/featuers/instructor-courses/index.ts`:
  `usePublishCourse`, `useCourseReadiness`, `PublishPanel`, `ReadinessChecklist`, `UnpublishDialog`, and the
  readiness types plus `readinessHref`.
- [X] T049 [P] Add the cross-reference comments guarding the duplicated completeness rule (research R4): in
  `readiness.py`'s predicate, point at `isQuestionComplete()` in
  `front-end/src/featuers/instructor-curriculum/types/instructorCurriculum.types.ts`; in that function, point
  back and state that the **server** is the publish gate and the client copy drives only a local badge.
- [X] T050 [P] Add a "Course Publishing (spec 007)" section to `specs/_conventions.md` recording the patterns
  later specs will reuse: the `publishing/` package layout, the derived-state rule (never persist the state
  object), readiness-as-computed, the `@action` + `get_queryset` ownership idiom and when to prefer it over
  `APIView`, and the `get_throttles()` scoping form. Matches how 003 documented the instructor shell there.
- [X] T051 [P] Update `specs/_overview.md`: add the three routes to the Courses API table, and note that
  instructor publishing is delivered (the "Instructor Dashboard" and "Instructor Upload UI" gap entries stay
  — 008 and 009 are still open).
- [X] T052 Verify FR-032 concurrency by hand rather than with a threaded test, and record the result in
  `specs/007-course-publishing/tasks.md` under this task. Two simultaneous publish/unpublish requests
  against one course must leave a single coherent state.
  An automated version needs real concurrent transactions (threads plus `TransactionTestCase`) and is flaky
  in CI for the value it returns; `select_for_update()` in T006 is the actual guarantee, and the honest check
  is two overlapping `curl` calls plus a DB read. Do not claim it is covered by the suite.
  **Result (2026-09-15, product owner, course 7, ready course):** `publish` and `unpublish` fired together
  via `Promise.all` from the browser console. `publish` → 200 `status: published`; `unpublish` → 200
  `status: draft`; a follow-up readiness read → `status: published`. No errors, and the final state matches
  the publish response, so the publish transaction committed last — one coherent state. **Limit, recorded
  honestly:** the course's starting state and the hidden `changed` fields weren't captured, and this
  interleaving produces the same output with or without the row lock (e.g. from a draft, unpublish is a
  no-op whichever runs first). So this confirms no errors and a coherent outcome, not that the lock
  engaged; `select_for_update()` remains the guarantee. Not covered by the automated suite.
- [ ] T053 [P] **Optional — not done by product-owner decision (2026-09-15: "leave it").** The frontend has no test runner (`package.json` scripts are dev/build/start/lint only), so this would need a new testing dependency. **Optional** (Constitution IV "SHOULD"): component tests in `front-end/src/featuers/instructor-courses/components/` for `PublishPanel`,
  `ReadinessChecklist`, and `UnpublishDialog` — the disabled-with-reason state, the unknown-readiness state,
  deep-link hrefs per code, and the both-halves confirmation copy.
- [X] T054 Run the full `quickstart.md` walkthrough against a real signed-in instructor, especially step 9
  (the two-tab stale-publish refusal) and step 13 (an enrolled student losing nothing after an unpublish).
  These two are the acceptance steps the automated suite can only approximate.
  **Result (2026-09-15, product owner):** all walkthrough checks passed — blocked draft with visible reason
  and working Fix links, live checklist refresh, video and quiz blockers, advisories, publish, needs-attention
  banner and card badge, live-course edit notice, unpublish dialog with the enrolled student keeping access,
  and the two-tab stale-publish refusal.
- [X] T055 Run `python manage.py test apps.course.tests apps.course.tests_curriculum apps.course.tests_video apps.course.tests_publishing` from `backend/` (not `apps.course` — `apps/` is a namespace package with no `__init__.py`, so unittest discovery cannot resolve it) and confirm the existing
  `tests.py` / `tests_curriculum.py` / `tests_video.py` suites still pass — T008's prefetch and T009's
  serializer fields touch shared read paths.

---

## Dependencies

### Phase order

- **Phase 1 → Phase 2**: the package directory and throttle rate must exist first.
- **Phase 2 → every story phase.** Hard blocker: all five stories import from `publishing/`.
- **US1 (Phase 3) → US2, US3, US4** only through the UI: `PublishPanel` is created in T017 and then
  *extended* by T025 (states), T033 (unpublish), and T037 (banner). The **backend** work in US2–US5 has no
  dependency on US1 and can proceed in parallel with it.
- **Phase 8** depends on the story phases it documents.

### Within phases

- T003 → T004, T005, T006 (DTOs before anything returns them).
- T004, T005 → T006 (the facade composes the state and the gate).
- T005 → T009 (the serializer fields call the service); T008 → T009 in *effect* — T009 works without the
  prefetch but is an N+1 until T008 lands, so do T008 first.
- T011 → T012, T024 (types before the client and the renderer that switch on them).
- T013 → every test task (shared fixtures).
- T015 → T016 → T017 → T018 (endpoint → hook → component → page).
- T022 → T023 → T024 → T025; T024 needs `readinessHref` from T011.
- T030 → T031 → T032 → T033.
- T017 → T037 (the banner extends the panel).

### Cross-story note

US5 depends on nothing and adds nothing — it can be written as soon as the three actions exist (T015, T022,
T030). Consider writing T044–T047 *alongside* each action rather than at the end; an ownership hole found on
the day the endpoint lands is cheaper than one found in Phase 7.

## Parallel opportunities

- **Phase 1**: T001 is independent of T002.
- **Phase 2**: T003 (DTOs), T011 (frontend types), and T012 (frontend API) touch disjoint files and can run
  alongside the backend domain work. T008/T009/T010 all edit `views.py`/`serializers.py` — **not** parallel
  with each other by file.
- **Test tasks** marked `[P]` within a story touch one shared test module but independent test classes; they
  are parallel in authoring, not in file writes — coordinate if two people edit `tests_publishing.py` at once.
- **Phase 8**: T048–T051 and T053 are fully independent.
- **By story, with multiple developers**: after Phase 2, one person can take the US1+US2 frontend chain while
  another takes the US3/US4 endpoints and the US5 test suite.

## Implementation Strategy

### MVP (Phases 1–3)

Setup → Foundational → US1. That delivers the thing with no substitute: an instructor can publish a finished
course and cannot publish a broken one. The refusal is honest but not yet itemized in the UI. **Stop and
validate** with quickstart steps 7–9 before going further.

### Incremental delivery

1. Phases 1–2 → domain layer, unit-tested, nothing reachable.
2. + US1 → **MVP**: courses can go live.
3. + US2 → blocked instructors know what to fix. This is the first point the feature feels finished.
4. + US3 → publishing becomes reversible. Ship here if you ship anything to real instructors.
5. + US4 → live courses stop breaking silently.
6. + US5 → the ownership guarantee is proven (write these earlier if you can; see the cross-story note).
7. + Phase 8 → documented, exported, and walked through by hand.

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- **No migration in this feature.** `data-model.md` §1 lists every field this touches, all of them existing.
- Keep the three actions thin — resolve, delegate, serialize. Every rule belongs in `publishing/`.
- Never let a state class inspect readiness, and never persist the state object (invariant I1, research R1).
- The client's readiness checklist renders the server's verdict; it must not re-derive any condition.
- Commit after each task or logical block; stop at any checkpoint to validate the story independently.
