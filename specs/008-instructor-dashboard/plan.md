# Implementation Plan: Instructor Dashboard — At-a-Glance Summary Landing

**Branch**: `008-instructor-dashboard` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-instructor-dashboard/spec.md`

## Summary

Replace the static instructor home placeholder from spec 003 with a real dashboard: four lifetime tiles
(Courses, Students, Avg rating, Earnings), recent enrollments beside recent reviews, and a ranked "needs
attention" list. Instructors who own no courses see an onboarding checklist instead.

The build has three parts:

1. **One read endpoint, one snapshot.** `GET /courses/instructor/dashboard/` returns everything in a single
   response (clarification Q1). The endpoint takes no parameters, so the only scope is the caller's own
   `InstructorProfile`. Any failure returns `500 {error}` and never a partial snapshot (research R1, R9).
2. **`InstructorDashboardService` in a new `apps/course/dashboard/` package.** Same shape as `publishing/`:
   `dto.py`, `attention.py`, `service.py`, and `__init__.py` as the only import surface. It uses a fixed
   number of queries no matter how many courses there are: one course query that reuses 007's
   `READINESS_PREFETCH` plus a per-course active-student count, then aggregates for students and earnings,
   the existing `get_instructor_rating()`, and two `LIMIT 5` reads (R5). Needs attention is a pure function
   over 007's `ReadinessReport`s. It sorts courses into the four types, keeps the most severe type per course,
   and ranks them by the Q2 rule, so the dashboard never defines its own readiness rules (R3, R4).
3. **A new `featuers/instructor-dashboard/` frontend module.** The response is validated with Zod. The query
   uses `staleTime: 0, gcTime: 0` so every visit shows fresh data. One orchestrator component chooses
   exactly one state: skeleton, no-profile, page error with Retry, onboarding, or full dashboard (R11, R12).

**No database migration and no new dependency.** Every value is computed on read from existing tables
(data-model §2–3).

Three findings shape the build:

- **The existing student counters can't be used.** `InstructorProfile.students_count` and
  `Course.subscribers_count` go up by one per enrollment, so they count enrollments rather than people.
  FR-005 needs distinct people, so the service computes an exact `COUNT(DISTINCT user)` instead (R5).
- **Cache invalidation is the wrong tool for keeping it fresh.** The global `staleTime` is 5 minutes, and the
  dashboard depends on nearly every instructor mutation from 004–007, which invalidate four different key
  prefixes. Rather than wire the dashboard key into all of them, the query refetches on every mount and
  drops its cache on unmount. It is one request per visit, it can never go stale, and no existing hook
  changes (R11).
- **Checking for a failed video adds no queries.** Readiness already reports failed videos as the
  `lecture_video_failed` blocker, with its lecture as the target. The failed-video type reads that blocker
  directly instead of querying lectures again, so "failed" has a single definition (R3).

### Phasing

- **Phase 1 (backend): snapshot, ranking, tests.** The `dashboard/` package, `InstructorDashboardView`, the
  route, the `instructor_dashboard` throttle rate, and `tests_dashboard.py`. It can be verified end to end
  with an HTTP client, and shipping it alone breaks nothing because the 003 placeholder keeps rendering.
- **Phase 2 (frontend): the dashboard.** The feature module, the Zod schema, the hook, the components, and
  the swap on `app/instructor/page.tsx`.

## Technical Context

**Language/Version**: Python 3 / Django 6.0 + DRF backend; TypeScript 5 (Next.js 16 / React 19) frontend
**Primary Dependencies**:
- Backend: DRF `APIView`, `ScopedRateThrottle`, ORM `Count(distinct=True)` / `Count(filter=Q)` / `Sum`,
  `select_related`, `prefetch_related`, frozen `dataclasses`, and the 007 `PublishReadinessService` +
  `READINESS_PREFETCH`, plus the existing `get_instructor_rating`.
- Frontend: TanStack Query `useQuery`, Zod, the existing atoms (`skeleton`, `avatar`, `button`,
  `StarRating`), `lucide-react`, `next/link`.

**No new dependency in either tier.**
**Storage**: PostgreSQL, **no migration**. Reads `Course`, `Section`/`Lecture`/`Quiz`/`Question`/`Choice`
(through the readiness prefetch), `Enrollment`, `Order`, `Review`, `InstructorProfile`, and `CustomUser`.
**Testing**: Django `APITestCase` in `backend/apps/course/tests_dashboard.py`, run with a module label. It
reuses fixtures from `apps/course/tests.py` and `apps/course/tests_publishing.py`, pure unit tests cover the
attention ranking, and `assertNumQueries` pins the query count. No test touches Cloudinary or Stripe. The
frontend gates are `tsc` and lint, and the user runs the browser checks with quickstart.md.
**Target Platform**: Responsive web (the instructor shell, desktop-first, down to 375px)
**Project Type**: Web application (Next.js frontend + Django REST backend)
**Performance Goals**: The query count is constant regardless of course count (about 11 queries, pinned by a
test). The response is bounded: 2 lists of at most 5 and at most 5 attention items. It stays in the shell's
normal response budget at 50 courses, 10,000 enrollments and 2,000 reviews (SC-011).
**Constraints**:
- Ownership comes only from the session profile, and the endpoint reads no parameters (FR-030).
- Snapshot all-or-nothing (FR-026 – FR-028).
- Readiness taken only from 007 (FR-014).
- No email in the response (FR-012).
- Read-only (FR-033).
- No raw errors reach clients (FR-029).
- No cache, queue, realtime layer, or migration.
- The student experience and other instructor surfaces are untouched (FR-035).

**Scale/Scope**:
- Phase 1: 4 new files in `dashboard/`, 3 edited backend files (`views.py`, `urls.py`, `settings.py`), and
  1 new test module.
- Phase 2: 1 new feature module (api, schema, types, hook, and 9 components) and 1 edited page.

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0. Re-checked after Phase 1 design; result
unchanged.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ PASS | The response is parsed with a Zod schema and TS types are **inferred from it**, so the runtime check and the static type can't drift. The Zod parse also does real work: a malformed or partial payload becomes the error state rather than rendering `undefined` as `0` or as "all caught up" (FR-027). `AttentionType` is a string-literal union and `attentionHref()` switches over it with a `never` default. There is no `any`, and backend DTOs are frozen dataclasses. |
| II. Component-First Architecture | ✅ PASS | Nine components with explicit prop interfaces. The orchestrator `InstructorDashboard` owns the only query, and the presentational components (`SummaryTiles`, `RecentEnrollments`, `RecentReviews`, `NeedsAttentionList`, `OnboardingChecklist`, `DashboardSkeleton`, `DashboardError`, `NoInstructorProfileState`) take typed props and never fetch. They reuse the `skeleton`, `avatar`, `button` and `StarRating` atoms, and no new atom is needed. |
| III. Security-First Development | ✅ PASS | `CookieJWTAuthentication` with `IsAuthenticated` + `isInstructor`, the same gate as every instructor endpoint. The endpoint accepts **no identifiers**, and the service receives only the resolved profile, so there's nothing to tamper with. Every query filters on that profile. A staff account without a profile gets a clean `403` with a machine code, never an `AttributeError`. `email` is never serialised, and the new throttle scope caps the heaviest instructor read. ORM only, no raw SQL. |
| IV. Testing Discipline | ✅ PASS | `tests_dashboard.py` covers the service (required for services) and the full HTTP path. Every metric definition, attention type, ordering rule, access refusal, and the all-or-nothing failure get a test each (contract checklist). Pure unit tests pin the ranking, and `assertNumQueries` guards against an N+1. |
| V. Documentation as Code | ✅ PASS | This plan plus research, data-model, contract, and quickstart. The non-obvious reasons are commented where the code does them: why students aren't read from the denormalised counters, why failed videos come from the readiness report, why the query drops its cache instead of relying on invalidation, and why money is a decimal string. `_conventions.md` / `_overview.md` get a short dashboard section at implementation, as 007 did. |

**Result**: PASS, no violations. Complexity Tracking isn't required.

**Migration note (not a violation)**: The constitution says "Backend changes affecting models MUST include
migration files." No model changes, so no migration is created. Indexes for enrollment reads were considered
and deferred (research R5).

**Backward-compatibility note**: The change is additive only. It adds one new endpoint, and no existing
response, serializer, or query key changes. The only existing file whose rendered output changes is
`app/instructor/page.tsx`, which is the placeholder spec 003 designated for replacement (003 FR-013).

## Project Structure

### Documentation (this feature)

```text
specs/008-instructor-dashboard/
├── plan.md                        # This file
├── spec.md                        # What/why — 5 stories, 36 FRs (+FR-017a), 12 SCs, 11 clarifications
├── research.md                    # Phase 0 — R1–R13 decisions
├── data-model.md                  # Phase 1 — derivations, DTOs, attention classification, invariants
├── quickstart.md                  # Verification walkthrough
├── contracts/
│   └── instructor-dashboard.md    # GET /courses/instructor/dashboard/ + consumer contract + test checklist
├── checklists/
│   └── requirements.md            # Specification quality gate
└── tasks.md                       # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/apps/course/
├── dashboard/                         # NEW package — same shape as publishing/ and video/
│   ├── __init__.py                    # public surface: InstructorDashboardService, DTOs
│   ├── dto.py                         # PersonRef, CourseRef, RecentEnrollment, RecentReview, AttentionTarget,
│   │                                  #   AttentionItem, NeedsAttention, OnboardingProgress, DashboardSnapshot
│   │                                  #   (frozen dataclasses) + to_dict() for the wire shape
│   ├── attention.py                   # classify(course, report, active_students) / rank(items) — pure,
│   │                                  #   reads only ReadinessReport (R3, R4)
│   └── service.py                     # InstructorDashboardService.build(profile) — the fixed query plan (R5),
│                                      #   metric definitions (R6), onboarding flags
├── views.py                           # + InstructorDashboardView(APIView): auth, isInstructor, throttle_scope,
│                                      #   no-profile 403 with code, logged 500 on any failure (R8, R9)
├── urls.py                            # + path('instructor/dashboard/', ...)
└── tests_dashboard.py                 # NEW — contract test checklist + pure ranking tests + query-count bound

backend/config/
└── settings.py                        # + DEFAULT_THROTTLE_RATES['instructor_dashboard'] = '60/min'

front-end/src/featuers/instructor-dashboard/       # NEW feature module
├── api/instructorDashboard.api.ts                 # instructorDashboardAPI.getSnapshot() — GET + Zod parse
├── schemas/instructorDashboard.schma.ts           # DashboardSnapshotSchema (house `.schma.ts` spelling)
├── types/instructorDashboard.types.ts             # z.infer types, AttentionType, attentionHref(), formatMoney()
├── hooks/useInstructorDashboard.tsx               # ['instructor','dashboard'], staleTime 0, gcTime 0,
│                                                  #   refetchOnMount 'always' (R11)
├── components/
│   ├── InstructorDashboard.tsx                    # orchestrator: pending / no-profile / error / onboarding / full
│   ├── DashboardHeader.tsx                        # greeting + "Create course" (FR-002)
│   ├── SummaryTiles.tsx                           # 4 tiles, secondary lines, "Not yet rated" (FR-004–FR-008)
│   ├── RecentEnrollments.tsx                      # list + empty state (FR-009, FR-011, FR-012)
│   ├── RecentReviews.tsx                          # StarRating, clamped excerpt, empty state (FR-010, FR-011)
│   ├── NeedsAttentionList.tsx                     # typed badges, links, total + "View all", all caught up
│   │                                              #   (FR-013–FR-019)
│   ├── OnboardingChecklist.tsx                    # 5 derived steps + primary CTA (FR-020–FR-024);
│   │                                              #   supersedes the static steps in app/instructor/page.tsx
│   ├── DashboardSkeleton.tsx                      # layout-matching skeleton, no zeros (FR-026)
│   ├── DashboardError.tsx                         # page-level error + Retry (FR-027)
│   └── NoInstructorProfileState.tsx               # handled state for code 'no_instructor_profile' (FR-032)
└── index.ts                                       # public exports

front-end/src/app/instructor/
└── page.tsx                                       # renders <InstructorDashboard /> in place of the 003 placeholder
```

**Structure Decision**: Web application.

- **Backend**: a new `dashboard/` subpackage in `apps/course`, the same move `publishing/` and `video/`
  made. It sits beside `publishing/` because needs attention is built on it, and `views.py` already imports
  from the enrollment app. The view is an `APIView` rather than a viewset `@action`, because the dashboard has
  no single owning row (the conventions doc's rule), so ownership is applied in the service's queries. No new
  app and no new model.
- **Frontend**: a **new** `featuers/instructor-dashboard/` module, named in discovery §14.3. It isn't an
  extension of `instructor-courses` because the dashboard reads enrollments, orders, and reviews across
  courses and owns a page. 007 was a property of one course; this is not.
- **Unchanged hooks**: no existing hook, query key, or component is modified. Freshness comes from the
  dashboard query's own refetch policy, not from edits to 004–007 mutations.

## Complexity Tracking

No constitution violations, so the table is omitted. Two choices could look like extra complexity, and both
are argued in research:

- **A separate `attention.py` for about 40 lines of ranking** (R3): it keeps the Q2 ordering rules testable
  without a database.
- **Dropping the query cache instead of invalidating it** (R11): it trades one request per visit for never
  having to touch the mutation hooks from earlier specs.
