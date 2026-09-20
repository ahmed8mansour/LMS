# Tasks: Instructor Analytics — Per-Course and Aggregate Learning Insight

**Input**: Design documents from `/specs/009-instructor-analytics/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/instructor-analytics.md, quickstart.md

**Tests**: Backend tests are **included and not optional**. Constitution IV requires unit tests for services.
The analytics definitions were changed four times during clarification, and a pure test per definition is the
only thing that keeps them exact. User Story 4 (access) has almost no code of its own, so its tests are its
proof. Frontend component tests are optional (Constitution IV "SHOULD") and are not included.

**Organization**: grouped by user story. Stories run in this order: US1 → US2 → US3 → US4.
- US4 is P1 but comes last, because its tests exercise **both** endpoints and the aggregate endpoint arrives
  in US3.
- The pure definitions (`periods.py`, `metrics.py`), the DTOs, the service's query plan, and the frontend
  schema/API/period plumbing are **Phase 2 Foundational**: every story reads from the same snapshot.

**No migration.** The only new dependency is `recharts`. If you find yourself writing a migration or adding
another package, stop and re-read `plan.md` Technical Context.

---

## Tags

Every task carries exactly one ownership tag:

| Tag | Meaning | Rule |
|-----|---------|------|
| **[ME]** | Do this yourself (or review it line by line) | Invariants, security, or the **first instance** of a pattern in this feature |
| **[AI]** | Safe to delegate to an LLM | Repetition of a pattern already established by a `[ME]` task, and wiring |

A `[AI]` task always names the `[ME]` task (or the existing file) whose pattern it repeats. If an `[AI]` task
turns out to need a new decision, stop and promote it to `[ME]`.

## How to use this file (humans and LLMs)

Each task is meant to be picked up **on its own**, without the conversation that produced it.

- **First line**: what to do, and in which file.
- **Read first**: the exact documents or sections that hold the details.
- **Done when**: the acceptance check. The task is incomplete until every bullet holds.
- **`[P]`**: this task touches a different file from the other open tasks in its phase and has no
  unfinished dependency, so it can run in parallel with other `[P]` tasks.
- Mark a task `[X]` once it's finished.
- **Work tasks that share a file in ID order**, one at a time. Shared files are `metrics.py`, `service.py`,
  `views.py`, `tests_analytics.py`, `CourseAnalytics.tsx` and `index.ts`.

Terms used throughout:

- **snapshot**: one JSON response from either analytics endpoint (contracts/instructor-analytics.md).
- **cohort / counted enrollments**: active (`is_active=True`) enrollments whose `enrolled_at` is inside the
  period window (FR-005, research R4).
- **cohort pair**: a (student `CustomUser.id`, course id) pair with a counted enrollment.
- **profile**: the signed-in user's `InstructorProfile`.
- **scope**: `'course'` (one course) or `'instructor'` (all owned courses).

## Path Conventions

- **Backend**:
  - New package: `backend/apps/course/analytics/`.
  - Views: `backend/apps/course/views.py`. Routes: `backend/apps/course/urls.py`.
  - Settings: `backend/config/settings.py`. Tests: `backend/apps/course/tests_analytics.py`.
- **Frontend**:
  - New module: `front-end/src/featuers/instructor-analytics/`. Keep the house spelling `featuers`; schema
    files end in `.schma.ts`.
  - Pages: `front-end/src/app/instructor/analytics/page.tsx` and
    `front-end/src/app/instructor/courses/[courseId]/analytics/page.tsx`.
- **Run backend tests with a module label**: `python manage.py test apps.course.tests_analytics` (from
  `backend/`, venv active). A bare `apps.course` won't resolve.
- **Zod is v4**; **Recharts is v3**; **Next.js 16** (`useSearchParams` must sit under `<Suspense>`).
- **Time in tests**: patch `django.utils.timezone.now` (e.g. `patch('apps.course.analytics.service.timezone.now')`)
  to a fixed instant, e.g. `2026-09-17T12:00:00Z` (a Thursday). Set `Enrollment.enrolled_at` with
  `Enrollment.objects.filter(pk=...).update(enrolled_at=...)`, because `auto_now_add` ignores values passed
  to `create()`.

---

## Phase 1: Setup

**Purpose**: scaffolding that later tasks import from.

- [X] T001 [P] [AI] Add the throttle rate `'instructor_analytics': '60/min'` to `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']` in `backend/config/settings.py`
  - **Pattern**: the existing `'instructor_dashboard'` entry (spec 008).
  - Put it directly after `'instructor_dashboard'`, with a one-line comment: analytics is the heaviest
    period-parameterised instructor read, and the limit is a ceiling against a runaway client loop, not a
    security boundary.
  - **Done when**: `python manage.py check` passes.

- [X] T002 [P] [AI] Create the package `backend/apps/course/analytics/` with an `__init__.py` holding only a module docstring
  - **Pattern**: `backend/apps/course/dashboard/__init__.py`.
  - The docstring lists `periods.py`, `metrics.py`, `dto.py` and `service.py` with a one-line purpose each
    (plan.md Source Code tree). It ends with: "This `__init__` is the only import surface; views import from
    here." Exports are added in T009.
  - **Done when**: `python -c "import apps.course.analytics"` works from `backend/` (or `manage.py check`
    passes).

- [X] T003 [P] [AI] Add `recharts` to `front-end/package.json` by running `npm install recharts@^3` in `front-end/`
  - **Read first**: research.md R8.
  - **Done when**: `package.json` lists `"recharts": "^3.x"`, `package-lock.json` is updated, and
    `npx tsc --noEmit` still passes.

- [X] T004 [AI] Create `backend/apps/course/tests_analytics.py` with shared fixtures
  - **Pattern**: the top of `backend/apps/course/tests_dashboard.py` (imports, the `DashboardTestCase`
    video-provider patching, `make_student`, `enroll`).
  - Module docstring: `"""009 — Instructor analytics. Pure definition tests first, then API tests grouped by user story."""`
  - Import and reuse `make_instructor`, `make_course` from `apps.course.tests`, and `make_student`, `enroll`
    from `apps.course.tests_dashboard`. **Don't redefine them.**
  - Add helpers:
    - `add_section(course, order, title=None, lectures=0, quiz=False) -> Section`: creates the section, `lectures`
      lectures (`order` 1..n, with the minimal required fields copied from existing fixtures), and a `Quiz` if
      `quiz`.
    - `complete_lectures(user, lectures)`: `LectureProgress.objects.create(user=user.student_profile, lecture=l, is_completed=True)`
      for each.
    - `attempt(user, quiz, passed)`: `QuizAttempt.objects.create(user=user.student_profile, quiz=quiz, score=100 if passed else 0, passed=passed)`.
    - `set_enrolled_at(enrollment, dt)`: the `.update()` trick from Path Conventions.
    - `FIXED_NOW = datetime(2026, 9, 17, 12, 0, tzinfo=dt_timezone.utc)` (`from datetime import timezone as dt_timezone`; `django.utils.timezone.utc` was removed in Django 5).
    - `AnalyticsTestCase(APITestCase)`: copy the provider patching from `DashboardTestCase`, and in `setUp`
      also start a patcher for `apps.course.analytics.service.timezone.now` returning `FIXED_NOW`. Add
      `course_url(course_id, days=None)` and `instructor_url(days=None)` helpers that build the URL with
      `reverse()` plus an optional `?days=`, and `get(user, url)` that force-authenticates and GETs.
  - Leave URL-dependent helpers unused until T016/T032 register the routes. Don't write the smoke test yet;
    add a placeholder `class SetupTests(SimpleTestCase)` with one test asserting `FIXED_NOW.weekday() == 3`
    (Thursday), which later bucket tests rely on.
  - **Done when**: `python manage.py test apps.course.tests_analytics` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the definitions, the DTOs, the fixed query plan, and the frontend contract/period plumbing that
every story renders from.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Backend — pure definitions

- [X] T005 [P] [ME] Implement `backend/apps/course/analytics/periods.py` (periods, windows, UTC buckets)
  - **Read first**: research.md R4; data-model.md §3; spec.md FR-004, FR-005, FR-011, FR-011a and the
    "Partial first/last bucket" edge case.
  - **No ORM imports.** Only `datetime`, `enum`, `dataclasses`, `typing`.
  - Define:
    - `class Period(str, Enum)`: `THIRTY = '30'`, `NINETY = '90'`, `ALL = 'all'`, with a `label` property
      returning `'30d' | '90d' | 'all'`.
    - `class InvalidPeriod(ValueError)`.
    - `parse_period(raw: str | None) -> Period`: `None` or `''` → `THIRTY`. Any value outside the enum raises
      `InvalidPeriod`.
    - `@dataclass(frozen=True) class Window: start: date | None; end: date`.
    - `@dataclass(frozen=True) class Bucket: start: date; end: date; count: int`.
    - `cohort_start(period, today: date) -> datetime | None`: `THIRTY` → midnight UTC of `today − 29 days`;
      `NINETY` → `today − 89 days`; `ALL` → `None`. This is the lower bound for the enrollment filter.
    - `window_for(period, today, earliest_enrolled: date | None) -> Window`: for `THIRTY`/`NINETY` the start
      is the `cohort_start` date. For `ALL` it is `earliest_enrolled` (may be `None`). `end = today`.
    - `build_buckets(period, window, enrolled_dates: Iterable[date]) -> list[Bucket]`:
      - `THIRTY`: one bucket per day from `window.start` to `window.end` (30 buckets).
      - `NINETY`: Monday-start weeks. The first bucket runs from `window.start` to the Sunday of its week; the
        last ends at `window.end`.
      - `ALL`: calendar months from `window.start`'s month. The first starts at `window.start`, the last ends
        at `window.end`, and a year rollover is handled. `[]` when `window.start is None`.
      - Counts come from `enrolled_dates`. Zero buckets are always present. Dates outside the window are
        ignored.
  - Comment the "why" at the top: UTC day-aligned windows make the daily chart exactly 30 comparable points,
    and identical for every viewer (FR-011a); the API is strict (R4).
  - **Done when**: the module imports and T006's tests pass.

- [X] T006 [ME] Add pure tests for `periods.py` to `backend/apps/course/tests_analytics.py`
  - **Depends on**: T004, T005.
  - **Read first**: contracts §6 "Definitions" (bucket bullets); contracts §1–§2 window examples.
  - `class PeriodUnitTests(SimpleTestCase)` with at least:
    - `parse_period`: `None`/`''`/`'30'` → `THIRTY`; `'90'`, `'all'` parse; `'7'`, `'30d'`, `'ALL'` raise
      `InvalidPeriod`.
    - The window for today `2026-09-17`: 30d → `(2026-08-19, 2026-09-17)`; 90d → `(2026-06-20, 2026-09-17)`;
      all with earliest `2025-11-03` → `(2025-11-03, 2026-09-17)`; all with `None` → `start None`.
    - 30d buckets: exactly 30, each `start == end`, contiguous, zero-filled, and the counts land on the right
      day.
    - 90d buckets: the first is `2026-06-20..2026-06-21` (Sat–Sun, clipped), the second starts Monday
      `2026-06-22`, the last is `2026-09-14..2026-09-17`, and the buckets are contiguous with no gaps.
    - All-time buckets spanning `2025-11-03 → 2026-09-17`: the first is `2025-11-03..2025-11-30`, a December
      → January rollover is correct, and the last is `2026-09-01..2026-09-17`.
    - Invariant helper: for every period, `sum(count)` equals the number of in-window dates, and buckets
      cover `[window.start, window.end]` exactly once.
  - **Done when**: `python manage.py test apps.course.tests_analytics` passes.

- [X] T007 [P] [ME] Implement the core definitions in `backend/apps/course/analytics/metrics.py`
  - **Read first**: research.md R5 (the definitions table); data-model.md §4; spec.md FR-007, FR-008, FR-009,
    FR-013 – FR-016, and Clarifications Q4 (stricter completion).
  - **No ORM imports.**
  - Define frozen dataclasses:
    - `SectionShape(section_id: int, title: str, order: int, lecture_count: int, quiz_id: int | None)`.
    - `CourseShape(course_id: int, title: str, sections: tuple[SectionShape, ...])`, with sections in
      curriculum order.
    - `StudentCourseProgress(done_by_section: Mapping[int, int], passed_quiz_ids: frozenset[int], attempted_quiz_ids: frozenset[int])`.
  - Define functions:
    - `section_completed(section, progress) -> bool`: with a quiz, `quiz_id in passed_quiz_ids`; otherwise
      `lecture_count >= 1 and done_by_section.get(section_id, 0) >= lecture_count`.
    - `course_completed(course, progress) -> bool`: false if the course has 0 lectures and 0 quizzes. Otherwise
      every section has `done >= lecture_count` **and** every non-null `quiz_id` is in `passed_quiz_ids`.
    - `stuck_section(course, progress) -> SectionShape | None`: `None` if `course_completed`. Otherwise find
      the highest-index completed section *h*. With none, return `sections[0]`. If `h + 1` exists, return
      it. Otherwise return the first section with `done < lecture_count` or an unpassed quiz. As a last
      resort (impossible if not completed) return `sections[-1]`. Return `None` if the course has no
      sections.
    - `rate(numerator: int, denominator: int) -> float | None`: `None` if the denominator is 0, else
      `round(numerator / denominator, 4)`.
    - `quiz_pair_counts(progresses: Iterable[StudentCourseProgress]) -> tuple[int, int]`: returns
      `(passed, attempted)`, where `attempted = Σ len(attempted_quiz_ids)` and
      `passed = Σ len(passed_quiz_ids & attempted_quiz_ids)`.
  - Comments at the point of use:
    - Completion is intentionally stricter than review eligibility (Q4).
    - `section_completed` restates `apps.progress.utils.is_section_unlocked`'s rule, because that helper is
      per-student and multi-query (R6).
    - The fallback in `stuck_section` exists for progress that is no longer contiguous after curriculum
      edits.
  - **Done when**: the module imports and T008's tests pass.

- [X] T008 [ME] Add pure tests for `metrics.py`, plus the agreement test, to `backend/apps/course/tests_analytics.py`
  - **Depends on**: T004, T007.
  - **Read first**: contracts §6 "Definitions"; spec.md US1 scenarios 2, 4, 5, 6 and the Edge Cases list.
  - `class MetricsUnitTests(SimpleTestCase)` covering:
    - A section with a quiz needs a passed quiz; a lecture-only section needs all its lectures; an empty
      section never completes.
    - Course completion: all lectures plus all quizzes → true. All lectures with the last quiz unpassed →
      false. 0 lectures and 0 quizzes → false.
    - **US1-5**: a 4-section course where students' highest completed sections are none/1/1/3 → stuck
      sections 1, 2, 2, 4.
    - Fallback: every section's quiz passed but one lecture in section 2 not done → stuck at section 2, not
      completed.
    - A completed course → `stuck_section is None`.
    - Quiz pairs: attempts fail, fail, pass collapse to `attempted={q}`, `passed={q}`, giving (1, 1).
      Fail-only gives (0, 1). A quiz never attempted isn't counted.
    - `rate(0, 0) is None`, `rate(71, 100) == 0.71`, `rate(1, 3) == 0.3333`.
  - `class SectionUnlockAgreementTests(AnalyticsTestCase)`: build a real 3-section course (a quiz on section 1,
    lecture-only section 2) and a student. For three progress states (nothing, section 1's quiz passed,
    section 2's lectures all done), assert that `section_completed(shape_of(section_k), progress)` equals
    `apps.progress.utils.is_section_unlocked(student_profile, section_{k+1})`. Build the shapes and progress
    by hand in the test from the same rows.
  - **Done when**: all tests pass.

### Backend — DTOs and the query plan

- [X] T009 [AI] Implement `backend/apps/course/analytics/dto.py` and fill the `__init__.py` exports
  - **Depends on**: T005.
  - **Pattern**: `backend/apps/course/dashboard/dto.py` (frozen dataclasses + `to_dict()`).
  - **Read first**: data-model.md §5; contracts §1–§3 (exact key names).
  - Frozen dataclasses:
    - `CompletionStat(rate, completed, total)`.
    - `QuizPassStat(rate, passed, attempted, has_quizzes)`.
    - `SectionDropOff(section_id, title, order, count)`.
    - `CourseDropOff(course_id, title, drop_off_rate, not_completed, total)`.
    - `AnalyticsSnapshot(scope: Literal['course','instructor'], course: dict | None, period: Period, window: Window, completion, quiz_pass, active_students: int, enrollments_over_time: tuple[Bucket, ...], section_drop_off: tuple[SectionDropOff, ...] | None, course_drop_off: tuple[CourseDropOff, ...] | None, courses_count: int | None)`.
  - `AnalyticsSnapshot.to_dict()`:
    - Emits `period` as `period.label`, and dates as `date.isoformat()` (or `None`).
    - Course scope: emits `course` and `section_drop_off` and **omits** `course_drop_off` / `courses_count`.
    - Instructor scope: emits `course_drop_off` and `courses_count` and **omits** `course` /
      `section_drop_off`.
  - `__init__.py` exports `Period`, `InvalidPeriod`, `parse_period`, `AnalyticsSnapshot` (the service is
    added in T010).
  - **Done when**: `manage.py check` passes, and a quick `SimpleTestCase` added to `tests_analytics.py`
    confirms `to_dict()` key sets for both scopes match contracts §1 and §2 exactly.

- [X] T010 [ME] Implement `CourseAnalyticsService.build(courses, period, scope)` in `backend/apps/course/analytics/service.py`
  - **Depends on**: T005, T007, T009.
  - **Read first**: research.md R3, R6 (the four queries, verbatim); data-model.md §2 (identity join) and §6
    (invariants I1, I5, I6, I9); spec.md FR-005, FR-006, FR-010.
  - Signature: `build(self, courses: Sequence[Course], period: Period, scope: Literal['course','instructor']) -> AnalyticsSnapshot`.
    **The caller passes already-owned courses. The service never looks courses up by an id** (I1).
  - Steps:
    1. `today = timezone.now().date()`, `start = cohort_start(period, today)`, `course_ids = [c.id for c in courses]`.
    2. **Cohort (query 1)**: `Enrollment.objects.filter(course_id__in=course_ids, is_active=True)` plus
       `enrolled_at__gte=start` when `start` is set, then `.values_list('user_id', 'course_id', 'enrolled_at')`.
       Build `pairs: set[(user_id, course_id)]` and the `enrolled_dates` list.
    3. **Curriculum (query 2)**: `Section.objects.filter(course_id__in=course_ids).select_related('quiz').annotate(lecture_count=Count('lectures')).order_by('course_id', 'order')`
       → one `CourseShape` per course, including courses with no sections. Guard reverse one-to-one access
       with `getattr(section, 'quiz', None)`, or `Quiz.DoesNotExist`.
    4. **Progress (query 3)**, skipped when `pairs` is empty: `LectureProgress.objects.filter(is_completed=True, lecture__section__course_id__in=course_ids, user__user_id__in=cohort_user_ids).values('user__user_id', 'lecture__section_id').annotate(done=Count('id'))`.
    5. **Quiz results (query 4)**, skipped when `pairs` is empty: `QuizAttempt.objects.filter(quiz__section__course_id__in=course_ids, user__user_id__in=cohort_user_ids).values('user__user_id', 'quiz_id').annotate(passed=Count('id', filter=Q(passed=True)))`.
    6. Build `StudentCourseProgress` **per cohort pair** by mapping section → course and quiz → course from
       the shapes. **Discard rows whose (user, course) isn't in `pairs`** (the aggregate cohort rule; comment
       why).
    7. `completion = CompletionStat(rate(completed, len(pairs)), completed, len(pairs))`.
       `quiz_pass = QuizPassStat(rate(p, a), p, a, has_quizzes=any(section.quiz_id for shapes))`.
    8. `active_students = len(pairs)` for course scope and `len({u for u, _ in pairs})` for instructor scope
       (FR-018).
    9. `window = window_for(period, today, min(enrolled_dates).date() if enrolled_dates else None)`, then
       `build_buckets(...)` over `[d.date() for d in enrolled_dates]`.
    10. Course scope: `section_drop_off` = for the single shape, every section in order with the count of
        pairs whose `stuck_section` is that section. Instructor scope: leave `course_drop_off=()` and
        `courses_count=len(courses)` as **stubs** (T031 fills them).
  - Header docstring explaining: the query count is fixed regardless of course count; everything is keyed by
    `CustomUser.id` via `user__user_id`; nothing is serialized here, so failure is all-or-nothing in the view.
  - Export `CourseAnalyticsService` from `analytics/__init__.py`.
  - **Done when**: `manage.py check` passes. It is exercised by the US1 tests (T015).

### Frontend — contract, API, period plumbing

- [X] T011 [P] [AI] Create the Zod schemas `front-end/src/featuers/instructor-analytics/schemas/instructorAnalytics.schma.ts`
  - **Pattern**: `front-end/src/featuers/instructor-dashboard/schemas/instructorDashboard.schma.ts`.
  - **Read first**: data-model.md §7; contracts §1–§3.
  - Shared parts:
    - `WindowSchema` with `start: z.string().nullable()`.
    - `BucketSchema`.
    - `CompletionSchema` with `rate: z.number().min(0).max(1).nullable()` and `completed`/`total` as
      `z.number().int().min(0)`.
    - `QuizPassSchema` (+ `has_quizzes: z.boolean()`).
    - `PeriodLabelSchema = z.enum(['30d','90d','all'])`.
    - `SectionDropOffSchema`, `CourseDropOffSchema`.
  - `CourseAnalyticsSchema`: `scope: z.literal('course')`, `course: {id, title}`, and
    `section_drop_off: z.array(SectionDropOffSchema)`.
  - `InstructorAnalyticsSchema`: `scope: z.literal('instructor')`, `course_drop_off`, `courses_count`.
  - Separate schemas, **not** optional fields (Constitution I note in plan.md).
  - Top comment: parsing is load-bearing for FR-022. A malformed body must become the error state, never
    zeros.
  - **Done when**: `npx tsc --noEmit` passes, and both contract 200 examples (with the `"…"` placeholder
    strings removed) parse.

- [X] T012 [ME] Create types and helpers in `front-end/src/featuers/instructor-analytics/types/instructorAnalytics.types.ts`
  - **Depends on**: T011.
  - **Read first**: research.md R5 ("Rates on the wire", "Distinguishing empty labels"), R10; spec.md FR-004a,
    FR-008, FR-021.
  - Export the `z.infer` types `CourseAnalytics`, `InstructorAnalytics`, `Bucket`, `SectionDropOff`,
    `CourseDropOff`, `CompletionStat`, `QuizPassStat`, `PeriodLabel`.
  - Export:
    - `type PeriodParam = '30' | '90' | 'all'`.
    - `PERIOD_OPTIONS: readonly { value: PeriodParam; label: string }[]`: Last 30 days / Last 90 days / All
      time.
    - `normalizePeriod(raw: string | null): PeriodParam`: exactly `'30' | '90' | 'all'` pass through,
      **anything else → `'30'`** (FR-004a silent fallback).
    - `percent(n: number, d: number): number`: `Math.round((n / d) * 100)`, callers guarantee `d > 0`.
      Comment: always derived from counts, never from the rounded wire rate, so "71% · 36 of 51" can't
      disagree with itself.
    - `emptyLabel(period: PeriodLabel): string`: `'No data yet'` for `'all'`, else `'No data in this period'`.
    - `formatBucketLabel(bucket: Bucket, period: PeriodLabel): string`: a day (`Sep 16`), a week range
      (`Jun 22 – Jun 28`), or a month (`Sep 2026`), all formatted with `timeZone: 'UTC'`.
    - Re-use `isNoInstructorProfileError` via import from `@/featuers/instructor-dashboard` (exported in T034).
      Until then, define **no** duplicate.
  - **Done when**: `npx tsc --noEmit` passes with no `any`.

- [X] T013 [AI] Create the API client `front-end/src/featuers/instructor-analytics/api/instructorAnalytics.api.ts`
  - **Depends on**: T011, T012.
  - **Pattern**: `front-end/src/featuers/instructor-dashboard/api/instructorDashboard.api.ts`.
  - `getCourseAnalytics(courseId: number, days: PeriodParam): Promise<CourseAnalytics>` does
    `axiosInstance.get(`/courses/instructor/courses/${courseId}/analytics/`, { params: { days } })` then
    `CourseAnalyticsSchema.parse(data)`.
  - `getInstructorAnalytics(days)` → `/courses/instructor/analytics/` + `InstructorAnalyticsSchema.parse`.
  - `export const instructorAnalyticsAPI = { getCourseAnalytics, getInstructorAnalytics };`
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T014 [ME] Create the period-in-address hook `front-end/src/featuers/instructor-analytics/hooks/usePeriodParam.tsx`
  - **Depends on**: T012.
  - **Read first**: research.md R10; spec.md FR-004a and Clarifications Q5 (the period is part of the page
    address).
  - `usePeriodParam(): { period: PeriodParam; setPeriod: (p: PeriodParam) => void }`:
    - `period = normalizePeriod(useSearchParams().get('days'))`.
    - `setPeriod` builds new params from the current ones, sets `days`, and calls
      `router.replace(`${pathname}?${params}`, { scroll: false })`.
  - Comments:
    - `replace` rather than `push`, so three clicks don't create three history entries, while the address
      still survives refresh and sharing.
    - An unrecognised value falls back silently because the API itself is strict (R4).
    - Consumers must render under `<Suspense>` (Next 16 `useSearchParams`).
  - **Done when**: `npx tsc --noEmit` passes.

**Checkpoint**: definitions tested, service ready, frontend contract and period plumbing ready.

---

## Phase 3: User Story 1 - See how one course is performing (Priority: P1) 🎯 MVP

**Goal**: the course workspace's Analytics tab shows the three tiles, the enrollments line chart and the
section drop-off bar chart for "Last 30 days".

**Independent Test**: for one course with known enrollments (including a refund), lecture completions, quiz
attempts and enrollment dates, open its Analytics tab (or GET the endpoint) and confirm every tile and chart
point matches FR-006 – FR-016.

### Tests for User Story 1

- [X] T015 [US1] [ME] Add per-course API tests `class CourseAnalyticsTests(AnalyticsTestCase)` to `backend/apps/course/tests_analytics.py`
  - **Depends on**: T004, T010. Write first (TDD); the API tests fail until T016–T017 land.
  - **Read first**: contracts §1, §3, §6 "API"; data-model.md §6 invariants; spec.md US1 scenarios 1–8 and
    Edge Cases.
  - Tests (all enrollments inside the last 30 days unless stated):
    - **Shape**: 200 and top-level keys exactly
      `{scope, course, period, window, completion, quiz_pass, active_students, enrollments_over_time, section_drop_off}`;
      `period == '30d'`; `window == {'start': '2026-08-19', 'end': '2026-09-17'}`; 30 buckets.
    - **US1-2**: 10 enrollments, 4 fully completed (all lectures + all quizzes), 1 with all lectures but the
      last quiz failed → `completion == {rate: 0.4, completed: 4, total: 10}`, and that fifth student counts
      toward the last section's drop-off bar.
    - **US1-3**: a refunded enrollment (`is_active=False`) with full progress changes no number and no bucket.
    - **US1-4**: fail, fail, pass on one quiz for one student → `quiz_pass.passed == 1`,
      `quiz_pass.attempted == 1`.
    - **US1-5/6**: the 4-section drop-off scenario → `[{order 1, count 1}, {order 2, count 2}, {order 3, count 0}, {order 4, count 1}]`,
      with every section listed and completed students absent.
    - **US1-8**: a course with no enrollments → `completion.rate is None`, `total 0`, `active_students 0`,
      30 zero buckets, and a section list with all zero counts.
    - No quizzes → `quiz_pass.has_quizzes is False`; quizzes with no attempts → `has_quizzes True`,
      `rate None`.
    - An unpublished course with active enrollments still returns data.
    - **Curriculum change**: a student completes everything, then a lecture is added to section 2 → not
      completed, stuck at section 2.
    - Invariants on every 200 in this class: I2 (bounds), I3 (`sum(section counts) == total − completed`),
      I5 (`sum(bucket counts) == total`), I6 (`active_students == total`).
  - **Done when**: all pass.

### Implementation for User Story 1

- [X] T016 [US1] [ME] Add the `analytics` action to `InstructorCourseViewSet` in `backend/apps/course/views.py`
  - **Depends on**: T010.
  - **Read first**: research.md R1, R7; the existing `readiness`/`publish` actions and `get_throttles()` in
    the same class; `InstructorDashboardView` (all-or-nothing try block and logging).
  - `@action(detail=True, methods=['get'])` `def analytics(self, request, pk=None)`:
    1. `course = self.get_object()`. **This is the ownership check**: another instructor's course, a missing
       course, and a caller without a profile all 404 here (FR-026). Comment it.
    2. `try: period = parse_period(request.query_params.get('days'))` / `except InvalidPeriod:` return
       `Response({'error': 'days must be one of 30, 90, all.', 'code': 'invalid_period'}, status=400)`.
    3. `try:` `data = CourseAnalyticsService().build([course], period, 'course').to_dict()` / `except Exception:`
       `logger.exception('Course analytics failed for course %s', course.id)` and return
       `Response({'error': "We couldn't load analytics. Please try again."}, status=500)`.
    4. `return Response(data, status=200)`.
  - Extend `get_throttles()`: `if self.action == 'analytics': self.throttle_scope = 'instructor_analytics'; return [ScopedRateThrottle()]`.
    Keep the publish branch unchanged.
  - Import from `.analytics` only (`CourseAnalyticsService`, `parse_period`, `InvalidPeriod`).
  - **Done when**: `manage.py check` passes, and `reverse('instructor_courses-analytics', args=[id])` resolves
    to `/courses/instructor/courses/{id}/analytics/`.

- [X] T017 [US1] [AI] Wire `course_url()` in `backend/apps/course/tests_analytics.py` to `reverse('instructor_courses-analytics', args=[course_id])` and add a shape smoke test
  - **Depends on**: T004, T016.
  - **Pattern**: `SnapshotShapeTests` in `tests_dashboard.py`.
  - **Done when**: the smoke test passes and T015 can use `course_url`.

- [X] T018 [P] [US1] [AI] Create the query hook `front-end/src/featuers/instructor-analytics/hooks/useCourseAnalytics.tsx`
  - **Depends on**: T013.
  - **Pattern**: `front-end/src/featuers/instructor-dashboard/hooks/useInstructorDashboard.tsx`.
  - `useCourseAnalytics(courseId: number, days: PeriodParam)`:
    `useQuery({ queryKey: ['instructor', 'course', courseId, 'analytics', days], queryFn: () => instructorAnalyticsAPI.getCourseAnalytics(courseId, days), staleTime: 0, gcTime: 0, refetchOnMount: 'always', retry: (count, error) => !(isAxiosError(error) && error.response?.status === 404) && count < 1 })`.
  - **No `placeholderData`.** Comment: a period change must show the skeleton, never the previous period's
    values next to the new selection (FR-020, SC-004).
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T019 [P] [US1] [AI] Create `ChartCard.tsx`, `ChartEmpty.tsx`, `AnalyticsSkeleton.tsx` and `AnalyticsError.tsx` in `front-end/src/featuers/instructor-analytics/components/`
  - **Pattern**: `DashboardSkeleton.tsx` and `DashboardError.tsx` in `featuers/instructor-dashboard/components/`.
  - `ChartCard({ title, children })`: a titled card (house tokens, `rounded-xl border bg-white p-4`).
  - `ChartEmpty({ label })`: a centered muted label at chart height (`h-64`), with `role="status"`.
  - `AnalyticsSkeleton()`: the same grid as the page (period selector bar, `grid-cols-1 sm:grid-cols-3`
    tiles, `grid-cols-1 lg:grid-cols-2` chart cards at `h-64`). **No numbers or empty-state text.**
    `aria-busy`, with `sr-only` "Loading analytics".
  - `AnalyticsError({ onRetry })`: "We couldn't load analytics", a Retry `Button`, `role="alert"`.
  - **Done when**: `npx tsc --noEmit` and lint pass.

- [X] T020 [P] [US1] [ME] Create `AnalyticsTiles.tsx` in `front-end/src/featuers/instructor-analytics/components/`
  - **Depends on**: T012.
  - **Read first**: spec.md FR-008, FR-009, FR-010, FR-021, SC-005; research.md R5 "Distinguishing empty
    labels".
  - Props: `{ completion: CompletionStat; quizPass: QuizPassStat; activeStudents: number; period: PeriodLabel }`.
  - Three tiles (`grid-cols-1 sm:grid-cols-3`):
    - **Completion rate**: if `completion.total === 0`, show `emptyLabel(period)`. Otherwise
      `{percent(completed, total)}%` large, with `{completed} of {total} students` beneath.
    - **Quiz pass rate**: `!has_quizzes` → "No quizzes"; `attempted === 0` → "No attempts"; otherwise
      `{percent(passed, attempted)}%` with `{passed} of {attempted} quiz results`.
    - **Active students**: `0` → `emptyLabel(period)`; otherwise the number (`toLocaleString('en-US')`).
  - **Invariant**: a `0%` must only ever render when a real denominator exists (SC-005). Comment this at the
    branch.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T021 [P] [US1] [ME] Create `EnrollmentsChart.tsx` (the first Recharts chart) in `front-end/src/featuers/instructor-analytics/components/`
  - **Depends on**: T003, T012.
  - **Read first**: research.md R8; spec.md FR-011, FR-011a, FR-012, FR-031; `front-end/src/app/globals.css`
    (the `--color-darkmint`, `--color-graytext2` tokens).
  - `"use client"`. Props: `{ buckets: Bucket[]; period: PeriodLabel }`.
  - When `buckets` is empty or every `count` is 0, render `<ChartEmpty label={emptyLabel(period)} />`.
  - Otherwise `<ResponsiveContainer width="100%" height={256}><LineChart data={rows} accessibilityLayer>` with:
    - `rows = buckets.map(b => ({ label: formatBucketLabel(b, period), count: b.count, start: b.start, end: b.end }))`;
    - `XAxis dataKey="label"` (`interval="preserveStartEnd"`, `minTickGap`) and `YAxis allowDecimals={false}`;
    - `Line dataKey="count"` with `stroke="var(--color-darkmint)"`, `dot={false}`, `activeDot`;
    - `Tooltip` showing the full range and the count ("Sep 16 · 30 enrollments").
  - A caption under the chart: "Dates in UTC" (FR-011a).
  - **Establishes the pattern** later charts copy: colours from CSS tokens via `var(...)` (never raw hex),
    `ResponsiveContainer`, `accessibilityLayer` for hover **and** keyboard focus, and the empty state before
    the chart. Say so in a header comment.
  - **Done when**: `npx tsc --noEmit` and lint pass.

- [X] T022 [US1] [ME] Create `SectionDropOffChart.tsx` (the first horizontal bar chart) in `front-end/src/featuers/instructor-analytics/components/`
  - **Depends on**: T003, T012, T021 (pattern).
  - **Read first**: research.md R8 ("Horizontal bars for drop-off"); spec.md FR-013, FR-016, the "Many sections"
    edge case, SC-009.
  - Props: `{ sections: SectionDropOff[]; period: PeriodLabel }`.
  - When `sections` is empty or every `count` is 0, render `ChartEmpty`.
  - Otherwise `BarChart layout="vertical" accessibilityLayer`, with height `Math.max(160, sections.length * 32)`:
    - `YAxis type="category" dataKey="label" width={140}`, with the label being `S{order} · {title}`
      truncated to about 22 characters with `…`;
    - `XAxis type="number" allowDecimals={false}`;
    - `Bar dataKey="count" fill="var(--color-darkmint)"`;
    - `Tooltip`: the full title, `{count} students stuck here`, and the share
      `percent(count, Σcount)% of students still in progress`.
  - The wrapper has **no horizontal scroll** at 375px (`w-full min-w-0`).
  - **Done when**: `npx tsc --noEmit` and lint pass.

- [X] T023 [US1] [ME] Create the orchestrator `CourseAnalytics.tsx` in `front-end/src/featuers/instructor-analytics/components/`
  - **Depends on**: T014, T018, T019, T020, T021, T022.
  - **Read first**: `front-end/src/featuers/instructor-dashboard/components/InstructorDashboard.tsx` (the
    state choice); spec.md FR-001, FR-003, FR-020, FR-022.
  - `"use client"`. Props `{ courseId: number }`.
  - `const { period } = usePeriodParam(); const query = useCourseAnalytics(courseId, period);`
  - Exactly one state:
    - `isPending` → `<AnalyticsSkeleton />`;
    - 404 → render nothing (the workspace layout already shows "Course not found");
    - `isError` → `<AnalyticsError onRetry={() => query.refetch()} />`;
    - otherwise the snapshot.
  - Snapshot layout, in FR-003 order:
    - a header row with an `h2` "Course analytics" and a slot `{/* PeriodSelector — T027 */}`;
    - `AnalyticsTiles`;
    - `grid-cols-1 lg:grid-cols-2` with `ChartCard "Enrollments over time"` → `EnrollmentsChart`, and
      `ChartCard "Section drop-off"` → `SectionDropOffChart`.
  - **Invariant** comment: never render tiles from one query result and charts from another; everything
    comes from `query.data`.
  - **Done when**: `npx tsc --noEmit` and lint pass.

- [X] T024 [US1] [AI] Export the public surface in `front-end/src/featuers/instructor-analytics/index.ts` and replace the placeholder in `front-end/src/app/instructor/courses/[courseId]/analytics/page.tsx`
  - **Depends on**: T023.
  - **Pattern**: `front-end/src/featuers/instructor-dashboard/index.ts`; the current `page.tsx` (`ComingSoon`).
  - `index.ts`: export `instructorAnalyticsAPI`, the types, `normalizePeriod`, `useCourseAnalytics`,
    `usePeriodParam`, `CourseAnalytics`.
  - `page.tsx`: `'use client'`. Read `courseId` with `useParams()` and render
    `<Suspense fallback={<AnalyticsSkeleton />}><CourseAnalytics courseId={Number(params.courseId)} /></Suspense>`.
    Remove the `ComingSoon` import.
  - **Done when**: `npx tsc --noEmit` and lint pass, and the owner confirms in the browser (quickstart §3A)
    that the tab renders.

**Checkpoint**: US1 is fully functional on "Last 30 days".

---

## Phase 4: User Story 2 - Change the time period (Priority: P1)

**Goal**: a period selector switches 30 / 90 / all together, and the choice lives in the page address.

**Independent Test**: with enrollments spread over more than 90 days, switch through the three periods and
confirm every tile and chart changes together, and that refresh, a shared link and `?days=7` behave per
FR-004a.

### Tests for User Story 2

- [X] T025 [US2] [ME] Add cohort and period API tests `class PeriodApiTests(AnalyticsTestCase)` to `backend/apps/course/tests_analytics.py`
  - **Depends on**: T015.
  - **Read first**: spec.md US2 scenarios 2, 4, 5; FR-005; contracts §4 (400).
  - Tests:
    - No `days` → `period '30d'`. `days=90` → `'90d'` with the window `2026-06-20..2026-09-17` and a first
      week bucket `2026-06-20..2026-06-21`. `days=all` → `'all'`.
    - `days=7` and `days=30d` → 400 `{'error': ..., 'code': 'invalid_period'}` with no other keys.
    - **US2-5**: a student enrolled 45 days ago who completed the course yesterday is absent from every number
      at `30`, and counted in `active_students` and `completion.completed` at `90`.
    - An enrollment 120 days ago appears only at `all`, and the `all` window starts at its date. The first
      month bucket is clipped to it.
    - **US2-4**: all enrollments older than 30 days → at `30`, `total 0`, `rate None`, 30 zero buckets.
    - `all` with no enrollments → `window.start is None`, `enrollments_over_time == []`.
    - I9: the `section_drop_off` section ids and titles are identical across the three periods.
  - **Done when**: all pass.

### Implementation for User Story 2

- [X] T026 [P] [US2] [AI] Create `PeriodSelector.tsx` in `front-end/src/featuers/instructor-analytics/components/`
  - **Depends on**: T012.
  - **Pattern**: the tab styling in `front-end/src/featuers/instructor-courses/components/CourseWorkspaceTabs.tsx`
    (active `border-darkmint text-darkmint`).
  - Props `{ value: PeriodParam; onChange: (p: PeriodParam) => void }`. Render `PERIOD_OPTIONS` as a
    `role="group"` `aria-label="Period"` row of `<button type="button" aria-pressed={active}>`, with the
    selected option visibly marked (FR-004).
  - **Done when**: `npx tsc --noEmit` and lint pass.

- [X] T027 [US2] [AI] Wire `PeriodSelector` into `front-end/src/featuers/instructor-analytics/components/CourseAnalytics.tsx`
  - **Depends on**: T023, T026.
  - Replace the T023 slot with `<PeriodSelector value={period} onChange={setPeriod} />` (take `setPeriod`
    from `usePeriodParam`). Render the header row with the selector in **every** state, including the
    skeleton and error states, so the control doesn't jump. Only the body below it switches state.
  - Export `PeriodSelector` from `index.ts`.
  - **Done when**: `npx tsc --noEmit` and lint pass, and quickstart §3B steps 1, 3, 4, 5 pass in the owner's
    browser check.

**Checkpoint**: US1 and US2 work together. Per-course analytics is complete.

---

## Phase 5: User Story 3 - See how all my courses are performing together (Priority: P2)

**Goal**: the sidebar's Analytics page shows pooled tiles, the pooled enrollments chart, and the course
drop-off chart (lowest completion first), with the same period selector.

**Independent Test**: with an instructor owning several courses with known activity, confirm each tile and
chart equals the pooled data under FR-017 – FR-019d, including a student in two courses and the course bar
ordering.

### Tests for User Story 3

- [X] T028 [US3] [ME] Add pure tests for course drop-off ordering to `MetricsUnitTests` in `backend/apps/course/tests_analytics.py`
  - **Depends on**: T008.
  - **Read first**: spec.md FR-019, FR-019a, US3 scenario 3; contracts §3 `course_drop_off`.
  - Tests for `course_drop_off(entries)` (T029):
    - **US3-3**: X 15/20, Y 2/10, Z 25/50 → order X (0.75), Z (0.5), Y (0.2).
    - Rate ties break on `not_completed` desc, then `title` asc, then `course_id` asc.
    - Entries with `total == 0` are excluded.
    - All-completed courses still appear with `drop_off_rate == 0.0`.
  - **Done when**: the tests fail only because `course_drop_off` doesn't exist yet (then pass after T029).

- [X] T029 [US3] [ME] Add `course_drop_off(entries)` to `backend/apps/course/analytics/metrics.py`
  - **Depends on**: T007, T028.
  - **Read first**: research.md R5 "Course drop-off"; data-model.md §5 `CourseDropOff`.
  - `entries: Iterable[tuple[CourseShape, int completed, int total]]` → `list[CourseDropOff]`:
    - skip `total == 0`;
    - `drop_off_rate = round((total − completed) / total, 4)`;
    - sort key `(-drop_off_rate, -not_completed, title, course_id)`.
  - Comment: ranking by rate, not count, surfaces the courses students least often finish regardless of size;
    counts travel with each bar so tiny courses are readable as tiny (Assumptions).
  - **Done when**: T028 passes.

- [X] T030 [US3] [ME] Add aggregate API tests `class InstructorAnalyticsTests(AnalyticsTestCase)` to `backend/apps/course/tests_analytics.py`
  - **Depends on**: T025. Write first (TDD); fails until T031–T032 land.
  - **Read first**: contracts §2, §3, §6 "API"; spec.md US3 scenarios 1, 2, 4, 6, 7; data-model.md I4, I5.
  - Tests:
    - **Shape**: keys exactly
      `{scope, period, window, completion, quiz_pass, active_students, courses_count, enrollments_over_time, course_drop_off}`
      with `scope == 'instructor'`.
    - **US3-2**: one student in two courses (one completed, one not) → `completion.total == 2`,
      `completed == 1`, `active_students == 1`.
    - **Pair cohort**: a student enrolled in course A 10 days ago and course B 60 days ago, with full
      progress in B → at `30`, B's progress contributes nothing, B has no bar, `total == 1`.
    - **US3-4**: a course with no cohort enrollments has no bar. **US3-7**: an unpublished course with active
      enrollments is included.
    - Pooling: completion is the sum of counts, not an average of per-course rates (two courses 1/1 and
      0/9 → `rate 0.1`, not 0.5).
    - Draft, unpublished and published courses all counted in `courses_count`.
    - An instructor with no courses → 200, `courses_count 0`, `total 0`, `course_drop_off []`.
    - Invariants on every 200: I2, I4, I5, and `active_students <= completion.total`.
  - **Done when**: all pass.

### Implementation for User Story 3

- [X] T031 [US3] [ME] Fill the instructor-scope stubs in `backend/apps/course/analytics/service.py`
  - **Depends on**: T010, T029.
  - **Read first**: spec.md FR-017, FR-018, FR-019; research.md R3.
  - For `scope == 'instructor'`: compute per-course `(completed, total)` from the same per-pair results
    already built in T010 step 7 (**no new query**), and set
    `course_drop_off = tuple(metrics.course_drop_off(...))`, `courses_count = len(courses)`,
    `section_drop_off = None`. Confirm `active_students` is the distinct-user count (FR-018) and the tiles are
    pooled counts.
  - For `scope == 'course'`: keep `course_drop_off = None`, `courses_count = None`.
  - **Done when**: T030 passes (after T032) and T015/T025 still pass.

- [X] T032 [US3] [ME] Add `InstructorAnalyticsView(APIView)` to `backend/apps/course/views.py` and register `path('instructor/analytics/', InstructorAnalyticsView.as_view(), name='instructor_analytics')` in `backend/apps/course/urls.py`
  - **Depends on**: T031.
  - **Read first**: `InstructorDashboardView` in the same file (copy its structure); research.md R1, R7;
    contracts §2, §4.
  - Class attributes: `authentication_classes = [CookieJWTAuthentication]`,
    `permission_classes = [IsAuthenticated, isInstructor]`, `throttle_scope = 'instructor_analytics'`.
  - `get(self, request)`:
    1. Resolve `profile = request.user.instructor_profile`, or return 403
       `{'error': 'No instructor profile is associated with this account.', 'code': 'no_instructor_profile'}`.
    2. Parse `days` → 400 `invalid_period`, exactly as in T016.
    3. `courses = list(Course.objects.filter(instructor=profile).only('id', 'title'))`: the **only**
       ownership filter. Comment that the view reads no ids from the client (FR-025).
    4. Build and `to_dict()` in one `try`, and on failure `logger.exception(...)` + 500
       `{'error': "We couldn't load analytics. Please try again."}`.
  - Comment why this is an `APIView` and not an `@action` (no owning row; 008 convention).
  - Wire `instructor_url()` in `tests_analytics.py` to `reverse('instructor_analytics')`.
  - **Done when**: `reverse('instructor_analytics') == '/courses/instructor/analytics/'`, and T030 passes.

- [X] T033 [P] [US3] [AI] Create the query hook `front-end/src/featuers/instructor-analytics/hooks/useInstructorAnalytics.tsx`
  - **Depends on**: T013.
  - **Pattern**: T018 (`useCourseAnalytics`).
  - Key `['instructor', 'analytics', days]`, the same freshness options, no `placeholderData`, and a retry that
    skips `isNoInstructorProfileError`.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T034 [P] [US3] [AI] Export `NoInstructorProfileState` and `isNoInstructorProfileError` from `front-end/src/featuers/instructor-dashboard/index.ts`
  - **Additive only**: two export lines, nothing else changes in that module.
  - Update T012's types file / T033's hook to import `isNoInstructorProfileError` from
    `@/featuers/instructor-dashboard`.
  - **Done when**: `npx tsc --noEmit` passes, and the dashboard still builds (lint).

- [X] T035 [P] [US3] [AI] Create `CourseDropOffChart.tsx` in `front-end/src/featuers/instructor-analytics/components/`
  - **Depends on**: T022 (pattern), T012.
  - **Pattern**: `SectionDropOffChart.tsx` (horizontal `BarChart`, truncation, tokens, `accessibilityLayer`).
  - Props `{ courses: CourseDropOff[]; period: PeriodParam; periodLabel: PeriodLabel }`.
    - Empty array → `ChartEmpty`. **All-zero rates still render** (real data; spec edge case).
    - Values are `drop_off_rate * 100` on an `XAxis type="number" domain={[0, 100]}` with a `%` tick
      formatter. Keep the backend order as-is (don't re-sort).
    - Height `Math.max(160, courses.length * 32)`, which stays readable at 50 courses (FR-019c).
    - `Tooltip`: the full title, `{round}% drop-off`, and `{not_completed} of {total} students haven't finished`.
    - Clicking a bar, or Enter on the focused bar, navigates via `router.push(`/instructor/courses/${course_id}/analytics?days=${period}`)`
      (FR-019b).
  - **Done when**: `npx tsc --noEmit` and lint pass.

- [X] T036 [US3] [AI] Create the orchestrator `InstructorAnalytics.tsx` and replace the placeholder in `front-end/src/app/instructor/analytics/page.tsx`
  - **Depends on**: T027 (pattern), T033, T034, T035.
  - **Pattern**: `CourseAnalytics.tsx` after T027 (header with `PeriodSelector` in every state, one state for
    the body).
  - States:
    - `isPending` → skeleton;
    - `isNoInstructorProfileError` → `<NoInstructorProfileState />`;
    - `isError` → `AnalyticsError`;
    - `courses_count === 0` → an empty state "No courses yet" with a `Link` to `/instructor/courses/new`
      (FR-024);
    - otherwise tiles plus `ChartCard "Enrollments over time"` and `ChartCard "Course drop-off"` →
      `CourseDropOffChart`.
  - Heading: `h1` "Analytics", with the subtitle "Across all your courses".
  - `page.tsx`: `<Suspense fallback={<AnalyticsSkeleton />}><InstructorAnalytics /></Suspense>`. Remove
    `ComingSoon`. Export `InstructorAnalytics` and `useInstructorAnalytics` from `index.ts`.
  - **Done when**: `npx tsc --noEmit` and lint pass, and quickstart §3C/§3D pass in the owner's browser
    check.

**Checkpoint**: both views complete.

---

## Phase 6: User Story 4 - Nobody sees another instructor's analytics (Priority: P1)

**Goal**: prove server-side that every value is scoped to the caller's own courses, that refusals are
uniform, and that no student is identified.

**Independent Test**: with instructors A and B each owning courses with activity, run the access tests below
against the backend alone.

- [X] T037 [US4] [ME] Add `class AnalyticsAccessTests(AnalyticsTestCase)` to `backend/apps/course/tests_analytics.py`
  - **Depends on**: T016, T032.
  - **Read first**: spec.md US4 scenarios 1–4, FR-025 – FR-028; contracts §4; the `AccessTests` class in
    `tests_dashboard.py` (pattern for student / anon / staff-without-profile accounts).
  - Tests:
    - **US4-1**: A requests B's course analytics → 404, and the response body equals the body for a
      nonexistent id (`999999`). Nothing about B's course appears.
    - A's aggregate, with B owning a course with enrollments and progress: A's totals are unchanged by B's
      data, and no bar or id of B's course appears anywhere in the JSON.
    - **US4-2**: a student gets 403 on both endpoints; an unauthenticated caller gets 401 on both.
    - **US4-3**: a staff user (`is_staff=True`) **without** an `InstructorProfile` gets 403
      `code 'no_instructor_profile'` on the aggregate and 404 on per-course. Neither is a 500.
    - **US4-4 / I7**: walk every key in both 200 bodies recursively (reuse or copy `_all_keys` from
      `tests_dashboard.py`). None of `user`, `user_id`, `email`, `name`, `username`, `avatar`,
      `profile_picture` appears, and no student's email string appears in `json.dumps(response.data)`.
    - **All-or-nothing**: patch `CourseAnalyticsService.build` to raise → both endpoints return 500 with keys
      exactly `{'error'}`.
    - `days` tampering: `days=all&days=30` doesn't bypass validation (the result is one of the allowed
      periods, or 400, never a 500).
  - **Done when**: all pass.

- [X] T038 [US4] [ME] Add the query-count guard `class AnalyticsPerformanceTests(AnalyticsTestCase)` to `backend/apps/course/tests_analytics.py`
  - **Depends on**: T032.
  - **Read first**: research.md R6; data-model.md I8; `ResilienceAndPerformanceTests` in `tests_dashboard.py`
    (the `CaptureQueriesContext` pattern).
  - Build an instructor with 1 course (2 sections, a quiz, 3 students with progress). Capture the query count
    of the aggregate GET. Add 9 more such courses. Assert the count is **identical**. Do the same for the
    per-course GET with 3 vs 30 students.
  - If the counts differ, fix the service (an N+1 slipped in); don't loosen the test.
  - **Done when**: passes.

**Checkpoint**: security and performance proven independently of the frontend.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T039 [P] [AI] Add an "Instructor Analytics (spec 009)" section to `specs/_conventions.md`
  - **Pattern**: the "Instructor Dashboard (spec 008)" section at the end of that file.
  - Bullets (short, one "why" each):
    - pure `metrics.py`/`periods.py` separate from the query plan;
    - cohort per (student, course) pair;
    - `user__user_id` to join `StudentProfile`-keyed progress to `CustomUser`-keyed enrollments;
    - progress grouped per section, not per lecture;
    - a strict API `days` with a UI fallback;
    - the period in the address via `router.replace`;
    - Recharts confined to one module, colours via `var(--color-*)`, `accessibilityLayer`;
    - percentages computed from counts on the client.
  - **Done when**: the section exists and matches what was built.

- [X] T040 [P] [AI] Update the instructor status in `specs/_overview.md`
  - **Pattern**: how 008 updated the "Instructor Dashboard" entry.
  - Note that per-course and aggregate analytics now exist, with both endpoint paths.
  - **Done when**: the overview reflects 009.

- [X] T041 [AI] Run the backend regression suite from `backend/`: `python manage.py test apps.course.tests_analytics apps.course.tests_dashboard apps.course.tests_publishing apps.course.tests`
  - **Done when**: all pass. Fix regressions in the 009 code, not by editing the older tests.

- [X] T042 [AI] Run the frontend gates from `front-end/`: `npx tsc --noEmit` and `npm run lint`
  - **Done when**: both are clean, with no new warnings in `featuers/instructor-analytics/` or the two pages.

- [ ] T043 [ME] Walk through `specs/009-instructor-analytics/quickstart.md` §3 (A–F) in the browser
  - **Owner-run.** Per the project's standing preference, browser verification is done by the owner, not the
    agent.
  - **Done when**: every step in A–F behaves as written, including 375px layout (F1) and keyboard focus on
    chart points and bars (A5).

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: needs Setup. **Blocks all stories.**
- **US1 (Phase 3)**: needs Foundational. The MVP.
- **US2 (Phase 4)**: needs US1. It adds the selector to US1's orchestrator and period tests on US1's endpoint.
- **US3 (Phase 5)**:
  - The backend (T028–T032) needs only Foundational plus T016's `get_throttles` edit, so it can start in
    parallel with US1.
  - The frontend (T033–T036) needs T027 (the orchestrator pattern with the selector).
- **US4 (Phase 6)**: needs both endpoints (T016, T032).
- **Polish (Phase 7)**: needs all of the above.

### Task-level dependencies (critical path)

```text
T004 ─┬─ T006
T005 ─┼─ T006, T009 ─ T010 ─ T016 ─ T017 ─ T015 ─ T025
T007 ─┼─ T008 ─ T028 ─ T029 ─ T031 ─ T032 ─ T030
      │                                  └─ T037, T038
T011 ─ T012 ─┬─ T013 ─┬─ T018 ─┐
             │        └─ T033  │
             ├─ T014 ──────────┼─ T023 ─ T024 ─ T027 ─ T036
             ├─ T020 ──────────┤           ▲
             └─ T026 ──────────┼───────────┘
T003 ─ T021 ─ T022 ─ T035 ─────┘
T019 ──────────────────────────┘
```

### Within each story

- Pure tests before the pure code they pin (T006/T008, T028 → T029).
- API tests are written alongside their endpoint, and must pass before the story's checkpoint.
- Backend before frontend for each story, so the frontend is built against a real, tested contract.

---

## Parallel Execution Examples

### Setup
```text
T001 [P] throttle rate   │ T002 [P] package __init__   │ T003 [P] npm install recharts
```

### Foundational
```text
Backend:  T005 [P] periods.py            │ T007 [P] metrics.py
Frontend: T011 [P] Zod schemas
then:     T006 (periods tests), T008 (metrics tests), T009 (dto) → T010 (service)
          T012 (types) → T013 (api), T014 (usePeriodParam)
```

### User Story 1
```text
T018 [P] useCourseAnalytics │ T019 [P] card/empty/skeleton/error │ T020 [P] AnalyticsTiles
T021 [P] EnrollmentsChart   → T022 SectionDropOffChart (copies T021's pattern)
then T023 orchestrator → T024 page
Backend in parallel: T016 action → T017 → T015 tests
```

### User Story 3
```text
Backend:  T028 → T029 → T031 → T032 → T030
Frontend: T033 [P] hook │ T034 [P] dashboard exports │ T035 [P] CourseDropOffChart
then T036 orchestrator + page
```

### Polish
```text
T039 [P] conventions │ T040 [P] overview
then T041 backend suite, T042 frontend gates, T043 owner browser walkthrough
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → Phase 2 Foundational (the definitions are tested before any endpoint exists).
2. Phase 3 (US1): the per-course endpoint, its tests, and the Analytics tab on "Last 30 days".
3. **Stop and validate**: `manage.py test apps.course.tests_analytics` + quickstart §3A.

### Incremental delivery

1. + US2: the period selector and address → quickstart §3B. Per-course analytics is complete.
2. + US3: the aggregate endpoint and the sidebar page → quickstart §3C, §3D.
3. + US4: access and performance proofs → quickstart §3E.
4. Polish: conventions, overview, full regression, owner walkthrough.

Each increment leaves the app working. Until a page's swap task lands (T024, T036), the 003 `ComingSoon`
placeholder keeps rendering.

### Tag split

| Tag | Tasks | Count |
|-----|-------|-------|
| **[ME]** | T005, T006, T007, T008, T010, T012, T014, T015, T016, T020, T021, T022, T023, T025, T028, T029, T030, T031, T032, T037, T038, T043 | 22 |
| **[AI]** | T001, T002, T003, T004, T009, T011, T013, T017, T018, T019, T024, T026, T027, T033, T034, T035, T036, T039, T040, T041, T042 | 21 |

Every `[ME]` task is one of: a definition or invariant (T005–T008, T012, T020, T025, T028–T031, T038), a
security boundary (T016, T032, T037), the first instance of a pattern in this feature (T010 query plan, T014
period in address, T021 Recharts chart, T022 horizontal bar chart, T023 orchestrator state machine, T015
first API test class), or owner-run verification (T043). Every `[AI]` task names the `[ME]` task or existing
file whose pattern it repeats.
