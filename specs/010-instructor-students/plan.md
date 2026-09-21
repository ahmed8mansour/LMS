# Implementation Plan: Instructor Student Roster

**Branch**: `010-instructor-students` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-instructor-students/spec.md`, shaped by the owner's API
sketch and their answers to a review of it (research.md, P1–P7)

## Summary

Replace the two `ComingSoon` student placeholders from spec 003 with a real roster:

- the course workspace's **Students** tab, for one course;
- the sidebar's **Students** page, across every owned course.

Both show the same table — profile picture, name, enrolment date, progress — with a name search and numbered
pages. The sidebar view adds a **Course** column. Nothing on either page changes anything.

The build has three parts:

1. **One read endpoint, two scopes** (owner answer P6).
   `GET /courses/instructor/students/?course=<id>&search=<term>&page=<n>` is a plain **`ListAPIView`** (P3).
   With `course` it is the tab; without, the sidebar page. It returns standard DRF page-number pagination
   (P5) — `count` / `next` / `previous` / `results` — with rows of
   `{id, name, avatar, enrolled_at, progress, course{id,title}}`, where `id` is the **enrolment** id (P2) and
   `progress` is a **percent** (P1) or `null`.
2. **One new backend module, `apps/course/roster.py`.** No package, no service class, no DTOs — the owner's
   direction, and correct here: 008 and 009 earned their packages with real aggregation, this feature has one
   function worth naming. `build_progress_map(enrollments)` turns a page of rows into
   `{(user_id, course_id): percent | None}` in two flat queries.
3. **A new `featuers/instructor-students/` frontend module** on a shadcn table moved into `atoms/` and
   restyled with the project's tokens (P7), with the search term and page number in the address.

**No database migration.** Every field already exists: `Enrollment.course/user/is_active/enrolled_at`,
`CustomUser.first_name/last_name/username/profile_picture`, `LectureProgress.is_completed`. No index is added
either — the existing `course_id` FK index and `unique_together ['user','course']` cover both query shapes at
the spec's ceilings; an index would be an additive migration if measurement ever calls for one.

**One new frontend dependency**: shadcn's `table` (a Radix-free, source-vendored component — no runtime
package is added; the constitution already names shadcn/ui as the project's UI source).

### Five findings that shape the build

- **Progress must be computed after pagination, not in the queryset.** Nothing sorts or filters by progress,
  so it never needs to exist in SQL. Paginating first and computing the ≤ 20 visible rows in two flat queries
  is both the simplest code and the fastest path — it avoids the 40-query `SerializerMethodField` *and* the
  correlated-`Subquery` version. Fixed at **4 queries** in the aggregate scope and **5** in the course scope
  (the extra one being the ownership resolution), flat in the number of rows, pinned by tests (R7).
- **The ordering needs a tiebreak or paging is wrong with zero writes.** `enrolled_at` is `auto_now_add`, and
  batch enrolments produce identical timestamps; `-enrolled_at` alone leaves tied rows unordered, so pages can
  repeat and skip students. `('-enrolled_at', '-id')` (R5).
- **DRF returns 404 for an out-of-range page; FR-024 wants page 1.** The paginator overrides
  `get_page_number()`, because `request.query_params` is immutable and the page cannot be rewritten after
  `NotFound` is raised (R4).
- **Two different user keys.** `Enrollment.user` is a `CustomUser`; `LectureProgress.user` is a
  `StudentProfile`. The completions query joins through `user__user_id`. Written the obvious way it returns
  nothing at all (R8).
- **`SearchFilter` already does more than it looks.** It ANDs whitespace-separated terms across the search
  fields, so full-name search works with no concatenated annotation; `icontains` gives partial matching;
  Django escapes `%`/`_`; whitespace-only terms are a no-op; and the to-one FK join means no `.distinct()`.
  FR-015 and FR-017 are satisfied by configuration alone (R6).

### Two deviations from the owner's sketch

Both are consequences of the one-endpoint decision and are one-line reversals if the owner disagrees:

- **`avatar`, not `pfp`** — 008 already ships this exact pair as `PersonRef{name, avatar}`, and this row's
  `course` is already `CourseRef{id, title}` verbatim. `pfp` would give two instructor reads two names for one
  thing (R9).
- **`course` is always present**, not only in the aggregate scope. With two endpoints, omitting it was right;
  with one, a conditional field costs two Zod schemas and two TS types to save ~40 bytes per row (R9).

### Phasing

- **Phase 1 (backend)**: paginator, `roster.py`, serializer, view, route, throttle scope, `tests_roster.py`.
  Independently verifiable over HTTP before any UI exists.
- **Phase 2 (frontend, per-course)**: the shadcn table moved and restyled, the feature module, and the
  workspace Students tab — User Stories 1–3, the P1 slice.
- **Phase 3 (frontend, aggregate)**: the sidebar Students page — User Story 4, P2. Reuses the whole module and
  adds one column; droppable without touching Phase 2.

## Technical Context

**Language/Version**: Python 3 / Django 6.0 + DRF backend; TypeScript 5 (Next.js 16 / React 19) frontend

**Primary Dependencies**:
- Backend: DRF `ListAPIView`, `PageNumberPagination`, `filters.SearchFilter`, `ScopedRateThrottle`,
  `select_related`, `.values().annotate(Count(...))`, the existing `isInstructor` permission and
  `CookieJWTAuthentication`.
- Frontend: TanStack Query `useQuery`, Zod, `next/navigation` (`useSearchParams`, `useRouter`, `usePathname`),
  the existing `avatar` and `skeleton` atoms, the existing `useDebounce` hook (made generic), `lucide-react`,
  and **new: shadcn `table`** vendored into `components/atoms/table.tsx`.

**Storage**: PostgreSQL, **no migration**. Reads `Enrollment`, `CustomUser`, `Course`, `Section`, `Lecture`,
`LectureProgress`, `InstructorProfile`.

**Testing**: Django `APITestCase` in `backend/apps/course/tests_roster.py`, run by module label. Coverage is
scope, ownership and identical refusals, row rules, an agreement test against `/progress/student/courses/`,
ordering stability under ties, search behaviour, paging edges, a privacy assertion over the raw body, and
`assertNumQueries(4)`. Frontend gates are `tsc --noEmit` and lint; browser verification is the owner's, from
quickstart.md.

**Target Platform**: Responsive web inside the instructor shell (desktop-first, down to 375px)

**Project Type**: Web application (Next.js frontend + Django REST backend)

**Performance Goals**:
- **4 queries per request** in the aggregate scope, **5** in the course scope (the extra one resolves
  `?course=` against the owned set — the FR-032 ownership check). Flat in the number of rows and pages;
  both numbers are test-pinned.
- Queries 3 and 4 are bounded by the page: ≤ 20 courses, ≤ 20 students, ≤ 400 grouped rows.
- Within the shell's normal response budget at SC-008's ceilings — 5,000 students in one course, and 50
  courses / 10,000 enrolments in the aggregate.

**Constraints**:
- Ownership derived from the session profile only; a client-supplied `course` is resolved against the owned
  set or refused (FR-031, FR-032).
- Read-only; the endpoint accepts `GET` alone (FR-035).
- Only the fields in FR-004 leave the server — no email, order, transaction, quiz or lecture data (FR-033).
- `progress` equals the student's own figure for that course (FR-010); `null`, never `0`, when there are no
  lectures (FR-011, SC-007).
- Dates are UTC and date-only (FR-009).
- No raw errors to clients.
- No cache, background job, realtime layer, or migration.
- Student experience, dashboard (008) and analytics (009) untouched (spec Out of Scope).

**Scale/Scope**:
- Phase 1: 2 new backend files (`roster.py`, `tests_roster.py`), 5 edited (`views.py`, `urls.py`,
  `serializers.py`, `pagination.py`, `settings.py`), plus one 3-line rename in `dashboard/service.py`.
- Phases 2–3: 1 new feature module (api, schema, types, 2 hooks, ~9 components), 1 new atom, 1 new molecule,
  2 replaced pages, 1 generic-ified hook.

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0. Re-checked after Phase 1 design; result
unchanged.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ PASS | The response is parsed with a Zod schema and the TS types are **inferred** from it, so they cannot drift. `progress: z.number().nullable()` forces the client to handle the "—" case rather than rendering `0`. `useDebounce` is made generic (`<T>(value: T, …): T`) before its first use, so the debounced term stays a `string` instead of leaking `any` into a query key — it has zero call sites today, so this is free. A malformed payload becomes the error state, never a half-rendered table. No `any`. |
| II. Component-First Architecture | ✅ PASS | Two orchestrators (`CourseStudents`, `InstructorStudents`) own the only query; every other component takes typed props and never fetches. The shadcn table is vendored as an **atom** alongside the other primitives rather than starting a second `ui/` convention, and is restyled onto the house tokens so consumers inherit the project's look. `RosterPagination` is built generically in `molecules/` so 012 and 013 can reuse it. `avatar` and `skeleton` atoms are reused as-is. |
| III. Security-First Development | ✅ PASS | `CookieJWTAuthentication` + `IsAuthenticated` + `isInstructor`. The queryset is built from `course__instructor=<session profile>` outward, so ownership is a filter and not a check that can be forgotten; a client `course` id is resolved against that owned set. Non-owned, missing and malformed course ids return the **same** 404, so the endpoint is not a probe for which courses exist — including the `int()` parse, without which `abc` would 500 and be distinguishable. A staff account with no instructor profile gets a handled 403 with 009's `no_instructor_profile` body, never an `AttributeError` and never a `200` empty page that would read as "no students yet". `GET` only. The payload carries no email, payment or quiz data, asserted over the raw body. ORM only, no raw SQL. A throttle scope caps a runaway client. |
| IV. Testing Discipline | ✅ PASS | `roster.py` gets direct tests for the progress rule (services require unit tests), plus an **agreement test** binding it to the student-facing figure so FR-010 cannot drift. Every FR group has a named test, the refusal set is asserted to be identical across four bad-input shapes, ordering stability under tied timestamps is tested explicitly, and `assertNumQueries(4)` guards the query plan against a `SerializerMethodField` creeping back in. |
| V. Documentation as Code | ✅ PASS | This plan, research, data-model, contract and quickstart. The non-obvious "why"s are commented at the point of use: why progress is computed after pagination, why the ordering needs `-id`, why `get_page_number` is overridden, why the completions query joins through `user__user_id`, and why the client must not build a `Date` from `enrolled_at`. `_conventions.md` gets a short roster/pagination note at implementation, as 007–009 did. The API contract is documented. |

**Result**: PASS, no violations. Complexity Tracking not required.

**Dependency note (not a violation)**: shadcn's `table` is vendored source, not a runtime package; the
constitution names shadcn/ui as the project's component source. It is placed in `components/atoms/` to match
every other shadcn primitive in the repo, not in the `components/ui/` path `components.json` aliases — that
directory is empty and adopting it for one file would fork the convention.

**Migration note**: no model changes, so no migration. An `Enrollment(course, is_active, enrolled_at)` index
was considered and deferred until measured (R4, R7). If it is ever added it will be a new migration only,
per the Hard Rules.

**Backward-compatibility note**: additive. One new path; no existing response, serializer, query key or hook
changes shape. `_person_name` → `person_name` in `dashboard/service.py` is a rename of a private helper with
two call sites in the same file and no output change. The only files whose rendered output changes are the
two `ComingSoon` placeholders spec 003 designated for replacement.

## Project Structure

### Documentation (this feature)

```text
specs/010-instructor-students/
├── plan.md                         # This file
├── spec.md                         # What/why: 5 stories, 38 FRs, 10 SCs
├── research.md                     # Phase 0: owner answers P1–P7, decisions R1–R13
├── data-model.md                   # Phase 1: query plan, row rules, invariants, TS/Zod types
├── quickstart.md                   # Verification walkthrough (owner-run)
├── contracts/
│   └── instructor-students.md      # The endpoint, field rules, errors, consumer contract, test checklist
├── checklists/
│   └── requirements.md             # Specification quality gate
└── tasks.md                        # Phase 2 output (/speckit.tasks, NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/apps/course/
├── roster.py                           # NEW — build_progress_map(); one module, no package (owner)
├── pagination.py                       # EDIT — + StudentRosterPagination (page_size 20, page-1 fallback)
├── serializers.py                      # EDIT — + InstructorStudentSerializer
├── views.py                            # EDIT — + InstructorStudentsView(ListAPIView)
├── urls.py                             # EDIT — + path('instructor/students/', …)
├── dashboard/service.py                # EDIT — _person_name → person_name (rename, 2 call sites, same output)
└── tests_roster.py                     # NEW — APITestCase, the R13 checklist

backend/config/
└── settings.py                         # EDIT — + throttle scope 'instructor_students': '120/min'

front-end/src/
├── components/
│   ├── atoms/table.tsx                 # NEW — shadcn table, moved out of ui/, restyled on house tokens
│   └── molecules/RosterPagination.tsx  # NEW — generic numbered paging; 012/013 can reuse
├── hooks/useDebounce.tsx               # EDIT — (value: any) → generic <T>; zero existing call sites
├── featuers/instructor-students/       # NEW feature module
│   ├── api/instructorStudents.api.ts   # one namespaced axios object, one call
│   ├── schemas/instructorStudents.schma.ts
│   ├── types/instructorStudents.types.ts   # inferred from the Zod schema
│   ├── hooks/
│   │   ├── useInstructorStudents.tsx   # one query hook, courseId optional
│   │   └── useRosterParams.tsx         # search + page in the address (usePeriodParam pattern)
│   ├── components/
│   │   ├── CourseStudents.tsx          # orchestrator — workspace tab
│   │   ├── InstructorStudents.tsx      # orchestrator — sidebar page
│   │   ├── StudentsTable.tsx           # the table; takes showCourse
│   │   ├── StudentRow.tsx
│   │   ├── StudentSearch.tsx           # local state → debounce → URL
│   │   ├── ProgressCell.tsx            # bar + label; renders "—" for null
│   │   ├── RosterSkeleton.tsx
│   │   ├── RosterError.tsx
│   │   └── RosterEmpty.tsx             # no-students / no-matches / no-courses variants
│   └── index.ts
└── app/instructor/
    ├── courses/[courseId]/students/page.tsx   # REPLACE ComingSoon → <Suspense><CourseStudents/></Suspense>
    └── students/page.tsx                      # REPLACE ComingSoon → <Suspense><InstructorStudents/></Suspense>
```

**Structure Decision**: Web application, the layout already established by 003–009. The backend addition sits
in `apps/course/` beside the other instructor reads (`InstructorDashboardView`, `InstructorAnalyticsView`)
rather than in `apps/enrollment/` — the instructor read surface is consolidated there, both of those views
already read `Enrollment` across the app boundary, and the URL family the client talks to is
`courses/instructor/...`. The frontend follows the house feature-module convention verbatim, including the
`featuers` spelling and the `*.schma.ts` suffix.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.
