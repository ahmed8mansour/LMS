# Implementation Plan: Instructor Analytics — Per-Course and Aggregate Learning Insight

**Branch**: `009-instructor-analytics` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-instructor-analytics/spec.md`, shaped around the owner's API
contract sketch (research.md, header)

## Summary

Fill the two analytics placeholders from spec 003 with real insight:

- the course workspace's **Analytics** tab, for one course;
- the sidebar's **Analytics** page, pooled across every owned course.

Both show three tiles (completion rate, quiz pass rate, active students) and an enrollments-over-time line chart
for a period of 30 days, 90 days or all time. They differ in the bar chart: **section drop-off** per course,
**course drop-off** in the aggregate.

The build has three parts, following the owner's sketch:

1. **Two read endpoints, one snapshot each.**
   - `GET /courses/instructor/courses/{id}/analytics/?days=30|90|all` is an `@action` on the existing
     `InstructorCourseViewSet`, so another instructor's course is a 404 before any analytics code runs.
   - `GET /courses/instructor/analytics/?days=…` is an `APIView` that reads no ids.
   - Both return the payload directly: rates as fractions (`.71`) **plus their counts** (owner answer P1),
     `period`, `window {start, end}`, `enrollments_over_time [{start, end, count}]`, and `section_drop_off` or
     `course_drop_off` (P2). Any failure is one `500 {error}`, never a partial body (research R1, R7).
2. **A new `apps/course/analytics/` package, with one computation for both scopes.**
   - `CourseAnalyticsService.build(courses, period)` runs a **fixed four-query plan** over the list of courses:
     cohort enrollments, curriculum, lecture progress grouped per student per section, and quiz attempts
     grouped per student per quiz.
   - It hands plain rows to **pure** `metrics.py` / `periods.py`. Those files hold every definition the
     clarifications fixed: completion needs all lectures **and** all quizzes, a stuck section is the one after
     the highest completed section (with a fallback), quiz pass is counted per student–quiz pair, and buckets
     are UTC and clipped. Each definition gets a database-free test (R2, R3, R5, R6).
3. **A new `featuers/instructor-analytics/` frontend module on Recharts** (P4).
   - Zod-parsed responses.
   - `staleTime 0 / gcTime 0` queries (008 pattern).
   - The period lives in `?days=` via `router.replace`, falling back to 30 for anything unrecognised.
   - Both drop-off charts use **horizontal bars**, so long titles and 50 courses stay readable at 375px.
   - The spec's labelled empty states stay (P3): the API returns `null` and the client maps it to the label
     (R8–R10).

**No database migration.** One new frontend dependency (`recharts`), which the owner asked for.

Three findings shape the build:

- **The existing progress helpers can't be reused as code, only as rules.**
  `progress.utils.get_section_progress` / `is_section_unlocked` run several queries per section for one
  student, and `has_completed_course` is lectures-only, which clarification Q4 rejected. The rules are
  restated as pure functions, and an agreement test pins them to the unlock helper (R6, R11).
- **Two different user keys.** `Enrollment.user` is a `CustomUser`, while `LectureProgress`/`QuizAttempt`
  point at `StudentProfile`. Everything is keyed through `user__user_id` inside the grouped queries, so there
  are no per-student lookups (R6).
- **The aggregate cohort is per (student, course) pair, not per student.** A student who enrolled in course A
  this month and course B last year contributes A's progress to "Last 30 days" but not B's. Grouped rows are
  matched to cohort pairs in Python, which is also what lets one code path serve both scopes (R3, R6).

### Phasing

- **Phase 1 (backend): the package, both endpoints, tests.**
  - The `analytics/` package, the `analytics` viewset action, `InstructorAnalyticsView`, the route, the
    `instructor_analytics` throttle, and `tests_analytics.py`.
  - It can be verified with an HTTP client alone. Shipping it without the frontend breaks nothing, because both
    `ComingSoon` placeholders keep rendering.
- **Phase 2 (frontend): the two pages.**
  - Install `recharts`.
  - Build the feature module (schemas, API, hooks, components).
  - Swap the two placeholder `page.tsx` files.

## Technical Context

**Language/Version**: Python 3 / Django 6.0 + DRF backend; TypeScript 5 (Next.js 16 / React 19) frontend
**Primary Dependencies**:
- Backend: DRF `ModelViewSet` `@action`, `APIView`, `ScopedRateThrottle`, ORM `.values().annotate(Count(...,
  filter=Q))`, `prefetch_related`/`select_related`, frozen `dataclasses`, `django.utils.timezone` (settings
  `TIME_ZONE = 'UTC'`, `QUIZ_PASS_THRESHOLD = 50` already applied when attempts are stored).
- Frontend: TanStack Query `useQuery`, Zod, `next/navigation` (`useSearchParams`, `useRouter`,
  `usePathname`), existing atoms (`skeleton`, `button`), `lucide-react`, and **new: `recharts` ^3**
  (`ResponsiveContainer`, `LineChart`, `BarChart layout="vertical"`, `Tooltip`, `accessibilityLayer`).

**Storage**: PostgreSQL, **no migration**. Reads `Course`, `Section`, `Lecture`, `Quiz`, `Enrollment`,
`LectureProgress`, `QuizAttempt`, `InstructorProfile`.
**Testing**: Django `APITestCase` + `SimpleTestCase` in `backend/apps/course/tests_analytics.py`, run with the
module label. Pure unit tests cover `metrics.py`/`periods.py`, there is an agreement test against
`progress.utils`, the contract checklist covers the API, and `assertNumQueries` pins the plan (R11). Time is
fixed in tests by patching `timezone.now`. Frontend gates are `tsc --noEmit` and lint. Browser checks are run
by the owner from quickstart.md.
**Target Platform**: Responsive web inside the instructor shell (desktop-first, down to 375px)
**Project Type**: Web application (Next.js frontend + Django REST backend)
**Performance Goals**:
- About 6 queries per request, the same for 1 or 50 courses (pinned by a test).
- Grouped rows are bounded by students × sections and students × quizzes (not × lectures).
- Stays within the shell's normal response budget at SC-008's ceilings (50 courses / 10,000 enrollments;
  one course with 5,000 enrollments and 30 sections).

**Constraints**:
- Ownership only via `get_object()` / the session profile (FR-025, FR-026).
- All-or-nothing snapshot (FR-020, FR-022).
- The clarified definitions only (FR-005, FR-007, FR-009, FR-010, FR-014, FR-015, FR-019).
- UTC buckets (FR-011a).
- No student identity in responses (FR-028).
- Read-only (FR-029).
- No raw errors to clients.
- No cache, job, realtime layer or migration.
- Student experience, dashboard (008) and other instructor surfaces untouched (FR-030).

**Scale/Scope**:
- Phase 1: 5 new files in `analytics/`, 3 edited backend files (`views.py`, `urls.py`, `settings.py`) and 1
  new test module.
- Phase 2: 1 new feature module (API, schema, types, 2 hooks, about 11 components), 2 replaced pages, and
  `package.json`.

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0. Re-checked after Phase 1 design; result
unchanged.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ PASS | Both responses are parsed with Zod schemas, and the TS types are **inferred** from them, so they can't drift. A malformed payload becomes the error state, never zeros (FR-022). `PeriodParam`/`PeriodLabel` are literal unions, and `normalizePeriod()` is the single place untyped address input becomes typed. The scope-specific keys (`section_drop_off` vs `course_drop_off`) are separate schemas, not optional fields. Backend DTOs are frozen dataclasses, and the pure metric functions take typed shapes, not ORM objects. There is no `any`. |
| II. Component-First Architecture | ✅ PASS | Two orchestrators (`CourseAnalytics`, `InstructorAnalytics`) own the only queries. Presentational components (`PeriodSelector`, `AnalyticsTiles`, `EnrollmentsChart`, `SectionDropOffChart`, `CourseDropOffChart`, `AnalyticsSkeleton`, `AnalyticsError`, `ChartCard`, `ChartEmpty`) take typed props and never fetch. Charts are Recharts component trees behind project-owned wrappers, so the library is swappable in one module. The `skeleton` and `button` atoms are reused, and the 008 `NoInstructorProfileState` is reused through its public export. |
| III. Security-First Development | ✅ PASS | `CookieJWTAuthentication` + `IsAuthenticated` + `isInstructor` on both. The per-course route resolves through `get_object()` inside the owned queryset, so another owner's id is 404, identical to a missing one (FR-026). The aggregate reads no ids, and its service accepts only the resolved profile. A staff account without a profile gets a handled 403/404, never an `AttributeError`. `days` is validated against an allow-list. Responses carry no student identity (tested). A throttle scope caps the heaviest read. ORM only, no raw SQL. |
| IV. Testing Discipline | ✅ PASS | The service and its pure metrics get unit tests (required for services). Every clarified definition and spec edge case has a named test, plus an agreement test against the existing unlock rule, the full contract checklist over HTTP, and a query-count guard (contract §6). |
| V. Documentation as Code | ✅ PASS | This plan, research, data-model, contract and quickstart. The non-obvious "why"s are commented at the point of use: why completion is stricter than review eligibility, why progress is grouped per section, why the cohort is per pair, why the API is strict but the page falls back, and why drop-off uses horizontal bars. `_conventions.md` gets a short analytics section at implementation, as 007 and 008 did. The API contract is documented. |

**Result**: PASS, no violations. Complexity Tracking not required.

**Dependency note (not a violation)**: `recharts` is a new runtime dependency. It was explicitly requested by
the owner (research P4, R8). It is imported only inside `featuers/instructor-analytics/components/`.

**Migration note**: no model changes, so no migration. An `Enrollment(course, is_active, enrolled_at)` index was
considered and deferred until measured (R6). If it is ever added, it will be a new migration only.

**Backward-compatibility note**: additive only. There is one new viewset action route and one new path, and no
existing response, serializer, query key, or hook changes. The only files whose rendered output changes are
the two `ComingSoon` analytics placeholders spec 003 designated for replacement.

## Project Structure

### Documentation (this feature)

```text
specs/009-instructor-analytics/
├── plan.md                         # This file
├── spec.md                         # What/why: 4 stories, FRs, 9 SCs, 7 clarifications
├── research.md                     # Phase 0: owner contract answers P1–P4, decisions R1–R11
├── data-model.md                   # Phase 1: value types, pure definitions, DTOs, invariants, TS types
├── quickstart.md                   # Verification walkthrough
├── contracts/
│   └── instructor-analytics.md     # Both endpoints, field rules, errors, consumer contract, test checklist
├── checklists/
│   └── requirements.md             # Specification quality gate
└── tasks.md                        # Phase 2 output (/speckit.tasks, NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/apps/course/
├── analytics/                          # NEW package, same shape as publishing/ and dashboard/
│   ├── __init__.py                     # public surface: CourseAnalyticsService, Period, parse_period,
│   │                                   #   InvalidPeriod, AnalyticsSnapshot
│   ├── periods.py                      # Period, parse_period(), Window, window_for(), build_buckets(); pure (R4)
│   ├── metrics.py                      # CourseShape/SectionShape/StudentCourseProgress, section_completed,
│   │                                   #   course_completed, stuck_section, rate, drop-off builders; pure (R5)
│   ├── dto.py                          # CompletionStat, QuizPassStat, Bucket, SectionDropOff, CourseDropOff,
│   │                                   #   AnalyticsSnapshot (frozen) + to_dict()
│   └── service.py                      # CourseAnalyticsService.build(courses, period, scope): 4-query plan (R6)
├── views.py                            # + InstructorCourseViewSet.analytics (@action detail=True, GET)
│                                       #   + get_throttles() branch for 'analytics'
│                                       #   + InstructorAnalyticsView(APIView): no ids, no-profile 403, 400 on
│                                       #   bad days, logged 500 (R1, R7)
├── urls.py                             # + path('instructor/analytics/', InstructorAnalyticsView.as_view(),
│                                       #   name='instructor_analytics')
└── tests_analytics.py                  # NEW: pure definition tests, agreement test, contract checklist,
                                        #   query-count guard

backend/config/
└── settings.py                         # + DEFAULT_THROTTLE_RATES['instructor_analytics'] = '60/min'

front-end/
├── package.json                        # + "recharts": "^3"
└── src/
    ├── featuers/instructor-analytics/  # NEW feature module
    │   ├── api/instructorAnalytics.api.ts        # getCourseAnalytics(id, days), getInstructorAnalytics(days)
    │   │                                          #   GET + Zod parse
    │   ├── schemas/instructorAnalytics.schma.ts  # CourseAnalyticsSchema, InstructorAnalyticsSchema (+ shared parts)
    │   ├── types/instructorAnalytics.types.ts    # z.infer types, PeriodParam, normalizePeriod(), percent(),
    │   │                                          #   emptyLabel(), PERIOD_OPTIONS
    │   ├── hooks/
    │   │   ├── useCourseAnalytics.tsx            # ['instructor','course',id,'analytics',days], staleTime/gcTime 0
    │   │   ├── useInstructorAnalytics.tsx        # ['instructor','analytics',days], staleTime/gcTime 0
    │   │   └── usePeriodParam.tsx                # reads ?days (normalized), setPeriod() via router.replace (R10)
    │   ├── components/
    │   │   ├── CourseAnalytics.tsx               # orchestrator (course): skeleton / error / snapshot
    │   │   ├── InstructorAnalytics.tsx           # orchestrator (aggregate): skeleton / no-profile / error /
    │   │   │                                      #   no-courses / snapshot
    │   │   ├── PeriodSelector.tsx                # 3 options, aria-pressed, current marked (FR-004)
    │   │   ├── AnalyticsTiles.tsx                # 3 tiles, "p% · n of d", labelled empty states (FR-008–FR-010, FR-021)
    │   │   ├── ChartCard.tsx                     # titled card wrapper for a chart
    │   │   ├── ChartEmpty.tsx                    # chart no-data label
    │   │   ├── EnrollmentsChart.tsx              # Recharts LineChart, UTC date labels, tooltip/focus (FR-011, FR-012)
    │   │   ├── SectionDropOffChart.tsx           # horizontal BarChart, truncated labels, tooltip: full title,
    │   │   │                                      #   count, share (FR-013–FR-016)
    │   │   ├── CourseDropOffChart.tsx            # horizontal BarChart, % bars, tooltip counts, bar → course
    │   │   │                                      #   analytics link with ?days (FR-019–FR-019c)
    │   │   ├── AnalyticsSkeleton.tsx             # layout-matching skeleton, no zeros (FR-020)
    │   │   └── AnalyticsError.tsx                # page-level error + Retry (FR-022)
    │   └── index.ts                              # public exports
    └── app/instructor/
        ├── analytics/page.tsx                    # <Suspense><InstructorAnalytics /></Suspense>, replaces ComingSoon
        └── courses/[courseId]/analytics/page.tsx # <Suspense><CourseAnalytics courseId=… /></Suspense>,
                                                   #   replaces ComingSoon
```

**Structure Decision**: Web application.

- **Backend**: a new `analytics/` subpackage in `apps/course`, beside `publishing/` and `dashboard/`, following
  the conventions doc's domain-package shape.
  - **Per course** is an `@action` because there is one owning row the viewset already scopes (007 convention).
  - **Aggregate** is an `APIView` because there is no owning row (008 convention).
  - Both call the same service, so pooled and per-course numbers share one definition.
  - No new app and no new model.
- **Frontend**: a new `featuers/instructor-analytics/` module, the name in discovery §14.3. It isn't folded into
  `instructor-dashboard` (lifetime-only, no period) or `instructor-courses` (per-course CRUD). Recharts is
  confined to this module's chart components.
- **Unchanged**: no existing hook, query key, serializer, or component is modified. The workspace tab and
  sidebar links already point at the right routes (no param means 30 days).

## Complexity Tracking

No constitution violations, so the table is omitted. Two choices could look like extra complexity, and both are
argued in research:

- **Pure `metrics.py` / `periods.py` separate from `service.py`** (R2): the definitions changed four times in
  clarification. Keeping them free of the ORM makes each one a fast, exact unit test, and lets the agreement
  test pin them to the student-side unlock rule.
- **Matching grouped rows to cohort pairs in Python** (R6): it keeps the query count fixed and makes the
  aggregate's per-(student, course) cohort correct. Pushing it into SQL would need a correlated subquery per
  row.
