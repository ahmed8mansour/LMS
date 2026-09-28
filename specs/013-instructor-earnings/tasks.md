# Tasks: Instructor Earnings

**Input**: Design documents from `/specs/013-instructor-earnings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/instructor-earnings.md, quickstart.md

**Tests**: Backend tests are **included and not optional**. Constitution IV requires unit tests for services,
and this feature's rules fail *silently* without them — a refund attributed to the wrong date still returns a
number, a free enrolment counted as a sale still returns a number, a float instead of a decimal string still
renders, and a null-dated order dropped from all-time totals still shows a page that looks right. Nothing
raises in any of those cases; only an assertion catches them. Frontend component tests are optional
(Constitution IV "SHOULD") and are not included; the gates are `tsc --noEmit`, lint, and the quickstart pass.

**Organization**: grouped by user story, in priority order — US1 → US2 → US4 → US5 → US3.

- **The four P1 stories come first**; US3 (the trend chart, P2) is last and can be cut from a first release
  without touching anything above it.
- **The endpoint itself is Phase 2 Foundational.** One snapshot serves all five stories (owner answer P2),
  so the view cannot be built a story at a time. Phase 2 builds it end to end, and each story phase adds the
  tests that **prove its own slice** plus its UI. Same shape 009, 010 and 012 used.
- **The three shared component extractions are also Phase 2**, because they block the UI of three separate
  stories and are pure refactors with no behaviour of their own.
- Each story phase stays independently verifiable: stop at any checkpoint and everything above it works.

**One data migration, and it is gated.** T006 writes to payment rows and must not be run before the owner
says yes (research R4). Everything else in this feature is a read. If you find yourself writing a *schema*
migration or running `npm install`, stop and re-read plan.md Technical Context — Recharts, the shadcn
`Table` atoms and `skeleton` are already vendored.

---

## Tags

Every task carries exactly one ownership tag:

| Tag | Meaning | Rule |
|-----|---------|------|
| **[ME]** | Do this yourself (or review it line by line) | Invariants, security, money, or the **first instance** of a pattern in this feature |
| **[AI]** | Safe to delegate to an LLM | Repetition of a pattern already established by a `[ME]` task, and wiring |

An `[AI]` task always names the `[ME]` task (or the existing file) whose pattern it repeats. If an `[AI]`
task turns out to need a new decision, stop and promote it to `[ME]`.

**Count**: 21 `[ME]`, 15 `[AI]` across 36 tasks. The `[ME]` weight sits in Phase 2 and in the backend test
classes, because every invariant in this feature — what counts as a sale, which date a refund lands on, the
identity between the rows and the tiles — lives in the service and is held there only by assertions.

## How to use this file (humans and LLMs)

Each task is meant to be picked up **on its own**, without the conversation that produced it.

- **First line**: what to do, and in which file.
- **What**: what this task accomplishes, in one or two sentences.
- **Read first**: the exact documents or sections holding the details.
- **Pattern**: for `[AI]` tasks — the existing file or earlier task to copy.
- **Done when**: the acceptance check. The task is incomplete until every bullet holds.
- **`[P]`**: touches a different file from the other open tasks in its phase and has no unfinished
  dependency, so it can run alongside other `[P]` tasks.
- Mark a task `[X]` when it is finished.
- **Work tasks that share a file in ID order**, one at a time. Shared files are
  `apps/enrollment/views.py`, `apps/enrollment/tests_earnings.py`, `InstructorEarnings.tsx` and `index.ts`.

Terms used throughout:

- **counted sale**: an order for one of the caller's courses with `status in ('paid','refunded')`,
  `amount > 0` and a non-null `created_at` (data-model §2). The single most important definition here.
- **window**: the date range the selected period resolves to, in UTC.
- **bucket**: one bar of the trend — a day (`month`) or a calendar month (`year`, `all`).
- **profile**: the signed-in user's `InstructorProfile`. The endpoint's only scope input.
- **net**: `Σ amount where status='paid'`. Also the value of every `revenue` field on the page.

## Path Conventions

- **Backend**:
  - New: `backend/apps/enrollment/earnings/{__init__,periods,service,dto}.py`,
    `backend/apps/enrollment/tests_earnings.py`, one migration under
    `backend/apps/enrollment/migrations/`.
  - Edited: `backend/apps/enrollment/{views,urls}.py`, `backend/config/settings.py`.
  - **`models.py` is not edited, and there is no schema migration** — T006 is a *data* migration.
- **Frontend**:
  - New module: `front-end/src/featuers/instructor-earnings/`. Keep the house spelling `featuers`; schema
    files end in `.schma.ts`.
  - New shared: `front-end/src/components/molecules/{StatTile,ChartCard,ChipToggle}.tsx`.
  - Page (currently `ComingSoon`): `front-end/src/app/instructor/earnings/page.tsx`.
- **Run backend tests with a module label**: `python manage.py test apps.enrollment.tests_earnings` from
  `backend/` with the venv active. A bare `apps.enrollment` label **does not resolve** — there is no
  `__init__.py` under `backend/apps/`, and the bare label dies inside `unittest` discovery with a
  `TypeError` rather than a useful message. On Windows use `env/Scripts/python.exe manage.py …`; a bare
  `python` is the Microsoft Store shim.
- **`apps/enrollment/tests.py` is an empty stub** (`# Create your tests here.`). Leave it alone; this
  feature's tests live in their own module.
- **`Order.created_at` is `auto_now_add`**, so it ignores any value passed to `create()` *and* `save()`.
  Every fixture date in this feature must be written with
  `Order.objects.filter(pk=…).update(created_at=…)`. A test helper that forgets this makes every period
  assertion in the module vacuous — they all silently land in "today".
- **Zod is v4**; **Next.js 16** (`useSearchParams` must sit under `<Suspense>`).

---

## Phase 1: Setup

**Purpose**: the two things every later task assumes exist.

- [X] T001 [P] [AI] Add the `instructor_earnings` throttle scope in `backend/config/settings.py`
  - **What**: registers the rate this feature's view names, so the view doesn't 500 on an unknown scope.
  - **Pattern**: the `'instructor_reviews': '60/min'` line already in `DEFAULT_THROTTLE_RATES`.
  - Add `'instructor_earnings': '60/min'` beside it. 60, matching the dashboard, analytics and reviews:
    this read is driven by three chips, not a debounced search box like the roster's 120.
  - **Done when**: `python manage.py check` passes and the key is present in the rates dict.

- [X] T002 [AI] Create `backend/apps/enrollment/tests_earnings.py` with shared fixtures
  - **What**: the module every later backend task adds classes to, with the one helper this feature cannot
    do without — an order placed on a date you choose.
  - **Pattern**: the top of `backend/apps/course/tests_dashboard.py` — imports, the `APITestCase` subclass,
    the `url()`/`get()` helpers.
  - **Read first**: quickstart.md Prerequisites (the fixture shape), data-model.md §2.
  - Module docstring: `"""013 — Instructor earnings. Period unit tests first, then API tests grouped by user story."""`
  - Import and reuse — **do not redefine**: `make_instructor`, `make_course` from `apps.course.tests`;
    `make_student` from `apps.course.tests_dashboard`.
  - Add `sell(user, course, amount='50.00', status='paid', when=None)`:
    creates the `Order` (and, for `paid`/`refunded`, the matching `Enrollment`, so T006's backfill has
    something to read), then — **always** — applies the date with
    `Order.objects.filter(pk=order.pk).update(created_at=when or timezone.now())`.
    Comment at that line that `auto_now_add` ignores `create(created_at=…)`, which is exactly why this
    helper exists and why no test may build an `Order` directly.
  - Add `EarningsTestCase(APITestCase)` with `url(period=None)` (builds `reverse('instructor_earnings')`
    with the parameter only when given) and `get(user, url)` (`force_authenticate`, then `GET`).
  - Add a placeholder `class SetupTests(SimpleTestCase)` asserting the imported helpers are callable, so the
    module runs green before the endpoint exists.
  - **Done when**: `python manage.py test apps.enrollment.tests_earnings` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the endpoint end to end, the three shared components, and the frontend plumbing every story
renders from.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Backend

- [X] T003 [P] [ME] Create `backend/apps/enrollment/earnings/periods.py`
  - **What**: all the calendar maths, pure — no ORM import in this file.
  - **Read first**: research.md R5; data-model.md §2 (Period, Bucket); contracts §1.
  - **Pattern to copy in shape, not in content**: `backend/apps/course/analytics/periods.py`.
  - `class Period(str, Enum)`: `MONTH = 'month'`, `YEAR = 'year'`, `ALL = 'all'`. `class InvalidPeriod(ValueError)`.
  - `parse_period(raw)` → `MONTH` for `None`/`''`, the member for a known value, raise `InvalidPeriod`
    otherwise. Strict on purpose: the *client* falls back silently, the API never guesses (R8).
  - `window_for(period, today, earliest_sale)` → `Window(start, end)` where `end` is always `today`,
    `start` is the 1st of `today`'s month / 1 January of `today`'s year / `earliest_sale` (which may be
    `None`).
  - `build_buckets(period, window, amounts_by_date)` → every bucket in the window, **including the empty
    ones**, each with a `Decimal` amount: one per day for `MONTH`, one per calendar month for `YEAR` and
    `ALL`. Take a `{date: Decimal}` mapping produced by the database, not a row list — the grouping is
    SQL's job, gap-filling is this function's (R6).
  - **Do not import `apps.course.analytics.periods`.** Its `Period` is `30 | 90 | all` — rolling day spans,
    a different concept wearing the same word. Comment that here so the next reader doesn't "de-duplicate"
    the two into one branching module (R5).
  - Every date is a UTC calendar date; `settings.TIME_ZONE` is `'UTC'`, so `timezone.now().date()` is
    already one.
  - **Done when**: `python manage.py check` passes. (Behaviour is proven by T009.)

- [X] T004 [P] [ME] Create `backend/apps/enrollment/earnings/dto.py`
  - **What**: the wire format, and the one place money becomes a string.
  - **Read first**: contracts §"200 — the snapshot"; data-model.md §3.
  - **Pattern**: `backend/apps/course/analytics/dto.py` (frozen dataclasses + `to_dict()`), and
    `apps/course/dashboard/dto.py` for the money formatting line.
  - `EarningsSnapshot` (frozen) carrying `period`, `window`, `currency`, `stats`, `trend`, `courses`,
    `courses_count`, `has_sales_ever`, plus `EarningsStats`, `TrendBucket`, `CourseEarnings`.
  - `to_dict()` emits every money value through one helper —
    `f"{value.quantize(Decimal('0.01'))}"` — so `total_revenue`, `refunds`, `net`, every
    `trend[].amount` and every `courses[].revenue` are **strings with exactly two decimals**. A
    `float()` anywhere in this file is the bug this feature is most likely to ship: it renders fine and
    stops adding up somewhere past the fourth row (P3).
  - Dates go out as `date.isoformat()`, with `window.start` allowed to be `null`.
  - **Done when**: `python manage.py check` passes, and no `float(` appears in the file.

- [X] T005 [ME] Create `backend/apps/enrollment/earnings/service.py`
  - **What**: `InstructorEarningsService.build(profile, period) -> EarningsSnapshot` — the whole computation,
    in four queries.
  - **Read first**: research.md R1, R2, R3, R6; data-model.md §2; contracts §"Guaranteed relationships".
  - **Pattern**: `backend/apps/course/analytics/service.py` — a service that takes an already-scoped input,
    returns a DTO, and serializes nothing.
  - **The base queryset is the only ownership boundary and is written once**:
    ```
    Order.objects.filter(
        course__instructor=profile,
        status__in=('paid', 'refunded'),
        amount__gt=0,
        created_at__isnull=False,
    )
    ```
    Comment each of the four clauses with the requirement it implements (FR-031, FR-008, FR-008a, FR-041).
    `amount__gt=0` — **not** `payment_gateway != 'free'`: the amount is what decides whether money moved.
  - **Query 1 — per course, and the stats come from it.**
    `.values('course_id', 'course__title').annotate(sales=Count('id'), gross=Sum('amount'),
    refunds=Sum('amount', filter=Q(status='refunded')))`, then in Python
    `net = gross - refunds` per row and the four `stats` values as sums over the rows.
    **Do not add a fifth aggregate for stats.** FR-027 requires the table's columns to add up to the tiles;
    summing the rows makes that an identity instead of two filters that must stay in step forever (R6).
    Comment that at the line.
  - **Query 2 — the trend.** `.annotate(bucket=TruncDay('created_at'))` for `MONTH`,
    `TruncMonth` otherwise, `.values('bucket').annotate(net=Sum('amount', filter=Q(status='paid')))`,
    into a `{date: Decimal}` map, then `build_buckets` fills the gaps. The trend is **net**, so its
    bars sum to the Net tile (FR-016).
  - **Query 3** `Course.objects.filter(instructor=profile).count()` → `courses_count`.
  - **Query 4** base queryset **without** the window `.exists()` → `has_sales_ever`; **skip it entirely**
    when `period is Period.ALL`, where the answer is `stats.sales > 0`.
  - `Sum` returns `None` for an empty set — coerce to `Decimal('0')` at every one of the five places, not
    just the obvious two.
  - The window is applied with `created_at__gte=<start of window, as an aware UTC datetime>`; `ALL` applies
    no lower bound. `window.start` for `ALL` is the earliest bucket's date, taken from query 2's result —
    **not** a fifth `Min()` query.
  - **Done when**: `python manage.py check` passes; the file contains no `Transaction` import (R3) and no
    `float`.

- [X] T006 [ME] ⚠️ **GATED** — data migration backfilling `Order.created_at` in `backend/apps/enrollment/migrations/`
  - **What**: fills the null `created_at` left by migration `0011` (added 2026-07-07 with `null=True`), so
    that all-time net matches the dashboard tile and the trend can place every counted sale.
  - **DO NOT RUN THIS WITHOUT THE OWNER'S EXPLICIT YES.** It writes to payment rows. The decision, the
    reasoning and the fallback are research.md R4.
  - **Read first**: research.md R4; data-model.md §5.
  - **Measure first**: `Order.objects.filter(created_at__isnull=True).count()`. If it is `0` here *and* in
    production, the migration is a no-op and the gate is cheap to pass.
  - `migrations.RunPython(forward, migrations.RunPython.noop)`, created with
    `python manage.py makemigrations enrollment --empty --name backfill_order_created_at` — a **new** file;
    never edit `0011` (project hard rule).
  - Forward: for each `Order` with `created_at IS NULL` that has an `Enrollment`, set `created_at` to that
    enrolment's `enrolled_at` (non-null, `auto_now_add`, written by `FulfillmentFacade` within seconds of
    the purchase). Use `apps.get_model`, iterate in batches with `bulk_update`, and touch nothing else —
    no amount, no status, no relation. Orders with no enrolment are `pending`/`failed` and stay null.
  - Reverse is a documented no-op: the previous state was "unknown" and cannot be restored.
  - **Done when**: the migration applies; `Order.objects.filter(created_at__isnull=True, enrollment__isnull=False).count() == 0`;
    T007's dashboard-parity test (T020) passes.

- [X] T007 [ME] Add `InstructorEarningsView` to `backend/apps/enrollment/views.py`
  - **What**: the endpoint — auth, the profile, the period, the service, one error.
  - **Read first**: contracts §"Auth", §"Errors"; research.md R8.
  - **Pattern**: `InstructorAnalyticsView` in `backend/apps/course/views.py` — copy its structure exactly.
  - `APIView`, not a viewset: the snapshot spans every owned course, so there is no row for `get_object()`
    to scope. `authentication_classes = [CookieJWTAuthentication]`,
    `permission_classes = [IsAuthenticated, isInstructor]`, `throttle_scope = 'instructor_earnings'`.
  - `request.user.instructor_profile` inside `try/except InstructorProfile.DoesNotExist` → **403** with
    `{'error': …, 'code': 'no_instructor_profile'}` (FR-034).
  - `parse_period(request.query_params.get('period'))` inside `try/except InvalidPeriod` → **400** with
    `{'error': 'period must be one of month, year, all.', 'code': 'invalid_period'}`.
  - **This view reads no id from the client.** Comment that: the only input is `?period=`, which is why
    this endpoint has no ownership check to get wrong and no 404 branch at all (P5b).
  - Build **and** serialize inside one `try` → on any exception, `logger.exception(...)` and return
    **500** `{'error': "We couldn't load your earnings. Please try again."}`. Never a partial snapshot,
    never the exception text.
  - **Done when**: `python manage.py check` passes.

- [X] T008 [AI] Register the route in `backend/apps/enrollment/urls.py`
  - **What**: `GET /enrollment/instructor/earnings/`.
  - **Pattern**: the `instructor/reviews/` line in `backend/apps/reviews/urls.py`.
  - `path('instructor/earnings/', InstructorEarningsView.as_view(), name='instructor_earnings')`, added to
    `urlpatterns` beside the student billing paths. A plain `path()`, not the router — this is an `APIView`.
  - Comment why it lives in `enrollment/` and not `courses/instructor/`: orders live here, the student
    money reads are already here, and 012 set the precedent (research P1).
  - **Done when**: `reverse('instructor_earnings')` resolves and an unauthenticated `GET` returns 401.

- [X] T009 [P] [AI] Add `PeriodTests` to `backend/apps/enrollment/tests_earnings.py`
  - **What**: unit tests for T003, with no database and no HTTP.
  - **Pattern**: the pure-function test classes at the top of `apps/course/tests_analytics.py`.
  - **Read first**: data-model.md §2 (Period, Bucket).
  - `SimpleTestCase`, with a fixed `today` passed in rather than the real clock:
    - `parse_period`: `None`, `''` → `MONTH`; each known value; `'week'` and `'30'` → `InvalidPeriod`.
    - `window_for`: the 1st of the month; 1 January; `ALL` with and without an earliest sale.
    - `build_buckets`: a 31-day month yields 31 buckets when only 2 have money, and **every** empty one is
      present; `YEAR` in September yields 9 monthly buckets; `ALL` from a past year yields a contiguous
      monthly run with no gap; `ALL` with no sales yields `[]`.
    - a bucket run has no overlap and no gap (assert each bucket's `start` is the day after the previous
      `end`).
  - **Done when**: the class passes.

### Frontend — shared components

- [X] T010 [P] [ME] Create `front-end/src/components/molecules/StatTile.tsx`
  - **What**: the one tile the dashboard, analytics and earnings all render — extracted, not copied.
  - **Read first**: research.md P4, R11.
  - Move the `Tile` function **verbatim** out of
    `featuers/instructor-dashboard/components/SummaryTiles.tsx`: same markup, same classes, same
    `truncate` + `title` tooltip, same 9×9 icon chip. Props `{label, icon: LucideIcon, title, value:
    ReactNode, secondary?: ReactNode}` — exactly what both existing copies already take.
  - Not a single class name changes in this task. If the rendered tile shifts by a pixel, the move was not
    verbatim and the migrations in T011/T012 will show it.
  - **Done when**: `tsc --noEmit` passes.

- [X] T011 [P] [AI] Point `featuers/instructor-dashboard/components/SummaryTiles.tsx` at `StatTile`
  - **Pattern**: T010 — delete the local `Tile`, import the shared one, change nothing else.
  - **Done when**: `npm run lint && npx tsc --noEmit` pass and `/instructor` looks identical.

- [X] T012 [P] [AI] Point `featuers/instructor-analytics/components/AnalyticsTiles.tsx` at `StatTile`
  - **Pattern**: T011. The local `Empty` helper stays — it is analytics-specific.
  - **Done when**: lint + types pass and `/instructor/analytics` looks identical.

- [X] T013 [P] [ME] Move `ChartCard` to `front-end/src/components/molecules/ChartCard.tsx`
  - **What**: earnings needs the chart frame analytics already has, and cannot reach it — `ChartCard` is
    **not** exported from `featuers/instructor-analytics/index.ts`, and a deep import across feature modules
    is against the house convention.
  - Move the file verbatim, delete `featuers/instructor-analytics/components/ChartCard.tsx`, and update the
    two imports inside that feature (`InstructorAnalytics.tsx`, `CourseAnalytics.tsx`).
  - **Done when**: lint + types pass and both analytics views render unchanged.

- [X] T014 [P] [ME] Create `front-end/src/components/molecules/ChipToggle.tsx` and migrate `PeriodSelector`
  - **What**: the chip row is the same markup for analytics' periods and earnings' periods, differing only
    in its option set and value type.
  - Generic over the value: `<T extends string>({options: {value: T; label: string}[], value, onChange,
    label})`, rendering the existing `role="group"` + `aria-pressed` buttons with the same classes as
    `featuers/instructor-analytics/components/PeriodSelector.tsx` today.
  - Then rewrite that `PeriodSelector` as a thin wrapper passing `PERIOD_OPTIONS` to `ChipToggle`. **Keep
    its name and its export from the analytics `index.ts`** — 009's public surface does not change.
  - `aria-pressed` and the group label are not decoration: they are how the selected chip is announced
    (FR-015, FR-020).
  - **Done when**: lint + types pass, analytics' chips behave identically, and `ChipToggle` has no import
    from any feature module.

### Frontend — module plumbing

- [X] T015 [P] [AI] Create `featuers/instructor-earnings/types/instructorEarnings.types.ts`
  - **Pattern**: `featuers/instructor-analytics/types/instructorAnalytics.types.ts`.
  - **Read first**: contracts §"Fields".
  - Types for `EarningsSnapshot`, `EarningsStats`, `TrendBucket`, `CourseEarnings`, `EarningsWindow`,
    `PeriodParam = 'month' | 'year' | 'all'`.
  - **Every money field is `string`, never `number`.** A `number` here is the one type error that would
    compile and then quietly round (P3).
  - Plus: `PERIOD_OPTIONS` (the three `{value,label}` pairs, labels "This month" / "This year" / "All
    time"), `normalizePeriod(raw): PeriodParam` (unknown → `'month'`), `periodLabel(p)`,
    `formatMoney(amount: string, currency)` — re-export the dashboard's implementation rather than
    rewriting it — and `formatBucketLabel(bucket, period)` ported from the analytics types.
  - **Done when**: `tsc --noEmit` passes.

- [X] T016 [P] [ME] Create `featuers/instructor-earnings/schemas/instructorEarnings.schma.ts`
  - **What**: the runtime gate. A body that doesn't match the contract must throw in the API function and
    become the page's error state — never render as `$NaN` or a silently empty chart.
  - **Pattern**: `featuers/instructor-analytics/schemas/instructorAnalytics.schma.ts`.
  - **Read first**: contracts §"Fields", §"Money format".
  - Define `const money = z.string().regex(/^\d+\.\d{2}$/)` and use it for all five money fields. The regex
    is the point: it rejects a float, a bare integer and a negative in one line, which is three of this
    feature's invariants enforced at the boundary (FR-011a, FR-012, SC-013).
  - `EarningsSnapshotSchema` per the contract, with `window.start` nullable and `trend` / `courses` as
    arrays that may be empty.
  - **Done when**: `tsc --noEmit` passes.

- [X] T017 [AI] Create `featuers/instructor-earnings/api/instructorEarnings.api.ts`
  - **Pattern**: `featuers/instructor-reviews/api/instructorReviews.api.ts`.
  - `getEarnings({period})` → `axiosInstance.get('/enrollment/instructor/earnings/', {params})`, then
    `EarningsSnapshotSchema.parse(data)`. Send `period` **only when it is not `'month'`**, so the server
    applies its own default (the 012 rule).
  - Export as `instructorEarningsAPI`.
  - **Done when**: `tsc --noEmit` passes.

- [X] T018 [AI] Create `featuers/instructor-earnings/hooks/useInstructorEarnings.tsx`
  - **Pattern**: `featuers/instructor-reviews/hooks/useInstructorReviews.tsx` — copy its cache rules and its
    comment block.
  - `queryKey: ['instructor','earnings',{period}]`, `staleTime: 0`, `gcTime: 0`,
    `refetchOnMount: 'always'`, no retry on 403.
  - **No `placeholderData: keepPreviousData`.** It is the obvious optimisation for a chip switch and it is
    forbidden: FR-039 says a period change must not show the previous period's figures as the new result.
    Carry that comment across verbatim so the next reader doesn't "fix" it.
  - **Done when**: `tsc --noEmit` passes.

- [X] T019 [ME] Create `featuers/instructor-earnings/hooks/useEarningsPeriod.tsx`
  - **What**: the period lives in the page address (FR-015c).
  - **Pattern**: `featuers/instructor-analytics/hooks/usePeriodParam.tsx`, with `days` → `period` and the
    fallback `'30'` → `'month'`.
  - `router.replace`, not `push` — three chip clicks must not leave three history entries, while Back still
    returns to the previous page with its period intact.
  - An unrecognised value normalises to `'month'` silently; the API is the strict one (R8).
  - **Done when**: `tsc --noEmit` passes.

- [X] T020 [AI] Create `featuers/instructor-earnings/components/EarningsStates.tsx`
  - **What**: the skeleton, the error, and the **three** distinct empty states.
  - **Pattern**: `featuers/instructor-analytics/components/{AnalyticsSkeleton,AnalyticsError}.tsx` and the
    local `NoCourses` in `InstructorAnalytics.tsx`.
  - **Read first**: data-model.md §4; spec FR-036 – FR-040.
  - Export `EarningsSkeleton` (three tile blocks + a chart block + a table block, holding the real
    layout), `EarningsError` (plain message + retry, no technical text), and three separate components:
    `NoCourses` (→ "Create your first course", links `/instructor/courses/new`), `NoEarningsYet`
    ("earnings appear once students enrol") and `NothingInPeriod` (**names the period** and leaves the
    chips usable).
  - The three empties must read differently. Identical copy with a different heading is the failure mode
    SC-009 exists to catch.
  - Re-export `NoInstructorProfileState` handling from `@/featuers/instructor-dashboard` rather than writing
    a fourth state.
  - **Done when**: `tsc --noEmit` passes.

- [X] T021 [ME] Create `featuers/instructor-earnings/components/InstructorEarnings.tsx`
  - **What**: the orchestrator — header, chips, and the state ladder.
  - **Pattern**: `featuers/instructor-analytics/components/InstructorAnalytics.tsx`.
  - **Read first**: data-model.md §4 (the ladder, in order).
  - Branch in exactly this order — the order *is* the requirement:
    `isNoInstructorProfileError` → `isPending` → `isError || !data` → `courses_count === 0` →
    `has_sales_ever === false` → `stats.sales === 0` → the page.
  - **A fully-refunded period is not an empty state.** It reaches the last branch with `stats.sales > 0`
    and renders real figures with a `$0.00` net (FR-037). Comment that at the `stats.sales === 0` line,
    because collapsing the two is the obvious simplification and it is wrong.
  - Header: title "Earnings", subtitle naming the scope ("Across all your courses"), `ChipToggle` on the
    right, and the UTC note (FR-015a).
  - Render the tiles, then the chart inside `ChartCard`, then the table. Components arrive in T026, T029
    and T034 — stub them with `null` until then so this task can land first.
  - **Done when**: `tsc --noEmit` passes.

- [X] T022 [AI] Create `featuers/instructor-earnings/index.ts`
  - **Pattern**: `featuers/instructor-reviews/index.ts`.
  - Export the API object, the types and helpers, both hooks, `InstructorEarnings` and `EarningsSkeleton`.
    Nothing outside the module may import a deep path.
  - **Done when**: `tsc --noEmit` passes.

- [X] T023 [AI] Rewrite `front-end/src/app/instructor/earnings/page.tsx`
  - **Pattern**: `front-end/src/app/instructor/reviews/page.tsx`.
  - Replace `ComingSoon` with `<Suspense fallback={<EarningsSkeleton/>}><InstructorEarnings/></Suspense>`.
    The Suspense boundary is not optional — the hook reads `useSearchParams`, which Next 16 requires under
    one.
  - **Done when**: `/instructor/earnings` renders the skeleton then a state, and `ComingSoon` no longer
    appears in the file.

**Checkpoint**: the endpoint answers, the page renders a state, and nothing is proven yet.

---

## Phase 3: User Story 1 — Revenue, refunds and net (Priority: P1) 🎯 MVP

**Goal**: three tiles that are right.

**Independent test**: seed the paid / refunded / pending / failed / free / repriced orders from
quickstart.md Fixture data, open `/instructor/earnings`, and check each tile against the orders.

- [X] T024 [ME] Add `MoneyRuleTests` to `backend/apps/enrollment/tests_earnings.py`
  - **What**: what counts, and for how much. Every assertion here defends a line of T005's base queryset.
  - **Read first**: research.md R1, R2; spec FR-007 – FR-011a.
  - Cases, all at `period=all` so the window is never the variable under test:
    - a `paid` order of `50.00` → `total_revenue 50.00`, `refunds 0.00`, `net 50.00`;
    - a `refunded` order → counted in **both** `total_revenue` and `refunds`, `net` unchanged by it
      (the case that fails if someone "tidies" `refunded` out of the base queryset);
    - `pending` and `failed` orders of non-trivial amounts → nothing moves;
    - a **free** order (`amount=0`) → nothing moves, and `stats.sales` does not count it (FR-008a);
    - a course whose price changed after the sale → the historic `Order.amount` is used, not the price;
    - every period where **all** sales were refunded → `net == "0.00"`, `stats.sales > 0` (FR-011a);
    - every money field matches `^\d+\.\d{2}$` — assert with a regex over the whole payload, so a float
      introduced anywhere in `dto.py` fails here rather than in a browser.
  - **Done when**: the class passes.

- [X] T025 [ME] Add `DashboardParityTests` to `backend/apps/enrollment/tests_earnings.py`
  - **What**: FR-014 — all-time net equals the dashboard's Earnings tile, asserted against the **live
    dashboard endpoint**, not a hand-computed number.
  - **Read first**: research.md R3; `_earnings` in `backend/apps/course/dashboard/service.py`.
  - Seed a mix including a refunded order, a free enrolment and a pending order; `GET` both
    `reverse('instructor_dashboard')` and `reverse('instructor_earnings') + '?period=all'`; assert
    `dashboard['earnings']['amount'] == earnings['stats']['net']`.
  - Add a second case with an order whose `created_at` is **null** (set it with `.update(created_at=None)`).
    Before T006's backfill this assertion fails — that is the test demonstrating why the migration exists
    (R4). If the owner declined T006, mark this case `expectedFailure` with a comment naming the fallback
    and the weakened requirement, rather than deleting it.
  - **Done when**: the class passes (or the documented `expectedFailure` holds).

- [X] T026 [ME] Create `featuers/instructor-earnings/components/EarningsTiles.tsx`
  - **What**: the three tiles, using the shared `StatTile` from T010.
  - **Read first**: spec FR-006, FR-012; contracts §"Money format".
  - Total revenue / Refunds / Net, in that order, with `lucide-react` icons
    (`DollarSign`, `RotateCcw`, `Wallet` or similar) and `formatMoney` for every value — `$8,940.00`,
    never `$8.9k` (FR-012).
  - Secondary line on Total revenue: the sale count (`173 sales`), which is the only place `stats.sales`
    surfaces.
  - Grid `grid-cols-1 sm:grid-cols-3`, matching the dashboard's tile row at every breakpoint — the point of
    T010 is that these look like the dashboard's, so do not restyle them here.
  - Wire it into `InstructorEarnings.tsx` in place of the T021 stub.
  - **Done when**: the three tiles render with real figures and `npx tsc --noEmit` passes.

**Checkpoint**: US1 is independently testable. The page answers "how am I doing?" for the current month.

---

## Phase 4: User Story 2 — Change the period (Priority: P1)

**Goal**: three chips that move every figure together, and survive a refresh.

**Independent test**: seed orders in this month, earlier this year and in a previous year; select each
chip; confirm the figures change together and the address round-trips.

- [X] T027 [ME] Add `PeriodApiTests` to `backend/apps/enrollment/tests_earnings.py`
  - **What**: the windows, their UTC edges, and the strict parameter.
  - **Read first**: spec FR-015 – FR-015c; research.md R5, R8.
  - Freeze the clock (`unittest.mock.patch` on `timezone.now`, as `tests_dashboard.py` does) so the
    boundaries are testable at all:
    - an order at `23:59:59` UTC on the **last day of last month** → excluded from `month`, included in
      `year` and `all`;
    - an order on the **1st at 00:00:00** of this month → included in `month`;
    - an order from a previous year → in `all` only;
    - `window.start` / `window.end` match the period, and `window.start is None` only for `all` with no
      sales;
    - `?period=` absent → `month`; `?period=year` → `year`;
    - `?period=lastweek` → **400** with `code: 'invalid_period'`;
    - the response's `period` field always echoes what was served (FR-039's client check depends on it).
  - **Done when**: the class passes.

- [X] T028 [AI] Wire the period chips into `InstructorEarnings.tsx`
  - **Pattern**: `InstructorAnalytics.tsx` + `usePeriodParam` — the same wiring, with T014's `ChipToggle`
    and T019's `useEarningsPeriod`.
  - One `useEarningsPeriod()` drives the chips and the query key, so tiles, chart and table can only ever
    show one period (FR-004).
  - **Done when**: clicking a chip updates the address without a full reload; refresh and Back restore it;
    `?period=banana` shows This month with no error.

**Checkpoint**: US1 + US2 — the tiles answer three questions instead of one.

---

## Phase 5: User Story 4 — The per-course table (Priority: P1)

**Goal**: which course earned what.

**Independent test**: seed the five courses from quickstart.md (published, unpublished-but-sold,
refunded-only, free, never-sold) and check which appear, in what order, with which numbers.

- [X] T029 [ME] Add `CourseBreakdownTests` to `backend/apps/enrollment/tests_earnings.py`
  - **Read first**: spec FR-022 – FR-029; contracts §"Guaranteed relationships".
  - Cases:
    - one row per course with a counted sale, and **no row** for a course with only free enrolments
      or no orders;
    - an **unpublished** course that sold **is** listed (FR-025) — the assertion that fails if someone adds
      `is_published=True` to the queryset out of habit;
    - a course whose only sale was refunded → `{sales: 1, revenue: "0.00"}` (FR-023), still listed;
    - ordering by `revenue` desc, then `title`, then `id` — seed two courses with **equal** revenue and
      assert the tie-break is stable across two requests;
    - `Σ rows.revenue == stats.net` and `Σ rows.sales == stats.sales` (FR-027), asserted as an identity
      over the payload rather than against literals;
    - a course renamed after its sales shows the **current** title (FR-028);
    - another instructor's course never appears (also covered by T031, asserted here at row level).
  - **Done when**: the class passes.

- [X] T030 [ME] Create `featuers/instructor-earnings/components/CourseEarningsTable.tsx`
  - **What**: Course · Sales · Revenue, readable at 375px.
  - **Pattern**: `featuers/instructor-students/components/StudentsTable.tsx` — copy its two-layout
    structure exactly: a real `<table>` (the shadcn `Table` atoms) at `md` and up, a card list below,
    because three columns at 375px either scroll sideways or truncate the title into uselessness
    (FR-005, SC-012).
  - Long titles `truncate` with the full title on `title=`; `sales` and `revenue` right-aligned;
    `revenue` through `formatMoney`.
  - No paging, no sorting controls, no links — the server's order is the order (FR-029, and sorting is out
    of scope).
  - Wire into `InstructorEarnings.tsx` in place of the T021 stub.
  - **Done when**: the table renders, `npm run lint && npx tsc --noEmit` pass, and nothing scrolls sideways
    at 375px.

**Checkpoint**: US1 + US2 + US4 — the page is useful without the chart.

---

## Phase 6: User Story 5 — Nobody reads another instructor's earnings (Priority: P1)

**Goal**: prove the boundary, from outside the interface.

**Independent test**: request the endpoint as the owner, as another instructor, as a student and signed
out, and diff what comes back.

- [X] T031 [ME] Add `AccessTests` to `backend/apps/enrollment/tests_earnings.py`
  - **Read first**: spec FR-030 – FR-035; research.md P5b.
  - Cases:
    - instructor **B**'s orders never appear in **A**'s figures — assert on `stats`, on `courses` **and**
      on `trend`, because an ownership filter forgotten in one of T005's three queries shows up in only one
      of them;
    - a signed-in **student** → 403;
    - **signed out** → 401, with no figures in the body;
    - a staff user with **no `InstructorProfile`** → 403 with `code: 'no_instructor_profile'`;
    - an instructor who has also **bought** courses as a student → none of their spending appears (FR-032);
    - **no buyer identity anywhere**: walk the whole payload and assert that no key or value contains a
      user id, email, name, `stripe_payment_intent_id`, `payment_gateway`, receipt URL or order id
      (FR-033). Write it as a recursive scan of the JSON, not a field-by-field check — a field-by-field
      check passes the day someone adds a field.
  - **Done when**: the class passes.

- [ ] T032 [AI] Confirm the no-profile and refusal states render
  - **Pattern**: the `isNoInstructorProfileError` branch already wired in T021.
  - Sign in as a user with no instructor profile and open `/instructor/earnings`: the handled state shows,
    the query does **not** retry in a loop (T018's retry rule), and no figures flash first.
  - **Done when**: the state renders and DevTools shows a single request.

**Checkpoint**: all four P1 stories done. This is a shippable release.

---

## Phase 7: User Story 3 — The revenue trend (Priority: P2)

**Goal**: bars that add up to the Net tile.

**Independent test**: seed sales on two days of this month and confirm 30-odd bars with two non-zero ones,
then switch periods and confirm the granularity changes.

- [X] T033 [ME] Add `TrendTests` to `backend/apps/enrollment/tests_earnings.py`
  - **Read first**: spec FR-016 – FR-021; research.md R2, R5.
  - Cases:
    - `month` → one bucket per day from the 1st to today, **including** the empty ones, with sales on two
      of them (FR-018);
    - `year` → one per calendar month, January to now; `all` → one per month from the earliest sale, with
      no gap;
    - `Σ trend.amount == stats.net` for all three periods (FR-016);
    - **the cross-period refund**: a sale placed last month and refunded this month reduces **last
      month's** bucket and leaves this month's untouched (FR-010). This is the single assertion that fails
      if someone re-implements attribution against the refund's own date — give it a docstring saying so;
    - a bucket whose every sale was refunded is present with `"0.00"`, not omitted (FR-021);
    - `all` with no sales → `trend == []` and `window.start is None`.
  - **Done when**: the class passes.

- [X] T034 [ME] Create `featuers/instructor-earnings/components/RevenueTrendChart.tsx`
  - **What**: vertical bars over time.
  - **Read first**: research.md P5, R9.
  - **Pattern**: `featuers/instructor-analytics/components/EnrollmentsChart.tsx` for the structure — the
    bucket shape, `formatBucketLabel`, `ResponsiveContainer`, `accessibilityLayer`, `var(--color-*)` tokens
    with no raw hex, `interval="preserveStartEnd"` + `minTickGap` on the x-axis — and
    `SectionDropOffChart.tsx` for the `<Bar>` styling. Swap `<Line>` for `<Bar>`.
  - **Decide empty before rendering**: an empty or all-zero series renders the `ChartEmpty`-style state,
    never a row of flat bars presented as data (FR-018's companion, US3 scenario 4).
  - Tooltip and the accessible value both go through `formatMoney` — the y-axis is money, so a bare number
    there is a bug.
  - Wrap it in the shared `ChartCard` (T013) with the title "Revenue trend" and the footnote "Dates in
    UTC"; wire into `InstructorEarnings.tsx` in place of the T021 stub.
  - **Done when**: bars render for all three periods, values are reachable by keyboard, and nothing scrolls
    sideways at 375px with 31 daily bars.

**Checkpoint**: the whole feature.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T035 [ME] Run the full verification pass in `specs/013-instructor-earnings/quickstart.md`
  - Sections 2 (the endpoint by hand), 3 (the page — **browser checks are the owner's to run**), 4 (the
    three tile rows must be pixel-identical across `/instructor`, `/instructor/analytics` and
    `/instructor/earnings`) and 5 (lint and types).
  - **Done when**: every numbered check holds, or a failure is written up as a new task.

- [X] T036 [P] [AI] Regression sweep
  - `cd backend && python manage.py test apps.enrollment apps.course.tests_dashboard apps.course.tests_analytics -v 1`
    — T010 – T014 touched 008's and 009's components, and T006 touched order data; these are the suites that
    would notice.
  - `cd front-end && npm run lint && npx tsc --noEmit`.
  - **Done when**: no new failure exists that was not already failing on `master` before this branch.

---

## Dependencies

```
Phase 1 (T001–T002)
   └─> Phase 2 Foundational (T003–T023)
          backend:  T003, T004 ──> T005 ──> T007 ──> T008
                    T006 (gated, independent of the rest; needed before T025 passes)
                    T009 depends on T003 only
          shared:   T010 ──> T011, T012      T013      T014
          frontend: T015, T016 ──> T017 ──> T018     T019
                    T018, T019, T020 ──> T021 ──> T022 ──> T023
   └─> Phase 3 US1 (T024, T025, T026)      ← MVP
   └─> Phase 4 US2 (T027, T028)
   └─> Phase 5 US4 (T029, T030)
   └─> Phase 6 US5 (T031, T032)
   └─> Phase 7 US3 (T033, T034)
   └─> Phase 8 (T035, T036)
```

Story phases depend only on Phase 2, not on each other, so US1, US2, US4, US5 and US3 can be worked in any
order once the endpoint exists — the priority order above is the recommended one because it front-loads the
four P1 stories.

## Parallel opportunities

| Phase | Run together |
|-------|--------------|
| 1 | T001, T002 |
| 2 backend | T003 + T004 (then T005), T006, T009 after T003 |
| 2 shared | T010 → then T011 ‖ T012; T013 ‖ T014 alongside |
| 2 frontend | T015 ‖ T016, then T017 → T018 ‖ T019 ‖ T020 |
| 3–7 | each story's backend test class ‖ its frontend component — different trees, no shared file |
| 8 | T036 while T035's browser pass is under way |

Do **not** parallelise tasks that share `apps/enrollment/views.py`, `tests_earnings.py`,
`InstructorEarnings.tsx` or `index.ts` — work those in ID order.

## Implementation strategy

**MVP = Phase 1 + Phase 2 + Phase 3 (US1).** That is a real Earnings page: three correct tiles for the
current month, replacing the placeholder. Phase 4 makes it answer three questions, Phase 5 makes it
actionable, Phase 6 proves the boundary, Phase 7 adds the picture.

**The one gate**: T006 needs the owner's yes before it runs, and T025 is the test that shows what happens
without it.

**The one thing most likely to ship wrong**: refund attribution. T033's cross-period case is the assertion
that catches it, and it is in the last phase — if Phase 7 is deferred, move that single test into T024.
