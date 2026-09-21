# Tasks: Instructor Student Roster

**Input**: Design documents from `/specs/010-instructor-students/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/instructor-students.md, quickstart.md

**Tests**: Backend tests are **included and not optional**. Constitution IV requires unit tests for services,
and three of this feature's rules fail silently without them — the ordering tiebreak (pages repeat with no
writes), the `user__user_id` join (returns nothing if written the obvious way), and the four identical 404s
(a `500` for `?course=abc` is itself an information leak). Frontend component tests are optional
(Constitution IV "SHOULD") and are not included; the gates are `tsc --noEmit` and lint.

**Organization**: grouped by user story, in priority order — US1 → US2 → US3 → US5 → US4.

- **US5 (access) is P1 and comes before US4 (P2)**, as the spec's priorities require.
- **The endpoint itself is Phase 2 Foundational.** One endpoint serves all five stories (owner answer P6),
  and search and paging are *configuration on that view* — the view cannot exist without them. So Phase 2
  builds the endpoint, and each story phase adds the tests that **prove its own slice** plus its UI. This is
  the same shape 009 used for its shared snapshot.
- Each story phase is still independently verifiable: stop at any checkpoint and the story below it works.

**No migration, no new runtime package.** shadcn's table is vendored source. If you find yourself writing a
migration or running `npm install <library>`, stop and re-read plan.md Technical Context.

---

## Tags

Every task carries exactly one ownership tag:

| Tag | Meaning | Rule |
|-----|---------|------|
| **[ME]** | Do this yourself (or review it line by line) | Invariants, security, or the **first instance** of a pattern in this feature |
| **[AI]** | Safe to delegate to an LLM | Repetition of a pattern already established by a `[ME]` task, and wiring |

An `[AI]` task always names the `[ME]` task (or the existing file) whose pattern it repeats. If an `[AI]` task
turns out to need a new decision, stop and promote it to `[ME]`.

**Count**: 23 `[ME]`, 16 `[AI]` across 39 tasks. The `[ME]` weight sits in Phase 2 and in the backend test
classes — the queryset, the paginator, the progress rule and the serializer are where every invariant in this
feature lives, and the tests are what hold them there. Phase 7 (US4) is almost entirely `[AI]`, because by
then every pattern it needs exists.

## How to use this file (humans and LLMs)

Each task is meant to be picked up **on its own**, without the conversation that produced it.

- **First line**: what to do, and in which file.
- **What**: what this task actually accomplishes, in one or two sentences.
- **Read first**: the exact documents or sections that hold the details.
- **Pattern**: for `[AI]` tasks — the existing file or earlier task to copy.
- **Done when**: the acceptance check. The task is incomplete until every bullet holds.
- **`[P]`**: touches a different file from the other open tasks in its phase and has no unfinished
  dependency, so it can run in parallel with other `[P]` tasks.
- Mark a task `[X]` once it's finished.
- **Work tasks that share a file in ID order**, one at a time. Shared files are `views.py`,
  `serializers.py`, `pagination.py`, `tests_roster.py`, `StudentsTable.tsx`, `CourseStudents.tsx` and
  `index.ts`.

Terms used throughout:

- **row / roster row**: one object in `results` — one enrolment (contracts §2).
- **scope**: `?course=<id>` (one course) or no `course` parameter (every owned course).
- **profile**: the signed-in user's `InstructorProfile`.
- **the page**: the ≤ 20 `Enrollment` objects DRF's paginator returned for this request.

## Path Conventions

- **Backend**:
  - New: `backend/apps/course/roster.py`, `backend/apps/course/tests_roster.py`.
  - Edited: `backend/apps/course/{views,urls,serializers,pagination}.py`,
    `backend/apps/course/dashboard/service.py`, `backend/config/settings.py`.
- **Frontend**:
  - New module: `front-end/src/featuers/instructor-students/`. Keep the house spelling `featuers`; schema
    files end in `.schma.ts`.
  - New shared: `front-end/src/components/atoms/table.tsx`,
    `front-end/src/components/molecules/RosterPagination.tsx`.
  - Pages: `front-end/src/app/instructor/courses/[courseId]/students/page.tsx` and
    `front-end/src/app/instructor/students/page.tsx`.
- **Run backend tests with a module label**: `python manage.py test apps.course.tests_roster` (from
  `backend/`, venv active). A bare `apps.course` won't resolve.
- **Zod is v4**; **Next.js 16** (`useSearchParams` must sit under `<Suspense>`).
- **`enrolled_at` is `auto_now_add`**, so it ignores values passed to `create()`. Set it with
  `Enrollment.objects.filter(pk=...).update(enrolled_at=...)` — the existing `set_enrolled_at` helper in
  `tests_analytics.py` does exactly this; import it.

---

## Phase 1: Setup

**Purpose**: scaffolding that later tasks import from.

- [X] T001 [P] [AI] Add the throttle rate `'instructor_students': '120/min'` to `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']` in `backend/config/settings.py`
  - **What**: gives the new endpoint a rate ceiling. Without a `throttle_scope`, `ScopedRateThrottle` (the
    project default) silently no-ops and the endpoint is unthrottled.
  - **Pattern**: the existing `'instructor_analytics'` entry directly above it (spec 009).
  - **Read first**: research.md R10.
  - Place it after `'instructor_analytics'`, with a two-line comment: this read is driven by a **debounced
    search box**, so its traffic is burstier than the dashboard's or analytics' (hence 120, not 60), and the
    limit is a ceiling against a runaway client loop, not a security boundary — ownership is the boundary.
  - **Done when**: `python manage.py check` passes.

- [X] T002 [P] [ME] Add the shadcn table as `front-end/src/components/atoms/table.tsx`, restyled on the house tokens
  - **What**: brings a table primitive into the design system. This is the first table in the project and the
    styling choices here are inherited by 012 (reviews) and 013 (earnings), so they are decided once, here.
  - **Read first**: research.md R11; plan.md Constitution Check (principle II).
  - Run `npx shadcn@latest add table` in `front-end/`. It lands in `src/components/ui/table.tsx` because
    `components.json` aliases `ui` → `@/components/ui` — **that directory is empty and must stay empty**.
    Move the file to `src/components/atoms/table.tsx`, where every other shadcn primitive already lives
    (`button`, `input`, `select`, `accordion`, `avatar`, `skeleton`), and delete `src/components/ui/`.
  - Replace shadcn's default `muted` / `border` / `foreground` classes with the house palette — `darktext`,
    `graytext2`, `darkmint`, `lightbg`, `darkbg` — for the header row, the row divider, and the row hover.
    No raw hex, no Material tokens (existing specs forbid both).
  - Keep every sub-component shadcn exports (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`,
    `TableCell`, `TableCaption`) so the atom is a drop-in for later specs.
  - **Done when**: `npx tsc --noEmit` passes, `src/components/ui/` no longer exists, and nothing imports from
    `@/components/ui/table`.

- [X] T003 [AI] Create `backend/apps/course/tests_roster.py` with shared fixtures
  - **What**: the test module every later backend task adds classes to. It reuses the existing fixture
    helpers instead of redefining them, so roster tests and 008/009 tests build identical data.
  - **Pattern**: the top of `backend/apps/course/tests_analytics.py` (imports, the `AnalyticsTestCase`
    video-provider patching, the `_all_keys` generator).
  - Module docstring: `"""010 — Instructor student roster. Unit tests for the progress rule first, then API tests grouped by user story."""`
  - Import and reuse — **do not redefine**:
    - `make_instructor`, `make_course` from `apps.course.tests`
    - `make_student`, `enroll` from `apps.course.tests_dashboard` (note `make_student` already accepts
      `first_name`, `last_name`, `profile_picture`, and `enroll` accepts `active=False` for the refund case)
    - `add_section`, `complete_lectures`, `set_enrolled_at`, `_all_keys` from `apps.course.tests_analytics`
  - Add `RosterTestCase(APITestCase)`: copy the video-provider patching from `AnalyticsTestCase` verbatim
    (fixtures that delete lectures fire the `post_delete` signal), plus helpers:
    - `url(course=None, search=None, page=None)` — builds `reverse('instructor_students')` with only the
      given query parameters.
    - `get(user, url)` — `force_authenticate` then `GET`.
  - No `timezone.now` patching is needed: this feature has no time windows.
  - Add a placeholder `class SetupTests(SimpleTestCase)` with one assertion that the imported helpers are
    callable, so the module runs green before the endpoint exists.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the endpoint, end to end, plus the frontend contract and address plumbing every story renders
from.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Backend

- [X] T004 [ME] Rename `_person_name` → `person_name` in `backend/apps/course/dashboard/service.py`
  - **What**: makes 008's display-name rule a shared, importable helper so FR-007 cannot drift between the
    dashboard's recent-enrolments list and the roster. It is the only edit to shipped behaviour in this
    feature and it must change no output.
  - **Read first**: research.md R9; data-model.md §4 (`name`).
  - Drop the leading underscore on the definition at `service.py:197` and on both call sites in that same
    file (`service.py:47`, `service.py:203`). Change nothing else — not the body, not `_person_ref`.
  - **Done when**: `python manage.py test apps.course.tests_dashboard apps.course.tests_analytics` passes,
    and `grep -rn "_person_name" backend/` returns nothing.

- [X] T005 [P] [ME] Add `StudentRosterPagination` to `backend/apps/course/pagination.py`
  - **What**: fixes the page size at 20 and makes an out-of-range or malformed `?page=` fall back to page 1
    with a `200`. DRF's default raises `NotFound` → `404`, which FR-024 forbids.
  - **Read first**: research.md R4; data-model.md §2; contracts §1, §4.
  - Subclass `PageNumberPagination` with `page_size = 20`. **Do not** set `page_size_query_param` — FR-021
    fixes the size on the server, which is why this paginator differs from `ReviewPageNumberPagination` and
    `BillingPageNumberPagination` in the same file. Note that difference in a comment.
  - Override `get_page_number(self, request, paginator)` rather than catching `NotFound` afterwards:
    `request.query_params` is an immutable `QueryDict`, so the page cannot be rewritten once the exception
    has been raised. Return `1` for a non-numeric value, for `< 1`, and for `> paginator.num_pages`;
    otherwise the number. Keep DRF's `last_page_strings` handling (`?page=last`).
  - Comment why `num_pages` is safe as the upper bound: Django's `Paginator` reports `num_pages == 1` for an
    empty result (`allow_empty_first_page`), so an empty roster resolves to page 1 instead of tripping the
    bound.
  - **Done when**: `python manage.py check` passes. (Behaviour is proven by T022–T024.)

- [X] T006 [P] [ME] Implement `build_progress_map(enrollments)` in `backend/apps/course/roster.py` (new file)
  - **What**: turns a page of enrolments into `{(user_id, course_id): percent | None}` in **two flat
    queries**, so progress costs the same whether the page holds 1 student or 20. This is the only non-trivial
    logic in the feature.
  - **Read first**: research.md R7, R8; data-model.md §3 (queries 3 and 4) and §4 (`progress`).
  - One module, no package, no classes, no DTOs (owner direction; plan.md part 2). Module docstring explains
    why progress is computed **after** pagination: nothing sorts or filters by it, so it never needs to be in
    the queryset, which rules out both the 40-query `SerializerMethodField` and the correlated-`Subquery`
    version.
  - Take the id sets **from the passed-in page**, never from the full queryset:
    - totals: `Lecture.objects.filter(section__course_id__in=course_ids).values('section__course_id').annotate(n=Count('id'))`
    - completions: `LectureProgress.objects.filter(user__user_id__in=user_ids, lecture__section__course_id__in=course_ids, is_completed=True).values('user__user_id', 'lecture__section__course_id').annotate(n=Count('id'))`
  - **Comment the `user__user_id` join loudly.** `Enrollment.user` is a `CustomUser`;
    `LectureProgress.user` is a `StudentProfile`. Written as `user_id__in=<CustomUser ids>` this query
    returns **nothing at all** and every row silently reads 0%.
  - **Comment the `is_completed=True` filter**: `LectureProgress` rows exist with `is_completed=False` (the
    field's default), and the student-side code filters the same way at `progress/views.py:100`.
  - Per pair: `None` when the course has no lectures (FR-011, SC-007 — never `0`), otherwise
    `round(done / total * 100, 1)`. The `* 100` and the 1-decimal rounding are copied deliberately from
    `progress/utils.py:147` so the figure equals what the student sees; say so in a comment.
  - Return an empty dict for an empty page without issuing either query.
  - **Done when**: `python manage.py check` passes and the module imports cleanly.

- [X] T007 [ME] Add `class ProgressMapUnitTests` to `backend/apps/course/tests_roster.py`
  - **What**: pins the progress rule directly, without going through HTTP. Constitution IV requires unit
    tests for this kind of logic, and these assertions are what stop a later refactor from turning `null`
    into `0`.
  - **Read first**: data-model.md §4, §6 (invariant 4).
  - Cases: 7 of 10 lectures → `70.0`; 0 of 10 → `0.0`; 10 of 10 → `100.0`; a course with **no lectures** →
    `None` (assert `is None`, not falsy — `0.0` is falsy too); a `LectureProgress` row with
    `is_completed=False` does not count; a student in two courses gets two independent values; an empty page
    returns `{}`.
  - Add one `assertNumQueries(2)` around a call with a 20-row page spanning several courses.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T008 [ME] Add `InstructorStudentSerializer` to `backend/apps/course/serializers.py`
  - **What**: defines the roster row. Four of the spec's field invariants live here — the name fallback, the
    avatar normalisation, the date-only format, and progress reaching the client as `null` rather than `0`.
  - **Read first**: contracts §2 (field rules); data-model.md §4, §5; research.md R9.
  - A `ModelSerializer` over `Enrollment` with `fields = ('id', 'name', 'avatar', 'enrolled_at', 'progress', 'course')`:
    - `id` — the **enrolment** id, unmodified (owner answer P2). Comment why: the student id repeats across
      rows in the aggregate scope, which would give duplicate React keys and silently drop rows.
    - `name` — `SerializerMethodField` calling `person_name(obj.user)` imported from
      `apps.course.dashboard.service` (T004). Do not restate the rule here.
    - `avatar` — `SerializerMethodField` returning `obj.user.profile_picture or None`, so `''` and `NULL`
      both reach the client as `null`.
    - `enrolled_at` — `DateField()`, giving `YYYY-MM-DD`. Comment that `settings.TIME_ZONE` is `UTC`, so this
      is already the UTC date (FR-009).
    - `progress` — `SerializerMethodField` reading `self.context['progress'].get((obj.user_id, obj.course_id))`.
      Use `.get()` with no default so a missing pair is `None`, and comment that `None` is the "—" case, never
      `0`.
    - `course` — a small nested read-only serializer over `Course` with `('id', 'title')`. **Always
      present**, in both scopes (research R9).
  - **Nothing else may be added to `fields`.** FR-033 and SC-005 forbid email, order, transaction, quiz and
    lecture data; T029 asserts this over the raw body.
  - **Done when**: `python manage.py check` passes.

- [X] T009 [ME] Add `InstructorStudentsView(ListAPIView)` to `backend/apps/course/views.py`
  - **What**: the endpoint. It resolves the caller to an owner, narrows to one course only if the client
    asked for a course it actually owns, refuses everything else identically, and computes progress for the
    page after DRF has paginated it. This is the security-critical task in the feature.
  - **Read first**: contracts §1, §3; data-model.md §3; research.md R1, R2, R3, R6, R7.
  - `authentication_classes` is the project default; `permission_classes = [IsAuthenticated, isInstructor]`;
    `throttle_scope = 'instructor_students'` (T001); `pagination_class = StudentRosterPagination` (T005);
    `serializer_class = InstructorStudentSerializer` (T008).
  - `filter_backends = [filters.SearchFilter]` with
    `search_fields = ['user__first_name', 'user__last_name', 'user__username']`. Comment what this buys for
    free (research R6): terms are split on whitespace and **ANDed** across the fields, so `"maria gomez"`
    matches first name + last name with no concatenated annotation; the default lookup is `icontains`;
    Django escapes `%` and `_`; a whitespace-only term yields no terms and is a no-op; and `user` is a to-one
    FK so no `.distinct()` is needed.
  - `get_queryset()` — build **from ownership outward**, never from the client's id inward:
    - `Enrollment.objects.filter(course__instructor=self.request.user.instructor_profile, is_active=True)`,
      wrapped in `try/except InstructorProfile.DoesNotExist` returning a `403` with 009's
      `no_instructor_profile` body (FR-034). Not an empty queryset: a `200` with no rows already means "no
      students yet", and a broken account must not read as a new instructor (FR-029).
    - `.select_related('user', 'course')` — keeps name, picture and course title off the N+1 path.
    - `.order_by('-enrolled_at', '-id')`. **The `-id` is not cosmetic**: `enrolled_at` is `auto_now_add` and
      batch enrolments produce identical timestamps, so `-enrolled_at` alone leaves tied rows unordered and
      pages can repeat *and* skip students with no writes happening. Comment it (research R5).
    - When `?course=` is present: parse it with `int()` inside a `try`, reject `< 1`, then resolve it with
      `Course.objects.filter(instructor=<profile>, id=<n>)`. **Every failure — another instructor's course, a
      missing course, `abc`, `0`, `-1` — raises the same `Http404` with the same body.** Without the explicit
      `int()`, `?course=abc` raises `ValueError` → `500`, and a different response for malformed input is
      itself a signal about which ids exist (FR-032). Comment this.
  - Override `list()` to inject the progress map: `filter_queryset(get_queryset())` → `paginate_queryset(...)`
    → `build_progress_map(page)` → `get_serializer(page, many=True)` with the map in the context →
    `get_paginated_response(serializer.data)`. Comment that this ordering is the whole point: progress is
    computed for the ≤ 20 visible rows, not for the filtered set (research R7).
  - Wrap the body in `try/except Exception` returning
    `{'error': "We couldn't load the students. Please try again."}` with `500`, logging the traceback —
    matching the 009 action at `views.py:141`. Never return a raw exception.
  - **Done when**: `python manage.py check` passes. (Behaviour is proven by T012–T029.)

- [X] T010 [AI] Register the route in `backend/apps/course/urls.py`
  - **What**: exposes the view at `/courses/instructor/students/` and gives it the `reverse()` name the tests
    already use.
  - **Pattern**: the existing `path('instructor/analytics/', InstructorAnalyticsView.as_view(), name='instructor_analytics')` line.
  - Add `path('instructor/students/', InstructorStudentsView.as_view(), name='instructor_students')` to
    `urlpatterns`, directly after the analytics path, and add the import. It is a `path`, not a router
    registration — there is no `retrieve` (owner answer P3).
  - **Done when**: `python manage.py test apps.course.tests_roster` passes and
    `reverse('instructor_students')` returns `/courses/instructor/students/`.

### Frontend

- [X] T011 [P] [AI] Create `front-end/src/featuers/instructor-students/schemas/instructorStudents.schma.ts` and `types/instructorStudents.types.ts`
  - **What**: the runtime contract. Zod parses the response and the TS types are inferred from it, so the
    two cannot drift (Constitution I).
  - **Pattern**: `front-end/src/featuers/instructor-analytics/schemas/instructorAnalytics.schma.ts` and its
    sibling types file.
  - **Read first**: data-model.md §7 — copy the schemas from there verbatim.
  - `progress` is `z.number().nullable()` — **nullable, not optional**, so the "—" case is unavoidable at
    every call site instead of collapsing to `0` through a default.
  - Types are `z.infer<...>` only. No hand-written interface parallel to a schema, and no helper functions
    here (unlike 009, which needed `normalizePeriod`).
  - Add a comment on `enrolled_at`: it is a date string, **not** a timestamp, and must never be passed to
    `new Date()` — see T014.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T012 [P] [AI] Create `front-end/src/featuers/instructor-students/api/instructorStudents.api.ts`
  - **What**: the single HTTP call, as a namespaced object on the shared axios instance.
  - **Pattern**: `front-end/src/featuers/instructor-analytics/api/instructorAnalytics.api.ts`.
  - One namespaced object `instructorStudentsAPI` with one method taking
    `{ courseId?: number; search?: string; page?: number }` and hitting
    `/courses/instructor/students/`. Send `course`, `search` and `page` only when they are set — never
    `?search=&page=1` — so the server sees its own defaults.
  - Parse the response with `rosterPageSchema` before returning it, so a shape mismatch becomes the error
    state rather than a half-rendered table.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T013 [P] [AI] Make `front-end/src/hooks/useDebounce.tsx` generic
  - **What**: replaces `value: any` with a type parameter, so the debounced search term stays a `string`
    instead of leaking `any` into a query key (Constitution I).
  - **Read first**: research.md R12.
  - `export default function useDebounce<T>(value: T, delay: number): T`, with `useState<T>(value)`. Change
    nothing about the behaviour or the effect.
  - The hook has **zero call sites** today (this feature is its first consumer), so nothing can break.
  - **Done when**: `npx tsc --noEmit` passes and `grep -rn "useDebounce" front-end/src` shows only the
    definition.

- [X] T014 [ME] Create `front-end/src/featuers/instructor-students/hooks/useRosterParams.tsx`
  - **What**: puts `search` and `page` in the page address so refresh, Back/Forward and shared links survive
    — and resets the page to 1 **in the same write** as a search change.
  - **Read first**: research.md R12; data-model.md §8; spec FR-018, FR-020, FR-023, FR-024.
  - **Pattern for the plumbing**: `featuers/instructor-analytics/hooks/usePeriodParam.tsx` — `router.replace`
    (not `push`, so three keystrokes don't leave three history entries), a fresh `URLSearchParams` from the
    current ones, and `{ scroll: false }`.
  - Return `{ search, page, setSearch, setPage }`. Read with silent fallbacks: `search` → `''`, `page` → `1`
    for anything missing, non-numeric or `< 1`. The API is the strict one; the address never errors.
  - **`setSearch` must write the term and reset `page` in one `replace` call.** Two writes (or a follow-up
    `useEffect`) fire a request for page 5 of a one-page result, which T005 then bounces back to page 1 — a
    visible flicker for no reason. Comment this.
  - Drop the parameter from the URL entirely when it is at its default, rather than writing `?search=&page=1`.
  - Note in the file docstring that consumers must render under `<Suspense>` (Next 16's requirement for
    `useSearchParams`).
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T015 [ME] Create `front-end/src/featuers/instructor-students/hooks/useInstructorStudents.tsx`
  - **What**: the one query hook both pages use. It encodes the two cache rules this feature cannot get
    wrong: never serve a roster from cache, and never show the previous page's rows as if they were the new
    ones.
  - **Read first**: contracts §5 (consumer contract); spec FR-036.
  - **Pattern**: `featuers/instructor-analytics/hooks/useCourseAnalytics.tsx` for the `useQuery` shape,
    `staleTime: 0 / gcTime: 0`, and the error handling.
  - Signature `useInstructorStudents({ courseId, search, page })` with `courseId` optional — the same hook
    serves the workspace tab and the sidebar page (owner answer P6).
  - Query key `['instructor', 'students', { courseId, search, page }]`.
  - **Do not set `placeholderData: keepPreviousData`.** It is the obvious choice for a paged table and it is
    forbidden here: FR-036 says the view must not present the previous page's or search term's rows as the
    new result. Comment the omission so nobody "fixes" it later.
  - `staleTime: 0`, `gcTime: 0` — a roster must not survive an enrolment or a refund.
  - **Done when**: `npx tsc --noEmit` passes.

**Checkpoint**: the endpoint answers over HTTP and the frontend can call it. Verify by hand with
quickstart.md §3 rows 1, 2 and 9 before starting Phase 3.

---

## Phase 3: User Story 1 — See who is enrolled in a course (Priority: P1) 🎯 MVP

**Goal**: the course workspace's Students tab lists that course's students with picture, name, enrolment date
and progress, newest first, with the total count in the header.

**Independent Test**: for a course with known enrolments (including a refunded one), a student with no
picture, a student with no name, and known lecture completions, open its Students tab and confirm every cell
matches the data under FR-006 – FR-013.

### Backend proof for User Story 1

- [X] T016 [US1] [ME] Add `class RosterRowTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: proves every per-row field rule. These are the invariants a future refactor is most likely to
    break quietly.
  - **Read first**: contracts §6 ("Rows"); data-model.md §6.
  - Assertions: a refunded (`is_active=False`) enrolment is absent from `results` **and** from `count`;
    `name` falls back to `username` when both name fields are blank; `avatar` is `null` when
    `profile_picture` is unset; `enrolled_at` matches `^\d{4}-\d{2}-\d{2}$`; 7 of 10 lectures →
    `progress == 70.0`; a course with no lectures → `progress is None`; `is_completed=False` rows don't
    count; a student in two owned courses yields two rows with different `course` and independent
    `progress`; `course` is present in both scopes.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T017 [US1] [ME] Add `class ProgressAgreementTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: binds the roster's progress figure to the one the student sees for the same course, so FR-010
    cannot drift. 009 used the same agreement-test device for the section-unlock rule.
  - **Read first**: spec FR-010 and its Assumptions entry; research.md R7.
  - Set up one student with partial progress, call `/progress/student/courses/` **as that student**, call the
    roster **as the instructor**, and assert the two `progress` values are equal.
  - Add a comment that this is deliberately **not** 009's stricter analytics completion rule (lectures *and*
    quizzes), so a roster row may read 100% for a student analytics does not count as complete.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T018 [US1] [ME] Add `class RosterOrderingTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: proves the sort is total. This is the test for the `-id` tiebreak, and without it the bug it
    catches appears only intermittently in production.
  - **Read first**: research.md R5; data-model.md §6 (invariant 6); spec SC-003.
  - Assertions: newest `enrolled_at` first; rows sharing an identical `enrolled_at` come back in the **same
    order across two identical requests**; with ≥ 25 enrolments sharing one timestamp straddling the page
    boundary, pages 1 and 2 share no `id` and together cover every id exactly once.
  - Use `set_enrolled_at` (imported in T003) — `auto_now_add` ignores values passed to `create()`.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes, and still passes on three
    consecutive runs (the failure mode is order-dependent).

### UI for User Story 1

- [X] T019 [P] [US1] [AI] Create `RosterSkeleton.tsx`, `RosterError.tsx` and `RosterEmpty.tsx` in `front-end/src/featuers/instructor-students/components/`
  - **What**: the three non-table states. `RosterEmpty` takes a variant so one component covers "no students
    yet", "no students match" and "you own no courses".
  - **Pattern**: `featuers/instructor-analytics/components/AnalyticsSkeleton.tsx` and `AnalyticsError.tsx`;
    reuse the `skeleton` atom.
  - `RosterSkeleton` renders header, ~8 placeholder rows and the paging strip, so the layout does not jump
    when real rows arrive (FR-036).
  - `RosterError` shows a plain message plus a retry action, never a raw error (FR-037).
  - `RosterEmpty` takes `variant: 'no-students' | 'no-matches' | 'no-courses'` and, for `'no-matches'`, a
    `term` and a clear-search action. FR-019 requires `'no-matches'` to look visibly different from
    `'no-students'`.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T020 [US1] [ME] Create `ProgressCell.tsx` in `front-end/src/featuers/instructor-students/components/`
  - **What**: renders one progress value. It is small and it carries two display invariants, which is why it
    is its own component rather than inline markup.
  - **Read first**: contracts §5; spec FR-010, FR-011, SC-007.
  - Takes `progress: number | null`. When `null`, render `—` with an empty (unfilled) bar and an accessible
    label saying there is nothing to measure yet — **never `0%`** (SC-007).
  - When a number, the label is `Math.round(value)` + `%` (FR-010's display rule) while the **bar width uses
    the precise value**. Comment why they differ.
  - Use the house tokens for the fill, not shadcn greys.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T021 [US1] [ME] Create `StudentsTable.tsx` and `StudentRow.tsx` in `front-end/src/featuers/instructor-students/components/`
  - **What**: the table itself. First use of the `table` atom, and the place the 375px requirement is
    solved — so the approach here is what US4 and later specs copy.
  - **Read first**: spec FR-004, FR-005, FR-007, FR-008, FR-009, SC-009; research.md R11.
  - `StudentsTable` takes `rows: RosterRow[]` and `showCourse: boolean`, and renders the `table` atom from
    `@/components/atoms/table` (T002). Columns: Student (avatar + name), Enrolled, Progress, and Course only
    when `showCourse` — driven by the **route**, not by the payload, since `course` is always sent.
  - `StudentRow` renders one row: the `avatar` atom with `AvatarFallback` carrying initials for the
    no-picture case (FR-008), the name in full with visible truncation for long or non-Latin names, the date,
    and `ProgressCell`.
  - **Format `enrolled_at` by splitting the string.** Do not build a `Date`: `new Date("2026-07-02")` is UTC
    midnight and `.toLocaleDateString()` renders **1 July** west of Greenwich, which breaks FR-009's promise
    that every viewer sees the same date. Comment this at the formatting site.
  - At narrow widths restructure the row (stacked cells) rather than allowing horizontal page scroll; every
    field in FR-004 must stay visible at 375px.
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass.

- [X] T022 [US1] [ME] Create `CourseStudents.tsx` in `front-end/src/featuers/instructor-students/components/`
  - **What**: the orchestrator for the workspace tab — the only component here that fetches. It owns the
    loading / error / empty / rows state machine that US2–US5 then extend.
  - **Read first**: contracts §5; spec FR-001, FR-003, FR-036, FR-037, FR-038.
  - **Pattern**: `featuers/instructor-analytics/components/CourseAnalytics.tsx`.
  - Takes `courseId`, reads `useRosterParams()` (T014) and `useInstructorStudents()` (T015). Header shows the
    title and `data.count` — the **total**, not `results.length` (FR-002, FR-022).
  - State machine: loading → `RosterSkeleton`; error → `RosterError`; `count === 0` with no search term →
    `RosterEmpty variant="no-students"`; otherwise `StudentsTable` with `showCourse={false}`.
  - Every presentational child takes props and never fetches (Constitution II).
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T023 [US1] [AI] Replace the placeholder in `front-end/src/app/instructor/courses/[courseId]/students/page.tsx` and create the module's `index.ts`
  - **What**: wires the tab into the app and gives the feature module its public surface.
  - **Pattern**: `front-end/src/app/instructor/courses/[courseId]/analytics/page.tsx` (spec 009) — it shows
    the `<Suspense>` wrapper and how the route param reaches the component.
  - Swap `ComingSoon` for `<Suspense fallback={<RosterSkeleton />}><CourseStudents courseId={…} /></Suspense>`.
    The `<Suspense>` is required, not decorative — `useRosterParams` calls `useSearchParams` (Next 16).
  - `index.ts` exports the two orchestrators, the hooks and the types — nothing internal.
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass, and `/instructor/courses/<id>/students`
    renders a real table.

**Checkpoint**: User Story 1 is complete. Run quickstart.md §4 (everything except the Search and Paging
blocks).

---

## Phase 4: User Story 2 — Find a student by name (Priority: P1)

**Goal**: a search box above the roster narrows it by name, across the whole course rather than the current
page.

**Independent Test**: with students whose names share a prefix, differ in case, and include one with no
first/last name, type fragments and confirm the matching, the count, the page reset and the no-matches state
under FR-014 – FR-020.

- [X] T024 [US2] [ME] Add `class RosterSearchTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: proves the search rules — including the four that `SearchFilter` gives for free, which is
    exactly why they need a test: nothing in the view's code states them.
  - **Read first**: contracts §6 ("Search"); research.md R6.
  - Assertions: partial match (`"mar"` → `"Maria"`); case-insensitive; surname-only matches;
    `"maria gomez"` matches across first **and** last name (the AND-across-terms behaviour); `%` and `_`
    matched literally; a whitespace-only term is a no-op returning the full roster; `count` reflects matches
    rather than the full roster; and a student who sits on page 4 of the unfiltered roster is returned on
    page 1 of a search for their name (FR-016).
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T025 [US2] [ME] Create `StudentSearch.tsx` in `front-end/src/featuers/instructor-students/components/`
  - **What**: the search box. It keeps typing responsive while the URL stays the source of truth — the one
    part of this feature where the obvious implementation feels broken to use.
  - **Read first**: research.md R12; spec FR-014, FR-017, FR-020.
  - **The input value is local state, not the URL parameter.** If it reads back from `useSearchParams`, every
    keystroke round-trips through the router and typing feels laggy. The flow is: local state →
    `useDebounce(term, 300)` (T013) → `setSearch` from `useRosterParams` (T014) → query key.
  - Seed the local state from the URL **once on mount**, so a shared link arrives with the term visible in
    the box (FR-020, US2 scenario 8), then let local state lead.
  - Include a clear affordance that resets both the box and the URL parameter.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T026 [US2] [AI] Wire search into `CourseStudents.tsx`
  - **What**: puts the box in the header and adds the no-matches branch to the state machine built in T022.
  - **Pattern**: the state machine already in `CourseStudents.tsx` (T022).
  - Render `StudentSearch` beside the header title (FR-003). Add the branch: `count === 0` **with** a search
    term → `RosterEmpty variant="no-matches" term={search}`; `count === 0` with no term keeps
    `variant="no-students"` (FR-019 requires the two to look different).
  - The header count now describes the filtered set (FR-018) — it already does, since it reads `data.count`.
  - **Done when**: `npx tsc --noEmit` passes and searching in the browser narrows the list.

**Checkpoint**: User Stories 1 and 2 both work. Run quickstart.md §4's Search block.

---

## Phase 5: User Story 3 — Move through the roster page by page (Priority: P1)

**Goal**: numbered paging with a position indicator, correct disabled states, and the page in the address.

**Independent Test**: with a roster spanning several pages, step forward and back and confirm page size, the
position label, the control states, the address, and the out-of-range fallback under FR-021 – FR-025.

- [X] T027 [US3] [ME] Add `class RosterPagingTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: proves the paging contract, and in particular that the four bad-`page` inputs return **page 1
    with `200`** rather than DRF's default `404`.
  - **Read first**: contracts §6 ("Paging"), §4; research.md R4.
  - Assertions: page size is 20; `count`, `next` and `previous` are correct at the first, a middle and the
    last page; `?page=999`, `?page=abc`, `?page=0` and `?page=-1` each return **`200`** with the first
    page's rows; search and page combine so paging applies to matches only; a single-page roster has both
    `next` and `previous` `null`.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T028 [US3] [ME] Create `front-end/src/components/molecules/RosterPagination.tsx`
  - **What**: a numbered paging strip. It is placed in `molecules/` rather than inside the feature because no
    pagination component exists anywhere in the project and 012 (reviews) and 013 (earnings) will need the
    same one.
  - **Read first**: contracts §5; spec FR-022, FR-025.
  - Props: `count`, `page`, `pageSize`, `hasNext`, `hasPrevious`, `onPageChange`. **Derive the position label
    from `count`**, not from `results.length` — `"{from}–{to} of {count}"` (FR-022).
  - Drive the disabled states from `next`/`previous` being `null`, not from arithmetic on `count` — the
    server is authoritative.
  - On a single-page roster still show the position, but render no control that invites a move that does
    nothing (US3 scenario 6).
  - House tokens; keep it feature-agnostic (no roster vocabulary in props or copy).
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass.

- [X] T029 [US3] [AI] Wire paging into `CourseStudents.tsx`
  - **What**: renders the paging strip below the table and connects it to the address.
  - **Pattern**: the `useRosterParams` usage already in `CourseStudents.tsx` (T022, T026).
  - Render `RosterPagination` beneath `StudentsTable` (FR-003), passing `page` and `setPage` from
    `useRosterParams` and `count` / `next` / `previous` from the query.
  - Confirm a page change shows `RosterSkeleton`, **not** the previous page's rows — T015 deliberately omits
    `keepPreviousData` (FR-036).
  - **Done when**: `npx tsc --noEmit` passes and paging works in the browser with the URL updating.

**Checkpoint**: the P1 per-course slice is complete. Run all of quickstart.md §4.

---

## Phase 6: User Story 5 — Nobody sees another instructor's students (Priority: P1)

**Goal**: only the owning instructor can read a roster, and the refusals give nothing away.

**Independent Test**: request a roster as its owner, as another instructor, as a student, and signed out —
directly, without the UI — and confirm only the owner is served and that all four refusal shapes are
identical.

- [X] T030 [US5] [ME] Add `class RosterAccessTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: the security proof. US5 has almost no code of its own, so these assertions *are* the story —
    and the identical-refusal one is the whole point of the explicit `int()` parse in T009.
  - **Read first**: contracts §3, §6 ("Ownership & refusals"); research.md R3; spec FR-030 – FR-035.
  - Assertions: `?course=<another instructor's>` → `404`; `?course=<nonexistent>` → `404` with an
    **identical status and body**; `?course=abc` → the same `404`, **not** `500`; `?course=0` and
    `?course=-1` → the same `404`; a student caller → `403`; anonymous → `401`; a staff user with no
    `InstructorProfile` → `403` with `code: no_instructor_profile` (FR-034, and not a `500`); `POST` → `405` (FR-035).
  - Also assert the aggregate scope: with two instructors each owning courses with students, neither
    instructor's response contains any of the other's enrolment ids.
  - Compare the 404 bodies with `assertEqual` on the parsed JSON, not by eye.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T031 [US5] [ME] Add `class RosterPrivacyTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: asserts over the **raw response body** that no field beyond FR-004 ever escapes — the check
    that survives someone adding a convenient field to the serializer later.
  - **Read first**: spec FR-033, SC-005; contracts §6 ("Privacy").
  - Use the `_all_keys` generator imported in T003 to walk the whole parsed body, and assert the key set of a
    row is exactly `{id, name, avatar, enrolled_at, progress, course}` (plus `{id, title}` inside `course`).
  - Separately assert the serialized **text** contains no `@` from a student's email, and no `order`,
    `transaction`, `quiz`, `score` or `lecture` key anywhere.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T032 [US5] [AI] Handle the refusal in the UI, in `CourseStudents.tsx`
  - **What**: makes a non-owned or missing course id in the address show a not-found view instead of an
    error blob or an empty table.
  - **Pattern**: however 009's `CourseAnalytics.tsx` renders its not-owner case — reuse that component
    rather than writing a second one.
  - Branch on the query's `404` and render the existing not-found / 403 view. Everything else stays
    `RosterError`. Do not distinguish "not yours" from "doesn't exist" in the copy — the server
    deliberately doesn't (FR-032).
  - **Done when**: `npx tsc --noEmit` passes, and putting another instructor's course id in the URL shows the
    not-found view.

**Checkpoint**: all P1 stories are complete and the endpoint is proven safe. Run quickstart.md §3 and the
ownership line in §4.

---

## Phase 7: User Story 4 — See every student across all my courses (Priority: P2)

**Goal**: the sidebar Students page lists every enrolment across every owned course, with a Course column.

**Independent Test**: for an instructor owning several courses — including one with no students and a student
enrolled in two of them — open the sidebar page and confirm row composition, the course column, ordering,
search, paging and both empty states under FR-026 – FR-029.

**Note**: this phase is almost entirely reuse. Everything it needs already exists; it adds one column, one
orchestrator and one page. It can be dropped without touching Phases 3–6.

- [X] T033 [P] [US4] [AI] Add `class AggregateScopeTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: proves the no-`course` scope behaves as specified. The security half is already covered by
    T030; this is the functional half.
  - **Pattern**: `RosterRowTests` (T016) — same assertions, no `course` parameter.
  - Assertions: with no `course`, enrolments from **every** owned course appear; a student enrolled in two
    owned courses yields two rows with different `course` and independent `enrolled_at` and `progress`
    (FR-027); ordering is by `enrolled_at` across all courses, not grouped by course (FR-028); an instructor
    who owns courses but has no students gets `count: 0`; an instructor who owns no courses gets `count: 0`.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T034 [US4] [AI] Create `InstructorStudents.tsx` in `front-end/src/featuers/instructor-students/components/`
  - **What**: the orchestrator for the sidebar page. Same state machine as the tab, with the Course column on
    and one extra empty state.
  - **Pattern**: `CourseStudents.tsx` (T022, T026, T029) — copy it and change three things.
  - Call `useInstructorStudents()` with **no** `courseId`. Pass `showCourse={true}` to `StudentsTable`
    (T021). No course breadcrumb or workspace tab bar — this is a sidebar page (FR-002).
  - Distinguish the two empty cases (FR-029): the instructor owns **no courses** →
    `RosterEmpty variant="no-courses"`, pointing at creating one; owns courses but has **no students** →
    `variant="no-students"`. Derive "owns no courses" from the existing instructor-courses query rather than
    inferring it from `count: 0`, which cannot tell the two apart.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T035 [US4] [AI] Replace the placeholder in `front-end/src/app/instructor/students/page.tsx`
  - **What**: wires the sidebar page in, retiring the last `ComingSoon` placeholder this spec owns.
  - **Pattern**: T023 (the tab page) and `front-end/src/app/instructor/analytics/page.tsx`.
  - Swap `ComingSoon` for `<Suspense fallback={<RosterSkeleton />}><InstructorStudents /></Suspense>`, and
    export `InstructorStudents` from the module's `index.ts`.
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass, `/instructor/students` renders a real table
    with a Course column, and the sidebar Students item is marked active.

**Checkpoint**: every user story is complete. Run quickstart.md §5.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T036 [ME] Add `class RosterPerformanceTests(RosterTestCase)` to `backend/apps/course/tests_roster.py`
  - **What**: pins the query plan at four. This is the guard that stops a future
    `SerializerMethodField` from quietly reintroducing the 40-query version.
  - **Read first**: research.md R7; data-model.md §3; plan.md Performance Goals.
  - Pin both plans: 5 queries for a full 20-row page in the `?course=` scope (4 plus the ownership
    resolution) and 4 in the aggregate scope; unchanged when the 20 rows span 20 **different** courses, and
    unchanged by a search term.
  - Name the queries in the docstring (ownership resolution, count, page, lecture totals, completions), so a
    failure is diagnosable from the test alone.
  - **Done when**: `python manage.py test apps.course.tests_roster` passes.

- [X] T037 [P] [AI] Add a roster/pagination note to `specs/_conventions.md`
  - **What**: records the two reusable decisions this feature introduces, so 012 and 013 follow them instead
    of re-deciding.
  - **Pattern**: the short sections specs 007, 008 and 009 each added to the same file.
  - Cover: page-number pagination for numbered-page lists (and when cursor is right instead — when you don't
    need a total); the `('-<date>', '-id')` total-ordering rule for any paginated list; `SearchFilter` with
    `search_fields` as the default name-search approach; computing per-row derived values **after**
    pagination; and the `table` atom plus `RosterPagination` molecule as the shared table stack.
  - **Done when**: the section is in `specs/_conventions.md` and reads consistently with the existing ones.

- [X] T038 [AI] Run the full gate set from `backend/` and `front-end/`
  - **What**: confirms the feature is green and that nothing shared regressed — T004 renamed a helper 008 and
    009 both use.
  - From `backend/`: `python manage.py test apps.course.tests_roster`, then
    `python manage.py test apps.course.tests_dashboard apps.course.tests_analytics apps.course.tests_publishing apps.course.tests_curriculum`.
  - From `front-end/`: `npx tsc --noEmit` and `npm run lint`.
  - **Done when**: everything passes with no new warnings.

- [ ] T039 [ME] Walk `specs/010-instructor-students/quickstart.md` end to end in the browser
  - **What**: the owner-run acceptance pass. Several cases cannot be reached from the UI at all (the
    identical 404 bodies, the refund recount, the tied-timestamp order), which is why §3 exists.
  - **Read first**: [quickstart.md](./quickstart.md) — including the fixture-data list, which is what makes
    the edge cases reachable.
  - Pay particular attention to: §3 rows 3–5 (diff the three 404 bodies); the refund recount; the tie check
    **run several times** (it fails intermittently if T018's tiebreak regressed); §4's lecture-less course
    showing `—`; §6 at 375px in both light and dark; and §7's regression list.
  - **Done when**: every checkbox in quickstart.md §§3–7 holds. Anything that fails goes back to the task
    that owns it, not into a patch here.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)** — no dependencies.
- **Phase 2 (Foundational)** — needs Phase 1. **Blocks every user story.**
- **Phase 3 (US1, P1)** — needs Phase 2. The MVP.
- **Phase 4 (US2, P1)** — needs Phase 3 (T026 edits `CourseStudents.tsx` from T022).
- **Phase 5 (US3, P1)** — needs Phase 3 (T029 edits the same file).
- **Phase 6 (US5, P1)** — backend half (T030, T031) needs only Phase 2; UI half (T032) needs Phase 3.
- **Phase 7 (US4, P2)** — needs Phases 3–5, which it copies wholesale.
- **Phase 8 (Polish)** — needs every story you intend to ship.

### Within Phase 2

- T004 before T008 (the serializer imports `person_name`).
- T005, T006, T008 before T009 (the view wires all three together).
- T006 before T007 (tests the function).
- T009 before T010 (the route needs the view).
- T011 before T012 (the API client parses with the schema).
- T013 before T025 (the search box uses the generic hook).
- Frontend T011–T015 are independent of all backend tasks and can run alongside them.

### Serialised by shared file

Work these in ID order, one at a time:

- `backend/apps/course/tests_roster.py` — T003, T007, T016, T017, T018, T024, T027, T030, T031, T033, T036
- `backend/apps/course/views.py` — T009
- `front-end/src/featuers/instructor-students/components/CourseStudents.tsx` — T022, T026, T029, T032
- `front-end/src/featuers/instructor-students/index.ts` — T023, T035

### Parallel opportunities

- **Phase 1**: T001, T002 in parallel (settings vs frontend); T003 after T001 is not required — it only
  needs the route name to exist by T010.
- **Phase 2**: two tracks run fully in parallel — backend (T004 → T005/T006 → T007/T008 → T009 → T010) and
  frontend (T011 → T012, plus T013, T014, T015).
- **Phase 3**: T019 and T020 in parallel with each other and with the backend tests T016–T018.
- **Phase 6**: T030 and T031 can be written while Phase 3's UI work is in progress.
- **Phase 7**: T033 in parallel with T034.

---

## Parallel Example: Phase 2

```bash
# Backend track (in ID order — T005 and T006 touch different files):
Task: "T005 Add StudentRosterPagination to backend/apps/course/pagination.py"
Task: "T006 Implement build_progress_map in backend/apps/course/roster.py"

# Frontend track, at the same time (four different files, no shared dependency):
Task: "T011 Create the Zod schema and inferred types"
Task: "T013 Make useDebounce generic"
Task: "T014 Create useRosterParams"
Task: "T015 Create useInstructorStudents"
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 (Setup) — T001–T003
2. Phase 2 (Foundational) — T004–T015 · **the endpoint exists and is callable here**
3. Phase 3 (US1) — T016–T023
4. **STOP and VALIDATE**: quickstart.md §4 minus the Search and Paging blocks
5. The workspace Students tab is real. Demo it.

### Incremental delivery

1. Setup + Foundational → the endpoint answers over HTTP (verify with quickstart §3)
2. **+ US1** → the tab lists students → demo (**MVP**)
3. **+ US2** → search works → demo
4. **+ US3** → paging works → the full P1 slice, demo
5. **+ US5** → proven safe → the point at which this is shippable
6. **+ US4** → the sidebar page → the sidebar placeholder is gone
7. **+ Polish** → query-plan guard, conventions note, full gate run, owner walkthrough

**Ship boundary**: US1 + US2 + US3 + US5 is a complete, safe feature. US4 is additive.

### Parallel team strategy

Phase 2 splits cleanly in two after T004: one person on the backend (T005–T010), one on the frontend
plumbing (T011–T015). From Phase 3 they converge on `CourseStudents.tsx`, so hand that file to one person.

---

## Notes

- `[P]` = different file, no unfinished dependency.
- `[ME]` / `[AI]` is an **ownership** tag, not a difficulty rating. An `[AI]` task that needs a new decision
  stops and becomes `[ME]`.
- Every `[AI]` task names the pattern it copies. If that pattern does not exist yet, the task is out of order.
- Commit after each task or logical group.
- Three tasks exist purely because a rule fails **silently** without them — T018 (ordering), T030 (identical
  refusals) and T036 (query count). Do not skip them because the feature "looks fine".
- No migration. No new runtime package. If either appears, stop.
