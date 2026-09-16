# Tasks: Instructor Dashboard — At-a-Glance Summary Landing

**Input**: Design documents from `/specs/008-instructor-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/instructor-dashboard.md, quickstart.md

**Tests**: Backend `APITestCase` tests are **included and not optional**. Constitution IV requires unit tests
for services. User Story 5 (access) has almost no implementation of its own, so its tests are the only proof
it works. Frontend component tests are optional (Constitution IV "SHOULD") and aren't included.

**Organization**: Tasks are grouped by user story, in priority order: US1, US2 and US5 are P1; US3 and US4
are P2. The endpoint, the response shape, and the frontend state machine are **Phase 2 Foundational**,
because every story renders from the same snapshot. Each story phase then fills in its own section of the
backend service, its tests, and its component.

**No migration. No new dependency.** If you find yourself writing either, stop and re-read `data-model.md` §1
and `plan.md` Technical Context.

---

## How to use this file (humans and LLMs)

Every task is written to be picked up **on its own**, by you or by an LLM, without reading the conversation
that produced it.

- **The first line** says what to do and in which file.
- **Read first** lists the exact documents or sections that hold the details. Read them before starting.
- **Done when** is the acceptance check. A task isn't complete until every bullet in it is true.
- **`[P]`** means the task touches a different file from the other open tasks in its phase and has no
  unfinished dependency, so it can run at the same time as other `[P]` tasks.
- **Mark a task `[X]`** when it's finished, so whoever picks up the next task (you or an LLM) knows the
  state.
- **When splitting work:** tasks in the same file (`service.py`, `tests_dashboard.py`,
  `InstructorDashboard.tsx`) must be done **in ID order**, one at a time. Hand whole phases to one person, or
  split along the `[P]` markers.

Terms used throughout:

- **snapshot**: the single JSON response from `GET /courses/instructor/dashboard/`
  (`contracts/instructor-dashboard.md`).
- **profile**: the signed-in user's `InstructorProfile`.
- **readiness / report**: 007's `PublishReadinessService().evaluate(course)` result.
- **Phase 2 stubs**: placeholder methods that later story tasks replace.

## Path Conventions

- **Backend**: `backend/apps/course/`, with the new subpackage `backend/apps/course/dashboard/`. The view goes
  in `backend/apps/course/views.py`, the route in `backend/apps/course/urls.py`, settings in
  `backend/config/settings.py`, and tests in `backend/apps/course/tests_dashboard.py`.
- **Frontend**: the new module `front-end/src/featuers/instructor-dashboard/` (house spelling `featuers`,
  schema files end in `.schma.ts`). The page is `front-end/src/app/instructor/page.tsx`.
- **Run backend tests with a module label**: `python manage.py test apps.course.tests_dashboard` (from
  `backend/`, venv active). `apps.course` on its own won't resolve.
- **Zod is v4** (`zod@^4`): use `z.object`, `z.enum`, `z.literal`, `.nullable()`, and `z.infer`.

---

## Phase 1: Setup

**Purpose**: empty scaffolding that later tasks import from.

- [X] T001 [P] Add the throttle rate `'instructor_dashboard': '60/min'` to `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']` in `backend/config/settings.py`
  - **Read first**: research.md R10.
  - Put it after `'course_publish'`, with a one-line comment: the dashboard is the heaviest instructor read,
    so this is a ceiling against a runaway client loop, not a security boundary.
  - **Done when**: `python manage.py check` passes, and the dict contains the new key.

- [X] T002 [P] Create the package `backend/apps/course/dashboard/` with an `__init__.py` holding only a module docstring
  - **Read first**: plan.md Source Code tree; `backend/apps/course/publishing/__init__.py` (copy its
    docstring style).
  - The docstring lists `dto.py`, `attention.py`, `service.py` with a one-line purpose each, and ends with
    "Import from here, not from the submodules." The export surface stays empty for now (T006 fills it in).
  - **Done when**: `python manage.py shell -c "import apps.course.dashboard"` succeeds.

- [X] T003 [P] Create the frontend module folders `front-end/src/featuers/instructor-dashboard/{api,schemas,types,hooks,components}` and an empty `front-end/src/featuers/instructor-dashboard/index.ts`
  - `index.ts` holds a single comment: `// Public surface of the instructor dashboard feature (spec 008).`
  - **Done when**: the folders exist and `npx tsc --noEmit` (from `front-end/`) still passes.

**Checkpoint**: settings load, and both new packages exist and are empty.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the endpoint, the response shape end to end, and the frontend state machine. At the end of this
phase, `GET /courses/instructor/dashboard/` returns a **correctly shaped** snapshot with zero/empty section
values (stubs), and `/instructor` renders it through all of its states.

**⚠️ CRITICAL**: no user story work can start until this phase is complete.

### Backend

- [X] T004 Create `backend/apps/course/dashboard/dto.py` with every frozen dataclass from data-model.md §4 plus a `to_dict()` on `DashboardSnapshot`
  - **Read first**: data-model.md §4 (every field and type) and §5 (`AttentionType`); the JSON examples in
    contracts/instructor-dashboard.md; `backend/apps/course/publishing/dto.py` (style: `@dataclass(frozen=True)`,
    tuples for sequences, `typing.Literal`).
  - Define `AttentionType = Literal['live_needs_attention', 'video_failed', 'ready_to_publish', 'draft_in_progress']`
    and `Mode = Literal['onboarding', 'full']`.
  - Define, in this order: `PersonRef`, `CourseRef`, `RecentEnrollment`, `RecentReview`, `AttentionTarget`,
    `AttentionItem` (with `created_at: datetime` **for sorting only**), `NeedsAttention`,
    `OnboardingProgress`, `CourseCounts(total, published)`, `StudentCounts(distinct, enrollments)`,
    `Rating(avg_rating: float | None, reviews_count)`, `Earnings(amount: Decimal, currency: str = 'USD')`,
    `DashboardSnapshot`.
  - `DashboardSnapshot.to_dict()` must produce **exactly** the contract's JSON shape:
    - tuples become lists;
    - `Earnings.amount` becomes a 2-decimal string via `f"{amount.quantize(Decimal('0.01'))}"`;
    - every `datetime` becomes a string via `rest_framework.serializers.DateTimeField().to_representation(value)`,
      so the format matches the rest of the API;
    - `AttentionItem.created_at` is **omitted**;
    - `AttentionTarget.lecture_id` is always present (`None` when not a lecture target).
  - Add a module docstring explaining that nothing here is persisted and why `created_at` isn't serialized.
  - **Done when**: building a `DashboardSnapshot` by hand in `manage.py shell` and calling `to_dict()`
    produces keys identical to the onboarding-mode example in the contract, and `json.dumps` succeeds on the
    result.

- [X] T005 Create `backend/apps/course/dashboard/service.py` with `InstructorDashboardService.build(profile) -> DashboardSnapshot`, the shared course query, the name helpers, and **stub** section methods
  - **Read first**: research.md R5 (query plan) and R6 (definitions); data-model.md §3; plan.md Summary;
    `backend/apps/course/publishing/service.py` (docstring style, `READINESS_PREFETCH`).
  - Implement for real:
    - `_load_courses(profile) -> list[Course]`:
      `Course.objects.filter(instructor=profile).annotate(active_students=Count('enrollment', filter=Q(enrollment__is_active=True), distinct=True)).prefetch_related(*READINESS_PREFETCH).order_by('-created_at', '-id')`,
      wrapped in `list(...)`. Import `READINESS_PREFETCH` from `apps.course.publishing`. Comment that only
      **one** reverse-relation `Count` can go on this query, because a second one would multiply both (R5).
    - `_person_name(user) -> str`: `f"{user.first_name} {user.last_name}".strip() or user.username`.
    - `_person_ref(user) -> PersonRef`: `PersonRef(name=_person_name(user), avatar=user.profile_picture or None)`.
      **Never read `user.email`.**
    - `build(profile)`: calls `_load_courses` once, then each section method below, and returns a
      `DashboardSnapshot` with `mode = 'onboarding' if not courses else 'full'` and
      `instructor_name = _person_name(profile.user)`.
  - Implement as **stubs** (each with a `# Phase 2 stub — replaced by Txxx` comment naming the task):
    - `_course_counts(courses)` → `CourseCounts(0, 0)` (T018)
    - `_student_counts(profile)` → `StudentCounts(0, 0)` (T018)
    - `_rating(profile)` → `Rating(None, 0)` (T018)
    - `_earnings(profile)` → `Earnings(Decimal('0'))` (T018)
    - `_needs_attention(courses)` → `NeedsAttention(0, ())` (T022)
    - `_recent_enrollments(profile)` → `()` (T030)
    - `_recent_reviews(profile)` → `()` (T030)
    - `_onboarding(profile, courses)` → `OnboardingProgress(False, False, False, False, False)` (T034)
  - The service takes **only** a profile and never accepts ids from the caller (data-model §7, I1).
  - **Done when**: `InstructorDashboardService().build(profile).to_dict()` runs in the shell for an instructor
    with 0 courses and for one with courses, and returns the contract's full key set.

- [X] T006 Fill the public surface in `backend/apps/course/dashboard/__init__.py`
  - Export `InstructorDashboardService`, `DashboardSnapshot`, `AttentionItem`, `AttentionType`, with
    `__all__`. Keep the T002 docstring.
  - **Done when**: `from apps.course.dashboard import InstructorDashboardService` works.

- [X] T007 Add `InstructorDashboardView(APIView)` to `backend/apps/course/views.py`
  - **Read first**: research.md R8 and R9; the Errors table in contracts/instructor-dashboard.md;
    `VideoUploadSignatureView` in the same file (for the class-level `throttle_scope` pattern).
  - Class attributes: `authentication_classes = [CookieJWTAuthentication]`,
    `permission_classes = [IsAuthenticated, isInstructor]`, `throttle_scope = 'instructor_dashboard'`.
  - `get(self, request)`:
    1. `try: profile = request.user.instructor_profile` / `except InstructorProfile.DoesNotExist:` return
       `Response({'error': 'No instructor profile is associated with this account.', 'code': 'no_instructor_profile'}, status=403)`.
    2. `try:` build the snapshot **and** call `.to_dict()` inside the same `try` / `except Exception:` →
       `logger.exception('Instructor dashboard snapshot failed for profile %s', profile.id)` and return
       `Response({'error': "We couldn't load your dashboard. Please try again."}, status=500)`.
    3. Return `Response(data, status=200)`.
  - Comments to include: why this is an `APIView` and not an `@action` (no owning row, R2), and why the whole
    build plus serialization sits in one `try` (all-or-nothing, FR-028).
  - Import `InstructorDashboardService` from `.dashboard`.
  - **Done when**: the file imports cleanly (`python manage.py check`).

- [X] T008 Register the route `path('instructor/dashboard/', InstructorDashboardView.as_view(), name='instructor_dashboard')` in `backend/apps/course/urls.py`
  - Add `InstructorDashboardView` to the import from `.views`, and add the path to `urlpatterns` next to the
    existing entries.
  - **Done when**: `reverse('instructor_dashboard')` returns `/courses/instructor/dashboard/`, and a signed-in
    instructor's GET in the browser or with curl returns 200 with the full key set.

- [X] T009 Create `backend/apps/course/tests_dashboard.py` with shared fixtures and a shape smoke test
  - **Read first**: the top of `backend/apps/course/tests_publishing.py` (fixture style, imports);
    `make_instructor` / `make_course` in `backend/apps/course/tests.py`.
  - Module docstring: `"""008 — Instructor dashboard. Fixtures first, then tests grouped by user story."""`
  - Import and reuse `make_instructor` and `make_course` from `apps.course.tests`, and `make_ready_course`
    and `break_one` from `apps.course.tests_publishing`. **Don't redefine them.**
  - Add these helpers:
    - `make_student(email, username, first_name='', last_name='', profile_picture=None)` → a `CustomUser`
      with `role='student'` and `is_active=True`, plus its `StudentProfile` (`get_or_create`).
    - `enroll(user, course, amount='10.00', status='paid', active=True)` → creates an `Order`
      (`currency='USD'`, `stripe_payment_intent_id='test'`) and an `Enrollment(order=..., is_active=active)`.
      Returns the enrollment.
    - `review(user, course, rating=5, comment='Great')` → a `Review` using the student's `StudentProfile`.
    - `DASHBOARD_URL = reverse('instructor_dashboard')`.
    - A `DashboardTestCase(APITestCase)` base class with `get_dashboard(self, user)` that runs
      `self.client.force_authenticate(user)` and returns the response.
  - Add `test_snapshot_has_contract_shape`: an instructor with one draft gets 200, and the response has
    exactly the top-level keys `mode, instructor_name, courses, students, rating, earnings, recent_enrollments,
    recent_reviews, needs_attention, onboarding`, with `mode == 'full'`.
  - **Done when**: `python manage.py test apps.course.tests_dashboard` passes.

### Frontend

- [X] T010 [P] Create the Zod schema `front-end/src/featuers/instructor-dashboard/schemas/instructorDashboard.schma.ts`
  - **Read first**: data-model.md §8; the JSON examples and Field rules in contracts/instructor-dashboard.md;
    research.md R11 (why the response is validated).
  - Export `AttentionTypeSchema = z.enum(['live_needs_attention','video_failed','ready_to_publish','draft_in_progress'])`
    and the schemas `PersonRefSchema` (`name: z.string()`, `avatar: z.string().nullable()`), `CourseRefSchema`,
    `RecentEnrollmentSchema`, `RecentReviewSchema` (`rating: z.number().int().min(1).max(5)`),
    `AttentionTargetSchema` (`kind: z.enum(['course','lecture'])`, `lecture_id: z.number().nullable()`),
    `AttentionItemSchema`, and `DashboardSnapshotSchema`.
  - `earnings.amount` is `z.string()`, `earnings.currency` is `z.literal('USD')`, `rating.avg_rating` is
    `z.number().nullable()`, `mode` is `z.enum(['onboarding','full'])`, and all timestamps are `z.string()`.
  - Add a top comment saying this validation is load-bearing for FR-027: a malformed payload must become the
    error state, never render as zeros.
  - **Done when**: `npx tsc --noEmit` passes, and `DashboardSnapshotSchema.parse(<both contract examples>)`
    succeeds (check once in a scratch file or the browser console, then delete the scratch file).

- [X] T011 Create types and helpers in `front-end/src/featuers/instructor-dashboard/types/instructorDashboard.types.ts`
  - **Depends on**: T010.
  - **Read first**: data-model.md §6 (link targets); `readinessHref` in
    `front-end/src/featuers/instructor-courses/types/instructorCourses.types.ts` (copy its exhaustive
    `switch` + `never` pattern).
  - Export `z.infer` types: `DashboardSnapshot`, `AttentionType`, `AttentionItem`, `RecentEnrollment`,
    `RecentReview`, `PersonRef`, `CourseRef`.
  - Export these helpers:
    - `attentionHref(item: AttentionItem): string`: `target.kind === 'lecture' && target.lecture_id !== null`
      → `/instructor/courses/${course_id}/curriculum/lectures/${lecture_id}`, otherwise
      `/instructor/courses/${course_id}`. Then a `switch (item.type)` with a `never` default, so a new
      backend type is a `tsc` error.
    - `ATTENTION_LABEL: Record<AttentionType, string>`: `'Live course needs attention'`, `'Video failed'`,
      `'Ready to publish'`, `'Draft in progress'`.
    - `formatMoney(amount: string, currency: 'USD'): string`: `new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount))`
      (full precision, never compact; R7).
    - `formatDate(iso: string): string`: `new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`.
    - `initials(name: string): string`: up to two uppercase initials, `'?'` for an empty name.
    - `isNoInstructorProfileError(error: unknown): boolean`: true when it's an Axios error with
      `response.status === 403` and `response.data.code === 'no_instructor_profile'`. Use `isAxiosError`
      from `axios`, not `any`.
  - **Done when**: `npx tsc --noEmit` passes with no `any`.

- [X] T012 Create the API client `front-end/src/featuers/instructor-dashboard/api/instructorDashboard.api.ts`
  - **Depends on**: T010, T011.
  - **Read first**: `front-end/src/featuers/instructor-courses/api/instructorCourses.api.ts` (style).
  - `async function getSnapshot(): Promise<DashboardSnapshot>`: `const { data } = await axiosInstance.get('/courses/instructor/dashboard/')`
    then `return DashboardSnapshotSchema.parse(data)`. Comment that a parse failure throws on purpose (FR-027).
  - `export const instructorDashboardAPI = { getSnapshot };`
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T013 Create the query hook `front-end/src/featuers/instructor-dashboard/hooks/useInstructorDashboard.tsx`
  - **Depends on**: T011, T012.
  - **Read first**: research.md R11 (why `staleTime: 0` + `gcTime: 0` rather than invalidation).
  - `useQuery({ queryKey: ['instructor', 'dashboard'], queryFn: instructorDashboardAPI.getSnapshot, staleTime: 0, gcTime: 0, refetchOnMount: 'always', retry: (count, error) => !isNoInstructorProfileError(error) && count < 1 })`.
  - Include the comment from R11: the global staleTime is 5 minutes, the dashboard depends on nearly every
    instructor mutation, and dropping the cache on unmount means returning to the page always shows fresh
    data without editing the 004–007 hooks.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T014 [P] Create the state components `DashboardSkeleton.tsx`, `DashboardError.tsx`, `NoInstructorProfileState.tsx` in `front-end/src/featuers/instructor-dashboard/components/`
  - **Read first**: spec.md FR-026, FR-027, FR-032; `front-end/src/components/molecules/ComingSoon.tsx`
    (house centered-state style and tokens); `front-end/src/components/atoms/skeleton.tsx`.
  - `DashboardSkeleton` (no props): the **same grid** as the full dashboard, using `Skeleton` blocks: a header
    bar, 4 tile blocks (`grid-cols-2 lg:grid-cols-4`), two list cards (`grid-cols-1 lg:grid-cols-2`), and one
    wide card. **No numbers, no text such as "0" or "No enrollments yet".** Add `aria-busy="true"` and an
    `sr-only` "Loading your dashboard".
  - `DashboardError({ onRetry }: { onRetry: () => void })`: a centered card with an icon
    (`lucide-react` `AlertTriangle`), the title "We couldn't load your dashboard", the text "Check your
    connection and try again.", and a `Button` "Retry" that calls `onRetry`. Add `role="alert"`.
  - `NoInstructorProfileState` (no props): a centered state titled "Instructor profile not found", with text
    explaining the account has no instructor profile and to contact support. No retry.
  - Style with the house tokens only (`text-darktext`, `text-graytext2`, `bg-darkmint`, `border-darkbg`,
    `bg-white`). No raw hex.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T015 [P] Create `front-end/src/featuers/instructor-dashboard/components/OnboardingChecklist.tsx` by **moving** the static content out of `front-end/src/app/instructor/page.tsx`
  - **Read first**: the current `front-end/src/app/instructor/page.tsx`.
  - Move the `onboardingSteps` array and its JSX into an exported `OnboardingChecklist` component that takes
    **no props for now**. Keep the markup, links, and copy as they are, but change the CTA link to
    `/instructor/courses/new` and its text to "Create your first course". T035 turns this into the derived
    checklist.
  - **Done when**: the component compiles, and it renders exactly what `/instructor` renders today.

- [X] T016 Create the orchestrator `front-end/src/featuers/instructor-dashboard/components/InstructorDashboard.tsx` and `DashboardHeader.tsx`
  - **Depends on**: T013, T014, T015.
  - **Read first**: research.md R12 (the state order); spec.md FR-002, FR-003.
  - `DashboardHeader({ name }: { name: string })`: an `h1` "Welcome back, {name}", the subtitle "Here's how
    your courses are doing", and a primary `Link` styled as the house primary button to
    `/instructor/courses/new` with the text "Create course" and a `Plus` icon. Use `flex-wrap` so the button
    drops under the title on narrow screens.
  - `InstructorDashboard` (`"use client"`, no props) calls `useInstructorDashboard()` and returns **exactly
    one** of these, checked in this order:
    1. `isPending` → `<DashboardSkeleton />`
    2. `isError && isNoInstructorProfileError(error)` → `<NoInstructorProfileState />`
    3. `isError` → `<DashboardError onRetry={() => refetch()} />`
    4. `data.mode === 'onboarding'` → `<OnboardingChecklist />`
    5. otherwise, a `div` with `max-w-6xl mx-auto flex flex-col gap-6` containing
       `<DashboardHeader name={data.instructor_name} />` followed by these three comment markers, in this
       order: `{/* SummaryTiles — T020 */}`, `{/* Recent activity — T032 */}`, `{/* NeedsAttentionList — T024 */}`.
  - Add a comment that this is the only place a query result is read, so the "never render a partial or
    misleading snapshot" rule can be reviewed here in one place.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T017 Export the module surface in `front-end/src/featuers/instructor-dashboard/index.ts` and render it from `front-end/src/app/instructor/page.tsx`
  - **Depends on**: T016.
  - `index.ts`: export `InstructorDashboard`, `useInstructorDashboard`, `instructorDashboardAPI`, the types
    from T011, and `attentionHref`.
  - `page.tsx`: replace the whole file with a default-export page that renders
    `<InstructorDashboard />` imported from `@/featuers/instructor-dashboard`. Keep the function name
    `InstructorDashboardPage`.
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass. *(Browser check by the user: `/instructor`
    shows the skeleton, then the header for an instructor with courses, or the old checklist for one without.
    With the backend stopped it shows the error with Retry.)*

**Checkpoint**: the endpoint returns a contract-shaped snapshot with stub values, `/instructor` goes through
all five states, and the existing behavior for a new instructor is kept.

---

## Phase 3: User Story 1 - See my business at a glance (Priority: P1) 🎯 MVP

**Goal**: four tiles with exact values: Courses (total + published), Students (distinct + enrollments), Avg
rating, and Earnings.

**Independent Test**: for an instructor with a known mix of courses, enrollments (including one multi-course
student, one refund, one free enrollment), reviews, and paid, pending and failed orders, every tile matches
the FR-004–FR-008 definitions (spec US1).

- [X] T018 [US1] Implement the four tile metrics in `backend/apps/course/dashboard/service.py`, replacing the stubs `_course_counts`, `_student_counts`, `_rating`, `_earnings`
  - **Read first**: research.md R6 (exact definitions); data-model.md §3; `get_instructor_rating` in
    `backend/apps/reviews/utils.py`.
  - `_course_counts(courses)`: `CourseCounts(total=len(courses), published=sum(1 for c in courses if c.is_published))`.
    No query.
  - `_student_counts(profile)`:
    `Enrollment.objects.filter(course__instructor=profile, is_active=True).aggregate(distinct=Count('user', distinct=True), enrollments=Count('id'))`.
  - `_rating(profile)`: call `get_instructor_rating(profile)` and map it to `Rating(avg_rating=None if r['avg_rating'] is None else float(r['avg_rating']), reviews_count=r['reviews_count'])`.
    **Don't copy its logic.** Add a comment that reusing it is what guarantees SC-003 (home and public
    profile never differ).
  - `_earnings(profile)`:
    `Order.objects.filter(course__instructor=profile, status='paid').aggregate(total=Sum('amount'))['total'] or Decimal('0')`.
  - Add a comment explaining why `InstructorProfile.students_count` / `Course.subscribers_count` are **not**
    used: they count enrollments, not people (R5).
  - **Done when**: the T019 tests pass.

- [X] T019 [US1] Add the US1 tile tests to `backend/apps/course/tests_dashboard.py` as `class TilesTests(DashboardTestCase)`
  - **Read first**: spec.md US1 acceptance scenarios 1–6; the contract's backend test checklist (tile items).
  - One test per bullet. Assert on the JSON response, not on the service:
    - 2 published + 1 draft → `courses == {'total': 3, 'published': 2}`.
    - Student enrolled in 2 of the instructor's courses → `students.distinct == 1`, `students.enrollments == 2`.
    - Refund: `enroll(..., status='refunded', active=False)` → excluded from `students` and `earnings`.
    - Free course: `enroll(..., amount='0.00')` → counted in `students`, `earnings.amount == '0.00'`.
    - A `pending` and a `failed` order (with `active=False` enrollments) → excluded from `earnings`.
    - Unpublished course with an active enrollment and a paid order → still counted in `students` and
      `earnings`.
    - `rating` matches `get_instructor_rating(profile)` for reviews on a published course, and a review on a
      **draft** doesn't change it.
    - No reviews → `rating == {'avg_rating': None, 'reviews_count': 0}`.
    - Earnings sum across courses: `'10.00' + '25.50'` → `'35.50'`.
  - **Done when**: `python manage.py test apps.course.tests_dashboard` passes.

- [X] T020 [US1] Create `front-end/src/featuers/instructor-dashboard/components/SummaryTiles.tsx` and render it in `InstructorDashboard.tsx` at the `SummaryTiles — T020` marker
  - **Depends on**: T018, T016.
  - **Read first**: spec.md FR-004–FR-008 and Clarifications (Students secondary line, rating "Not yet
    rated"); the wireframe Dashboard tiles row; `StarRating` in `front-end/src/components/atoms/StarRating.tsx`.
  - Props: `{ courses, students, rating, earnings }` typed from `DashboardSnapshot`.
  - Four tiles in `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`. Each tile is a `rounded-xl border
    border-darkbg bg-white p-5` card with a small uppercase label, a large value, and an optional secondary
    line:
    - **Courses**: value `courses.total`, secondary `"{published} published"`.
    - **Students**: value `students.distinct.toLocaleString('en-US')`, secondary
      `"{enrollments} enrollments"` (use "enrollment" when the count is 1).
    - **Avg rating**: when `avg_rating === null`, value "Not yet rated" (smaller text) and **no** stars and no
      secondary line. Otherwise the value `avg_rating.toFixed(1)` with `<StarRating rating={avg_rating} size={16} />`
      and secondary `"{reviews_count} reviews"`.
    - **Earnings**: value `formatMoney(earnings.amount, earnings.currency)` and secondary "Lifetime".
  - Long values mustn't overflow: add `truncate` to the value line and a `title` attribute with the full
    value.
  - **Done when**: `npx tsc --noEmit` passes. *(Browser check by the user: quickstart.md §3B.)*

**Checkpoint**: US1 works on its own, with backend tests passing and tiles rendered.

---

## Phase 4: User Story 2 - Know what needs my attention (Priority: P1)

**Goal**: a ranked list of at most 5 courses needing action, one entry per course, each linking to where to
act, plus the total count, "View all courses", and "All caught up".

**Independent Test**: set up one broken live course, one draft with a failed video, one ready draft, and one
unfinished draft (plus a processing-only draft). The list shows each once, in the Q2 order, with the correct
links, and the processing video is never flagged (spec US2).

- [X] T021 [P] [US2] Create the pure ranking module `backend/apps/course/dashboard/attention.py`
  - **Read first**: research.md R3 and R4; data-model.md §5 (flow + sort table) and §6 (targets);
    `backend/apps/course/publishing/dto.py` (`ReadinessReport`, blocker `code` and `target`).
  - `RANK = {'live_needs_attention': 1, 'video_failed': 2, 'ready_to_publish': 3, 'draft_in_progress': 4}`.
  - `classify(course, report: ReadinessReport, active_students: int) -> AttentionItem | None`, first match
    wins:
    1. `report.needs_attention` → `live_needs_attention`
    2. `course.is_published` → return `None` (healthy)
    3. any blocker with `code == 'lecture_video_failed'` → `video_failed`
    4. `report.is_publishable` → `ready_to_publish`
    5. else → `draft_in_progress`
  - Fill every item with:
    - `course=CourseRef(course.id, course.title)`, `is_published`, `blocker_count=len(report.blockers)`,
      `active_students`, `created_at=course.created_at`;
    - `failed_lecture_ids` = a tuple of `blocker.target['id']` for every `lecture_video_failed` blocker
      (for **all** types);
    - `target` = `AttentionTarget('lecture', course.id, failed_lecture_ids[0])` **only** when
      `type == 'video_failed' and len(failed_lecture_ids) == 1`, otherwise
      `AttentionTarget('course', course.id, None)`.
  - `rank(items) -> list[AttentionItem]`: sort by
    `(RANK[type], secondary, -created_at.timestamp(), -course.id)`, where `secondary` is `-active_students`
    for `live_needs_attention` and `video_failed`, `blocker_count` for `draft_in_progress`, and `0` for
    `ready_to_publish`.
  - **No imports from the ORM or `Course.objects`.** The module must work on plain objects. Comment that
    readiness is 007's verdict and must never be re-derived here (FR-014), and that `lecture_video_processing`
    is deliberately not matched (FR-016).
  - **Done when**: the T023 unit tests pass.

- [X] T022 [US2] Replace the `_needs_attention(courses)` stub in `backend/apps/course/dashboard/service.py`
  - **Depends on**: T021.
  - `readiness = PublishReadinessService()` (one instance). For each course:
    `item = classify(course, readiness.evaluate(course), course.active_students)`; collect the non-`None`
    items; `ranked = rank(items)`; return `NeedsAttention(total=len(ranked), items=tuple(ranked[:5]))`.
  - Comment that `evaluate()` reads only the relations `_load_courses` prefetched, so this loop adds **no
    queries** (R5).
  - **Done when**: the T023 API tests pass.

- [X] T023 [US2] Add the US2 tests to `backend/apps/course/tests_dashboard.py`: `class AttentionRankingUnitTests(SimpleTestCase)` and `class NeedsAttentionTests(DashboardTestCase)`
  - **Depends on**: T021, T022.
  - **Read first**: spec.md US2 scenarios 1–10; the contract checklist (needs-attention items);
    `make_ready_course` / `break_one` in `tests_publishing.py`.
  - **Unit tests** (no DB: build `ReadinessReport` / `ReadinessItem` and simple course stand-ins with
    `types.SimpleNamespace(id, title, is_published, created_at)`):
    - each of the 4 types is classified correctly;
    - a published publishable course → `None`;
    - a published course with a `lecture_video_failed` blocker → `live_needs_attention`, not `video_failed`;
    - a draft whose only blocker is `lecture_video_processing` → `draft_in_progress`;
    - ranking puts 800 students before 3 students (live), 1 blocker before 4 blockers (draft), and same-type
      ties newest first; two items with equal `created_at` are ordered by `-id`;
    - one failed lecture → lecture target; two → course target.
  - **API tests**:
    - a published course broken with `break_one(course, 'lecture_video_missing')` → first item
      `live_needs_attention` with `target.kind == 'course'`;
    - a healthy published course is absent;
    - a draft with one `FAILED` lecture → `video_failed` with the lecture target;
    - 7 draft courses → `total == 7` and `len(items) == 5`;
    - each `course.id` appears at most once;
    - no attention item ever has a type outside the 4.
  - **Done when**: `python manage.py test apps.course.tests_dashboard` passes.

- [X] T024 [US2] Create `front-end/src/featuers/instructor-dashboard/components/NeedsAttentionList.tsx` and render it in `InstructorDashboard.tsx` at the `NeedsAttentionList — T024` marker
  - **Depends on**: T011, T016.
  - **Read first**: spec.md FR-013–FR-019; data-model.md §6; the wireframe "Needs attention" card.
  - Props: `{ needsAttention: DashboardSnapshot['needs_attention'] }`.
  - A card titled "Needs attention". When `total > items.length`, show the subtitle
    `"Showing {items.length} of {total}"`.
  - Each item is a `Link` to `attentionHref(item)`, laid out as a row with:
    - a type badge (`ATTENTION_LABEL[item.type]`), with `live_needs_attention` and `video_failed` styled as
      warnings (`text-red-600 border-red-200 bg-red-50`) and the other two neutral (`border-darkbg
      text-graytext2`);
    - the course title (`truncate`);
    - a detail line: live → `"{blocker_count} issue(s) · {active_students} students affected"`; video_failed
      → `"{failed_lecture_ids.length} failed video(s)"`; ready → "Passes every publish check"; draft →
      `"{blocker_count} blocker(s) remaining"`;
    - a trailing `ChevronRight` icon.
  - Always show a footer `Link` "View all courses" → `/instructor/courses`.
  - When `total === 0`, render "All caught up" with a `CheckCircle2` icon and the text "Nothing needs your
    attention right now." **Don't hide the card** (FR-018).
  - **No reply, publish, or retry buttons.** Items are links only (FR-033).
  - **Done when**: `npx tsc --noEmit` passes. *(Browser check by the user: quickstart.md §3C.)*

**Checkpoint**: US2 works on its own. With US1, this is the P1 business core.

---

## Phase 5: User Story 5 - Nobody sees another instructor's business (Priority: P1)

**Goal**: the snapshot contains only the caller's own data, non-instructors are refused, a staff account with
no profile gets a handled state, and no contact details are ever returned.

**Independent Test**: as instructor A, nothing from B's courses appears. Students, anonymous callers, and
profile-less staff are refused as specified, checked against the backend directly (spec US5).

> The implementation is already in place from T005 (profile-only scoping), T007 (permissions and the
> no-profile 403), and T014/T016 (handled state). This phase **proves** it.

- [X] T025 [US5] Add `class AccessTests(DashboardTestCase)` to `backend/apps/course/tests_dashboard.py`
  - **Read first**: spec.md US5 scenarios 1–5; research.md R8; the contract Errors table.
  - Tests:
    - student (`make_student`) → 403;
    - unauthenticated (`self.client.get(DASHBOARD_URL)` without auth) → 401 or 403
      (`assertIn(status, (401, 403))`);
    - staff account with no profile (`CustomUser.objects.create_instructor(...)`, then **delete** its
      `InstructorProfile` if one was auto-created) → 403 and `response.data == {'error': ..., 'code': 'no_instructor_profile'}`;
    - isolation: instructors A and B each have a published course with an enrollment, a paid order, a review,
      and a broken draft. A's response has `courses.total == A's count`, `students.distinct == 1`,
      `earnings.amount == A's sum`, and no course id or title of B's anywhere (walk the JSON recursively).
    - the endpoint ignores query parameters: `?instructor=<B's profile id>` still returns A's data.
  - **Done when**: `python manage.py test apps.course.tests_dashboard` passes.

- [X] T026 [US5] Add `test_response_never_contains_email` to `AccessTests` in `backend/apps/course/tests_dashboard.py`
  - **Depends on**: T025, and T030 (recent lists) so student objects are actually present. If you do US5
    before US3, write the test now and re-run it after T030.
  - Write a recursive helper that collects every key at every depth of `response.data`. Assert `'email'` isn't
    among them, and that neither the student's nor the instructor's email **value** appears in
    `json.dumps(response.data)`.
  - **Done when**: the test passes with at least one recent enrollment and one recent review in the fixture.

**Checkpoint**: all P1 stories are done and proven.

---

## Phase 6: User Story 3 - See recent enrollments and reviews (Priority: P2)

**Goal**: two side-by-side lists, each with up to 5 of the newest entries, linked to their course, and with
empty states.

**Independent Test**: enrollments and reviews created at known times appear newest first, capped at 5, with
inactive enrollments and other instructors' data excluded (spec US3).

- [X] T027 [P] [US3] Create `front-end/src/featuers/instructor-dashboard/components/RecentEnrollments.tsx`
  - **Depends on**: T011.
  - **Read first**: spec.md FR-009, FR-011, FR-012, US3 scenarios 1, 4, 7; `front-end/src/components/atoms/avatar.tsx`.
  - Props: `{ enrollments: RecentEnrollment[] }`. A card titled "Recent enrollments".
  - Each row: `Avatar` with `AvatarImage src={student.avatar ?? undefined}` and `AvatarFallback`
    `{initials(student.name)}`; the student name (`truncate`); a `Link` with the course title to
    `/instructor/courses/{course.id}` (`truncate`, `text-graytext2`); `formatDate(enrolled_at)` aligned
    right.
  - Empty state: "No enrollments yet" and "Students who enroll in your courses will appear here."
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T028 [P] [US3] Create `front-end/src/featuers/instructor-dashboard/components/RecentReviews.tsx`
  - **Depends on**: T011.
  - **Read first**: spec.md FR-010, FR-011, US3 scenarios 2, 3, 5; the `StarRating` atom.
  - Props: `{ reviews: RecentReview[] }`. A card titled "Recent reviews".
  - Each row: `StarRating rating={rating} size={14}`; the reviewer name; a course `Link` to
    `/instructor/courses/{course.id}`; `formatDate(created_at)`; and, **only when `comment.trim() !== ''`**, a
    `<p className="line-clamp-2 break-words">` with the comment (the client-side truncation from R7).
  - **No reply, report, or delete actions** (FR-011).
  - Empty state: "No reviews yet" and "Reviews students leave on your courses will appear here."
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T029 [US3] Add `class RecentActivityTests(DashboardTestCase)` to `backend/apps/course/tests_dashboard.py` (write the tests before T030; they fail until T030 lands)
  - **Read first**: spec.md US3 scenarios 1–6; the contract Field rules for `recent_enrollments` /
    `recent_reviews`.
  - Tests:
    - 7 active enrollments → 5 returned, newest `enrolled_at` first (set times explicitly with
      `Enrollment.objects.filter(pk=...).update(enrolled_at=...)`, since the field is `auto_now_add`);
    - an inactive enrollment is excluded;
    - another instructor's enrollment is excluded;
    - entries have `student.name` from first + last name, falling back to `username` when both are blank, and
      `student.avatar` is `None` when there's no picture;
    - 6 reviews → 5, newest first (set `created_at` with `.update`);
    - a review on a **draft** course **is** included;
    - an empty `comment` is returned as `''`;
    - `course == {'id': ..., 'title': ...}` on both lists.
  - **Done when**: the tests exist and fail only on the stubbed values.

- [X] T030 [US3] Replace the `_recent_enrollments(profile)` and `_recent_reviews(profile)` stubs in `backend/apps/course/dashboard/service.py`
  - **Depends on**: T029.
  - **Read first**: research.md R5 rows 10–11 and R7; data-model.md §4 (`RecentEnrollment`, `RecentReview`).
  - `_recent_enrollments`:
    `Enrollment.objects.filter(course__instructor=profile, is_active=True).select_related('user', 'course').order_by('-enrolled_at', '-id')[:5]`,
    mapped to `RecentEnrollment(id, enrolled_at, _person_ref(e.user), CourseRef(e.course.id, e.course.title))`.
  - `_recent_reviews`:
    `Review.objects.filter(course__instructor=profile).select_related('user__user', 'course').order_by('-created_at', '-id')[:5]`,
    mapped to `RecentReview(id, rating, comment or '', created_at, _person_ref(r.user.user), CourseRef(...))`.
  - Comment that reviews on unpublished courses are included on purpose (spec Assumptions), unlike the
    rating tile.
  - **Done when**: the T029 tests pass.

- [X] T031 [US3] Re-run `test_response_never_contains_email` (T026) now that the recent lists are populated
  - **Done when**: `python manage.py test apps.course.tests_dashboard` passes with the recent-list fixtures
    included.

- [X] T032 [US3] Render the recent lists in `front-end/src/featuers/instructor-dashboard/components/InstructorDashboard.tsx` at the `Recent activity — T032` marker
  - **Depends on**: T027, T028.
  - Wrap them as `<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">` with `<RecentEnrollments enrollments={data.recent_enrollments} />`
    and `<RecentReviews reviews={data.recent_reviews} />`, in that order (FR-002, FR-003).
  - **Done when**: `npx tsc --noEmit` passes. *(Browser check by the user: quickstart.md §3D.)*

**Checkpoint**: US3 works on its own, and the full dashboard layout is complete.

---

## Phase 7: User Story 4 - A new instructor is guided to their first published course (Priority: P2)

**Goal**: an instructor with zero courses sees a five-step checklist with real step states. Creating a first
course switches the page to the full dashboard, and deleting every course switches it back.

**Independent Test**: a new instructor sees the checklist with no steps ticked. Setting title and about ticks
step 1. Creating a course shows the full dashboard, and deleting it shows the checklist again (spec US4).

- [X] T033 [US4] Add `class OnboardingTests(DashboardTestCase)` to `backend/apps/course/tests_dashboard.py` (tests first; they fail until T034)
  - **Read first**: spec.md US4 scenarios 1–6; data-model.md §4 `OnboardingProgress`.
  - Tests:
    - 0 courses → `mode == 'onboarding'` and all five flags `False`;
    - `title='Engineer'`, `about='Bio'` → `profile_complete True`; `title='  '` → `False`; `about=''` →
      `False`;
    - 1 empty draft → `mode == 'full'`, `has_course True`, `has_curriculum False`;
    - a section with one lecture → `has_curriculum True`; a lecture with `video_status='COMPLETED'` →
      `has_ready_video True`; a published course → `has_published_course True`;
    - create and then delete the only course → `mode == 'onboarding'`.
  - **Done when**: the tests exist and fail only on the stubbed flags.

- [X] T034 [US4] Replace the `_onboarding(profile, courses)` stub in `backend/apps/course/dashboard/service.py`
  - **Depends on**: T033.
  - `profile_complete = bool(profile.title.strip() and profile.about.strip())`,
    `has_course = bool(courses)`, `has_published_course = any(c.is_published for c in courses)`.
  - `has_curriculum = any(section.lectures.all() for c in courses for section in c.section_set.all())`.
  - `has_ready_video = any(lecture.video_status == 'COMPLETED' for c in courses for s in c.section_set.all() for lecture in s.lectures.all())`.
  - Read **only** through `.all()` on the prefetched relations, never `.filter()` or `.exists()`, which would
    bypass the prefetch. Add a comment saying so.
  - **Done when**: the T033 tests pass.

- [X] T035 [US4] Turn `front-end/src/featuers/instructor-dashboard/components/OnboardingChecklist.tsx` into the derived checklist
  - **Depends on**: T015, T011.
  - **Read first**: spec.md FR-020–FR-024 and US4; data-model.md §6 (onboarding links).
  - Props: `{ onboarding: DashboardSnapshot['onboarding'] }`.
  - Five steps, in order, each with an icon, title, and one-line description:

    | Step | Done flag | Links to |
    |------|-----------|----------|
    | Complete your instructor profile | `profile_complete` | `/instructor/settings` |
    | Create your first course | `has_course` | `/instructor/courses/new` |
    | Add curriculum | `has_curriculum` | `/instructor/courses/new` |
    | Upload a video | `has_ready_video` | `/instructor/courses/new` |
    | Publish | `has_published_course` | `/instructor/courses/new` |

  - A done step shows a `CheckCircle2` icon, `line-through text-graytext2` on the title, and an `sr-only`
    "Completed". A step that isn't done is a `Link` card with a `Circle` icon.
  - Keep the header ("Welcome to your instructor workspace" and its subtitle) and the primary CTA "Create your
    first course" → `/instructor/courses/new`.
  - Grid: `grid-cols-1 sm:grid-cols-2`.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T036 [US4] Pass the onboarding data in `front-end/src/featuers/instructor-dashboard/components/InstructorDashboard.tsx`
  - **Depends on**: T035.
  - Change branch 4 to `<OnboardingChecklist onboarding={data.onboarding} />`.
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass. *(Browser check by the user: quickstart.md
    §3A.)*

**Checkpoint**: every user story is implemented.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: the all-or-nothing and query-count guarantees (which need every section in place), the docs, and
the final gates.

- [X] T037 Add `class ResilienceAndPerformanceTests(DashboardTestCase)` to `backend/apps/course/tests_dashboard.py`
  - **Read first**: research.md R5 and R9; spec.md FR-027, FR-028, SC-009, SC-011.
  - Tests:
    - `@patch('apps.course.dashboard.service.PublishReadinessService.evaluate', side_effect=RuntimeError)` →
      500, `response.data == {'error': "We couldn't load your dashboard. Please try again."}`, and **none** of
      the snapshot keys present (FR-028).
    - Query-count bound: build an instructor with 1 fully populated course (sections, lectures, quiz, 2
      enrollments, 1 review), capture the count with `CaptureQueriesContext(connection)`, then add 9 more
      populated courses and assert the count is **identical**. Comment that this pins invariant I8.
  - **Done when**: `python manage.py test apps.course.tests_dashboard` passes.

- [X] T038 Run the regression suites from `backend/`: `python manage.py test apps.course.tests_dashboard apps.course.tests_publishing apps.course.tests_curriculum apps.course.tests_video apps.course.tests`
  - **Done when**: every suite passes. If `tests_publishing` fails, the dashboard has changed a readiness
    import or prefetch, so fix that rather than the publishing test.

- [X] T039 [P] Review every component in `front-end/src/featuers/instructor-dashboard/components/` for the 375px layout (FR-003, SC-012)
  - Check that:
    - every grid collapses to `grid-cols-1` at the base breakpoint;
    - every title, course name, and money value has `truncate` or `break-words`;
    - no `min-w-*` or fixed width exceeds the screen;
    - the header button wraps under the title.
  - Fix in place.
  - **Done when**: no fixed widths remain and the review is noted as done here.

- [X] T040 [P] Add a "Instructor dashboard (spec 008)" section to `specs/_conventions.md`, after the "Course Publishing (spec 007)" section
  - **Read first**: the existing 007 section in `specs/_conventions.md` (tone and length).
  - Bullets, each 1–3 lines:
    - **Snapshot endpoints are all-or-nothing:** build the full DTO, then serialize inside one `try`; never
      return a partial snapshot.
    - **Cross-course reads use an `APIView`** that takes only the session's profile and no ids.
    - **Denormalized counters** (`students_count`, `subscribers_count`) count enrollments, not people; use
      `COUNT(DISTINCT user)` for people.
    - **Roll-ups reuse readiness blocker codes** instead of re-querying (for example, failed videos come from
      `lecture_video_failed`).
    - **Pages that depend on many mutations** use `staleTime: 0, gcTime: 0, refetchOnMount: 'always'`
      instead of wiring invalidation into every hook.
    - **Response Zod parsing** turns a malformed payload into the error state.
  - **Done when**: the section exists and matches the style of the section before it.

- [X] T041 [P] Update `specs/_overview.md`
  - Under "Course Management (Complete)", add an **Instructor Dashboard (spec 008)** bullet summarizing: the
    tiles, the recent lists, the ranked needs attention built on 007 readiness, the onboarding checklist for
    zero courses, one read-only snapshot, and no migration.
  - In the Courses API table, add `| /instructor/dashboard/ | GET | Instructor dashboard snapshot (spec 008) |`.
  - In "What Seems Incomplete / Missing" §2 Instructor Dashboard, mark the dashboard page as done, leaving
    analytics for spec 009.
  - **Done when**: all three edits are made, and nothing unrelated in the file has changed.

- [X] T042 Run the frontend gates from `front-end/`: `npx tsc --noEmit` and `npm run lint`
  - **Done when**: both pass with no new errors or warnings in `featuers/instructor-dashboard/` or
    `app/instructor/page.tsx`.

- [ ] T043 Manual verification in the browser, **by the user**, following `specs/008-instructor-dashboard/quickstart.md` §3 A–F
  - An LLM implementer must **stop here and ask the user** to run it (project rule: browser testing is done
    by the user), then fix anything the user reports.
  - **Done when**: the user confirms sections A–F pass.

---

## Dependencies

### Phase order

```text
Phase 1 Setup (T001–T003)
        │
Phase 2 Foundational (T004–T017)                  ← blocks everything
        │
        ├── Phase 3 US1 (T018, T019, T020)
        ├── Phase 4 US2 (T021–T024)
        ├── Phase 5 US5 (T025, T026)            ← T026 fully meaningful after T030
        ├── Phase 6 US3 (T027–T032)
        └── Phase 7 US4 (T033–T036)
                │
Phase 8 Polish (T037–T043)                        ← needs all stories (query-count test, docs)
```

After Phase 2, the user stories **don't depend on each other**. Each one replaces its own service stub, adds
its own test class, and fills its own marker in `InstructorDashboard.tsx`. The only cross-story link is T026
(no email), which becomes meaningful once US3 populates student objects.

### Task-level dependencies

| Task | Depends on |
|------|-----------|
| T004 | T002 |
| T005 | T004 |
| T006 | T005 |
| T007 | T006, T001 |
| T008 | T007 |
| T009 | T008 |
| T011 | T010 |
| T012 | T010, T011 |
| T013 | T012 |
| T014 | T003 |
| T015 | T003 |
| T016 | T013, T014, T015 |
| T017 | T016 |
| T018 | T005 |
| T019 | T009, T018 |
| T020 | T018, T017 |
| T021 | T004 |
| T022 | T021, T005 |
| T023 | T009, T022 |
| T024 | T017 |
| T025 | T009 |
| T026 | T025 (re-run after T030) |
| T027, T028 | T011 |
| T029 | T009 |
| T030 | T029 |
| T031 | T026, T030 |
| T032 | T017, T027, T028 |
| T033 | T009 |
| T034 | T033 |
| T035 | T015, T011 |
| T036 | T035, T017 |
| T037 | T022, T030, T034 |
| T038 | T037 |
| T039–T042 | all story phases |
| T043 | T038, T042 |

### Shared-file warning (do these in ID order, never in parallel)

| File | Tasks that edit it |
|------|--------------------|
| `backend/apps/course/dashboard/service.py` | T005 → T018 → T022 → T030 → T034 |
| `backend/apps/course/tests_dashboard.py` | T009 → T019 → T023 → T025 → T026 → T029 → T033 → T037 |
| `front-end/.../components/InstructorDashboard.tsx` | T016 → T020 → T024 → T032 → T036 |
| `front-end/.../components/OnboardingChecklist.tsx` | T015 → T035 |

---

## Parallel Opportunities

- **Phase 1**: T001, T002, T003 all at once.
- **Phase 2**: the backend chain (T004 → T009) and the frontend chain (T010 → T017) can run **at the same
  time** by two people, because they share no files. Within the frontend, T014 and T015 run in parallel with
  T010–T013.
- **After Phase 2**: one person can take the backend of every story (service + tests, in shared-file order)
  while another takes the frontend components (T020, T024, T027, T028, T035), which are separate files. Only
  the one-line render edits in `InstructorDashboard.tsx` need to go in order.
- **Phase 6**: T027 and T028 in parallel.
- **Phase 8**: T039, T040, T041 in parallel.

### Suggested split (human + LLM)

These are examples of good handoff boundaries, not a requirement:

| Chunk | Tasks | Why it hands off cleanly |
|-------|-------|--------------------------|
| Backend core | T001, T002, T004–T009 | Self-contained; smoke test proves it |
| Metrics + tests | T018, T019 | Pure ORM aggregates with explicit definitions |
| Ranking logic | T021–T023 | A pure function with a unit-test spec; good to own and reason about |
| Frontend foundation | T003, T010–T017 | Follows existing module patterns closely |
| UI components | T020, T024, T027, T028, T035 | Independent files with props already defined |
| Remaining stories | T025, T026, T029–T034, T036 | Test-first, small service methods |
| Wrap-up | T037–T042, then the user runs T043 | Needs everything in place |

---

## Implementation Strategy

### MVP (P1 business core)

1. Phase 1 and Phase 2. **Stop and validate**: the endpoint returns the shape, and `/instructor` goes through
   its states.
2. Phase 3 (US1): the tiles are correct.
3. Phase 4 (US2): needs attention is ranked.
4. Phase 5 (US5): access is proven.
5. **Stop and validate**: run the backend tests. The user checks quickstart §3B, §3C and §3E. This is a
   shippable P1 dashboard. New instructors still see the preserved static checklist from T015, so nothing
   regresses.

### Incremental delivery

6. Phase 6 (US3) adds recent activity, and T031 confirms the no-email test with real student data.
7. Phase 7 (US4) turns the static checklist into derived step states.
8. Phase 8: resilience and query-count tests, docs, gates, then the user runs the browser walkthrough.

### Rules of thumb for whoever implements

- **Readiness is 007's.** If you're about to check `video_status` or count lectures to decide attention
  state, stop and use the `ReadinessReport` (FR-014). The **only** place that reads `video_status` directly
  is onboarding's `has_ready_video` (T034), because that flag is about progress, not readiness.
- **Never add a parameter to the endpoint.** Scope comes from `request.user.instructor_profile` only.
- **Never render a value you didn't receive.** If data is missing, that's the error state, not `0`.
- **Don't edit any hook from 004–007** to "refresh the dashboard". Freshness comes from T013's query options.
