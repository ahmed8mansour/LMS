# Research: Instructor Dashboard — At-a-Glance Summary Landing

**Feature**: `008-instructor-dashboard` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

Every decision below was taken against the code as it stands on this branch (after 007). Each entry records
the decision, why, and what was rejected. No `NEEDS CLARIFICATION` remains.

---

## R1 — One read endpoint returning the whole snapshot

**Decision**: A single `GET /courses/instructor/dashboard/` returns the entire dashboard — tiles, recent
enrollments, recent reviews, needs attention, onboarding state, and the display mode — in one response.

**Rationale**: Clarification Q1 (2026-09-15) fixed the dashboard as *one consistent snapshot, all-or-nothing*
(FR-026 – FR-028). One request is the only shape where "all sections describe the same moment" is true by
construction rather than by coordination: every value is read in the same request against the same data. It
also matches the discovery document's single `dashboard/summary` endpoint (§13.2), and makes the error state
trivially all-or-nothing on the client — one query, one `isError`.

**Alternatives considered**:
- *One endpoint per section* — rejected by Q1; it also makes the tiles and the needs-attention list able to
  disagree (a course published between two requests is counted in one and not the other).
- *Compose the dashboard client-side from existing endpoints* (`instructor/courses/` for counts and
  readiness, plus the public review endpoints) — rejected: there is no instructor-scoped enrollment or earnings
  read at all, the public review endpoint is per-course (N requests), and distinct-student counting cannot be
  done from any existing payload.

---

## R2 — Where the endpoint and its logic live

**Decision**: A new `backend/apps/course/dashboard/` subpackage (`__init__.py`, `dto.py`, `attention.py`,
`service.py`) holding `InstructorDashboardService`; a thin `InstructorDashboardView(APIView)` in
`apps/course/views.py`; the route `instructor/dashboard/` in `apps/course/urls.py`, beside the other
`instructor/*` routes.

**Rationale**:
- The conventions doc (007 section) prescribes exactly this shape for domain logic — a subpackage with
  `dto.py`, a service, and an `__init__.py` as the only import surface; views resolve, delegate, serialize.
  `publishing/` and `video/` already live in `apps/course/`.
- The dashboard's hardest logic — needs attention — is built on `PublishReadinessService` and
  `READINESS_PREFETCH` from `apps/course/publishing/`. Keeping the dashboard in the same app keeps that
  dependency a sibling import.
- `apps/course/views.py` already imports `Enrollment` from the enrollment app, so reading enrollments,
  orders, and reviews from here adds no new direction of coupling.
- The `/courses/instructor/...` URL prefix is where the whole instructor API family already lives, and where
  the discovery doc placed this endpoint.
- **`APIView`, not a viewset `@action`**: the conventions doc says prefer `@action` for an operation on one
  row a viewset already scopes, and keep `APIView` for endpoints with *no owning row*. The dashboard spans all
  of an instructor's courses; there is no single row to resolve, so ownership is applied in the service's
  queries (R8).

**Alternatives considered**:
- *A new `apps/instructor` Django app* — rejected: an app with no models, registered only to host one read
  view, is structure without content; the discovery doc's later insight specs (009, 010) can revisit this if
  the instructor read surface grows.
- *`@action(detail=False)` on `InstructorCourseViewSet`* (`instructor/courses/dashboard/`) — rejected: it
  would inherit that viewset's per-request `get_queryset()` and throttling branch for an endpoint that is not
  about the course collection, and the URL would read as a course-list sub-resource.
- *Logic inline in the view* — rejected by the thin-views convention; the ranking rules need unit tests
  independent of HTTP.

---

## R3 — Needs attention is a pure function over readiness reports

**Decision**: `attention.py` exposes a pure classification + ranking over already-evaluated data:
`classify(course, report, active_students) -> AttentionItem | None` and `rank(items) -> list[AttentionItem]`.
Classification, per course, first match wins:

| Rank | Type | Condition |
|------|------|-----------|
| 1 | `live_needs_attention` | `report.needs_attention` (published and not publishable) |
| 2 | `video_failed` | draft, and at least one blocker with code `lecture_video_failed` |
| 3 | `ready_to_publish` | draft and `report.is_publishable` |
| 4 | `draft_in_progress` | draft and not publishable |
| — | *(none)* | published and publishable |

**Rationale**:
- FR-014 requires the dashboard to use 007's verdict, never its own rules. Every condition above reads the
  `ReadinessReport` — including the failed-video check, which reads the existing `lecture_video_failed`
  blocker code and its `target` rather than re-walking lectures. There is one definition of a failed video,
  and it is 007's.
- A published course with a failed video necessarily has a `lecture_video_failed` blocker, so it is already
  rank 1; `video_failed` therefore only ever applies to drafts. That makes "each course appears once, under
  its most severe issue" (FR-013) fall out of first-match classification with no de-duplication step.
- Processing videos produce `lecture_video_processing`, which `video_failed` does not match — FR-016 holds by
  construction. (A draft whose only blocker is a processing video is still `draft_in_progress`, which is
  truthful: it is not publishable yet.)
- Pure functions over DTOs make the ordering rules (Q2) testable without a database.

**Alternatives considered**:
- *Store a `needs_attention` flag on `Course`* — rejected by FR-014/FR-023 and 007's "computed verdicts, not
  stored flags" convention; it would drift the moment a video is deleted.
- *Query failed lectures separately* (`Lecture.objects.filter(video_status='FAILED', ...)`) — rejected: a
  second definition of "failed", plus an extra query, for information the report already carries.

---

## R4 — Ordering within a type (clarification Q2)

**Decision**: Sort key, ascending:
`(rank, secondary, -created_at_timestamp, -course_id)` where `secondary` is
- `-active_students` for `live_needs_attention` and `video_failed`,
- `blocker_count` for `draft_in_progress`,
- `0` for `ready_to_publish` (falls through to newest-first).

Return the first 5 items plus `total` = number of classified items.

**Rationale**: Encodes Q2 exactly. `-course_id` is added as a final tiebreak because `created_at` is not
unique; FR-017a requires the same data to always yield the same five items, and without a unique final key two
courses created in the same instant could swap between requests.

**Alternatives considered**: Sorting in the database — rejected: rank and blocker count are computed in Python
from readiness reports, so the ordering cannot be expressed as an `ORDER BY`. At SC-011's scale (≤ 50 courses)
an in-memory sort is negligible.

---

## R5 — Query plan: bounded query count, independent of course count

**Decision**: The service issues a fixed number of queries regardless of how many courses the instructor owns:

| # | Purpose | Query |
|---|---------|-------|
| 1 | Instructor profile | `request.user.instructor_profile` (already needed for ownership) |
| 2–6 | Courses + readiness relations + per-course active students | `Course.objects.filter(instructor=profile).annotate(active_students=Count('enrollment', filter=Q(enrollment__is_active=True))).prefetch_related(*READINESS_PREFETCH)` — 1 course query + the prefetch queries 007 already uses |
| 7 | Distinct students + active enrollment count | `Enrollment.objects.filter(course__instructor=profile, is_active=True).aggregate(students=Count('user', distinct=True), enrollments=Count('id'))` |
| 8 | Earnings | `Order.objects.filter(course__instructor=profile, status='paid').aggregate(total=Sum('amount'))` |
| 9 | Rating | existing `get_instructor_rating(profile)` |
| 10 | Recent enrollments | `Enrollment ... is_active=True ... select_related('user', 'course').order_by('-enrolled_at', '-id')[:5]` |
| 11 | Recent reviews | `Review.objects.filter(course__instructor=profile).select_related('user__user', 'course').order_by('-created_at', '-id')[:5]` |

Course counts (total, published) and all onboarding flags are derived from query 2's result set in Python.

**Rationale**:
- SC-011 (50 courses / 10,000 enrollments / 2,000 reviews) is met by aggregates and `LIMIT 5` reads, not by
  loading rows. The only per-course work is readiness, which 007 already made zero-extra-query via
  `READINESS_PREFETCH` — reusing that exact tuple is the documented convention ("share the tuple").
- One `Count` annotation on the course query is safe: a single join to `enrollment` cannot multiply
  another aggregate. (Adding a second reverse-relation `Count` to the same query would inflate both —
  the reason students and earnings are separate aggregate queries rather than more annotations.)
- A test pins the bound with `assertNumQueries` for 1 course and for 10 courses, so a future N+1 fails
  loudly.

**Alternatives considered**:
- *Reuse `InstructorProfile.students_count`* — rejected (spec Assumptions): `FulfillmentFacade` increments it
  per enrollment, so it counts enrollments, not distinct people, and FR-005 needs distinct people.
- *Reuse `Course.subscribers_count` for per-course active students* — rejected: same per-enrollment
  increment semantics, and it is a denormalised counter whose refund handling this feature would be trusting
  rather than verifying. The annotation is exact and costs nothing extra.
- *Caching the snapshot* — rejected: FR-025 requires current data on each open, and no cache infrastructure
  exists. Spec Assumptions: computed on read at current scale.
- *New indexes* (e.g. `Enrollment(course, enrolled_at)`) — deferred: they would require a migration the spec
  does not need at SC-011 scale. Recorded as a future option if 009/010 add heavier enrollment reads.

---

## R6 — Metric definitions pinned to model fields

**Decision**:

| Spec term | Definition in data |
|-----------|--------------------|
| Courses total / published (FR-004) | `Course.instructor == profile`; published = `is_published=True` |
| Students (FR-005) | `COUNT(DISTINCT Enrollment.user)` where `course.instructor == profile` and `is_active=True` |
| Enrollments secondary (FR-005, Q3) | `COUNT(Enrollment.id)` over the same filter |
| Avg rating (FR-006) | `get_instructor_rating(profile)` verbatim (published courses only); `avg_rating: null` ⇒ "Not yet rated" |
| Earnings (FR-007) | `SUM(Order.amount)` where `course.instructor == profile` and `status='paid'`; `NULL` ⇒ `0.00` |
| Active students per course (R4) | `COUNT(Enrollment)` where `course == c` and `is_active=True` |

**Rationale**:
- Refunds: `FulfillmentFacade` sets the order to `refunded` and the enrollment to `is_active=False` in the
  same flow, so both the Earnings and Students filters exclude a refund without extra logic (spec US-1 #3).
- Free courses create an enrollment with a zero-amount order, so they count toward Students and add `0` to
  Earnings (US-1 #6).
- Pending and failed orders are excluded by `status='paid'` and never produce enrollments.
- Unpublishing leaves enrollments active and orders paid (007 FR-031), so a formerly published course still
  contributes to Students and Earnings — the spec edge case — with no special handling.
- The rating reuses the public profile's function rather than a copy, so SC-003 (home and public profile
  never differ) is guaranteed structurally.

---

## R7 — Response and money representation

**Decision**:
- Money is returned as a **decimal string** with two places (`"8940.00"`) plus a `currency` code (`"USD"`),
  matching how DRF already serialises `Decimal` fields across this API (`price`, `rating` are strings in
  `InstructorCourse`). The client formats with `Intl.NumberFormat` in full (`$8,940.00`), not compact
  (`$8.9k`) — money on a tile should be exact.
- Timestamps are ISO-8601 strings, as elsewhere.
- Display names are resolved server-side: `"{first_name} {last_name}".strip()`, falling back to `username`.
  Avatars are `profile_picture` or `null` (client falls back to initials). Email is never serialised
  (FR-012).
- Review text is returned whole (`comment`, already capped at 2,000 characters by the review serializer) and
  truncated on the client with a line clamp. Five comments is a bounded payload, and truncating on the server
  would cut mid-word or mid-grapheme and bake presentation into the contract.

**Rationale**: Consistency with existing payloads; no float rounding of money; privacy by omission.

---

## R8 — Authorization and the no-profile path

**Decision**:
- `authentication_classes = [CookieJWTAuthentication]`, `permission_classes = [IsAuthenticated, isInstructor]`
  — the same gate as every instructor endpoint. Students and anonymous callers are refused by DRF before the
  view runs (FR-031).
- The view resolves `request.user.instructor_profile`; on `InstructorProfile.DoesNotExist` it returns
  **`403 {"error": "No instructor profile is associated with this account.", "code": "no_instructor_profile"}`**
  (FR-032). The additive `code` follows 007's "refusals carry machine-readable detail" convention so the
  client renders a handled state by switching on `code`, not on message text.
- Every query in the service filters by that resolved profile; the service accepts only the profile, never a
  client-supplied id. The endpoint takes **no parameters** — there is nothing to tamper with (FR-030).

**Alternatives considered**: `404` via an empty result (007's approach for course actions) — rejected here:
007 returned 404 because a *specific course* was not found; the dashboard has no addressed resource, and an
empty-looking snapshot for a profile-less account would render as a real dashboard of zeros, violating FR-027.

---

## R9 — All-or-nothing failure (clarification Q1)

**Decision**: The view wraps the service call; any unexpected exception is logged with `logger.exception`
(server-side stack trace only) and returns `500 {"error": "We couldn't load your dashboard. Please try again."}`.
No partial snapshot is ever serialised. The client treats any non-success (other than the
`no_instructor_profile` code) as the single page-level error with Retry.

**Rationale**: FR-027/FR-028/FR-029 and SC-009. The service builds the whole DTO before the view serialises
anything, so a failure in readiness evaluation for one course cannot leak a half-built response.

---

## R10 — Throttling

**Decision**: A dedicated scope `instructor_dashboard` at **60/min**, set as `throttle_scope` on the view
class (an `APIView`, so class-level scope is correct here — unlike the viewset case in 007 R10).

**Rationale**: The project's `DEFAULT_THROTTLE_CLASSES` is `ScopedRateThrottle`, which does nothing for a view
without a scope. The dashboard is the heaviest instructor read (readiness over every course plus aggregates),
so it gets a churn ceiling. 60/min is far above human use (one load per navigation, Retry clicks) — a ceiling
against a runaway client loop, not a security boundary.

---

## R11 — Frontend: new feature module, validated response, always-fresh query

**Decision**:
- New module `front-end/src/featuers/instructor-dashboard/` (`api`, `schemas`, `types`, `hooks`,
  `components`, `index.ts`), as the discovery doc's §14.3 names it. `app/instructor/page.tsx` renders its
  `InstructorDashboard` component in place of the 003 placeholder.
- The response is parsed with a **Zod schema** (`instructorDashboard.schma.ts`) in the API function, with TS
  types inferred from it.
- `useInstructorDashboard()` → `useQuery({ queryKey: ['instructor', 'dashboard'], staleTime: 0, gcTime: 0,
  refetchOnMount: 'always' })`.

**Rationale**:
- *Separate module*: unlike 007 (a property of one course, extended `instructor-courses`), the dashboard reads
  enrollments, orders, and reviews across courses and owns a page. Discovery §14.3 lists
  `featuers/instructor-dashboard/` explicitly.
- *Zod on the response*: Constitution I requires runtime validation of API responses, and here it is load-
  bearing for FR-027 — a malformed or partial payload fails the parse and becomes the error state instead of
  rendering `undefined` as `0` or an empty needs-attention list as "all caught up".
- *Always-fresh query*: the global `staleTime` is 5 minutes, so a default query would show a snapshot up to
  5 minutes old after the instructor publishes a course — violating FR-025/SC-007. Invalidation was considered
  and rejected: the dashboard depends on nearly every instructor mutation (course create/update/delete,
  publish, section/lecture/quiz/question/choice, video upload/delete), and those hooks invalidate four
  different prefixes; wiring the dashboard key into each couples every past and future instructor hook to this
  page, and one missed hook is a silent stale dashboard. `gcTime: 0` drops the cached snapshot when the page
  unmounts, so returning always shows the skeleton and then fresh data — never a stale snapshot that visibly
  changes a moment later. The cost is one request per visit, which is exactly FR-025's "current data each
  time it is opened".

**Alternatives considered**:
- *Key under `['instructor', 'course', ...]` to ride existing invalidations* (the 007 readiness trick) —
  rejected: course create/delete/update invalidate `['instructor', 'courses']`, a different prefix, so it would
  still miss cases.
- *`staleTime: 0` with cache retained* — rejected: shows the old snapshot on return, then swaps numbers in
  place; a "fixed" item would visibly reappear then vanish.

---

## R12 — Frontend states and component decomposition

**Decision**: `InstructorDashboard` (orchestrator) resolves exactly one of:
1. `isPending` → `DashboardSkeleton` (layout-matching; no zeros, no empty messages — FR-026);
2. error with `code === 'no_instructor_profile'` → `NoInstructorProfileState`;
3. any other error → `DashboardError` with Retry (`refetch`) — FR-027;
4. `mode === 'onboarding'` → `OnboardingChecklist`;
5. `mode === 'full'` → `DashboardHeader`, `SummaryTiles`, `RecentEnrollments` + `RecentReviews`,
   `NeedsAttentionList`.

Presentational components take typed props and never fetch. Reused: `StarRating`, `avatar`, `skeleton`,
`button` atoms; `lucide-react` icons; house tokens (`darktext`, `graytext2`, `darkmint`, `lightbg`,
`darkbg`). Link targets come from an exhaustive `attentionHref(item)` switch over `AttentionType` with a
`never` default (007 convention) so a new backend type is a `tsc` error, not a dead link. Onboarding links:
profile step → `/instructor/settings` (003 placeholder until spec 011, FR-024); steps 2–5 →
`/instructor/courses/new`.

**Rationale**: One query means one state machine; keeping it in a single orchestrator makes the
"never render a partial or misleading snapshot" rule reviewable in one place.

---

## R13 — Testing strategy

**Decision**: Backend `backend/apps/course/tests_dashboard.py` (Django `APITestCase`), reusing
`make_instructor` / `make_course` from `apps/course/tests.py` and `make_ready_course` / `break_one` from
`apps/course/tests_publishing.py`. Run with module labels
(`manage.py test apps.course.tests_dashboard`) per the conventions doc. Coverage:

- **Tiles**: multi-course student counted once; enrollments secondary counts each; refunded enrollment and
  refunded order excluded; free course counts students, adds 0 earnings; pending/failed orders excluded;
  unpublished course still contributes; rating equals `get_instructor_rating`; no reviews ⇒ `null`.
- **Needs attention**: each of the four types; published+healthy absent; processing-only absent; a course
  with multiple issues appears once at the most severe; within-type ordering (students desc, blockers asc,
  newest first, id tiebreak); cap of 5 with correct `total`; single vs multiple failed lectures target.
- **Recent lists**: newest first, cap 5, inactive enrollments excluded, other instructors' rows excluded, no
  email key anywhere in the response.
- **Mode/onboarding**: zero courses ⇒ `onboarding`; one draft ⇒ `full`; profile step reflects title+about.
- **Access**: student 403, anonymous 401/403, staff without profile 403 with `code`, instructor A never sees
  B's data.
- **Resilience**: readiness raising ⇒ 500 `{error}` with no partial keys.
- **Performance**: `assertNumQueries` equal for 1 and 10 courses.
- **Pure unit tests** for `attention.classify` / `attention.rank` without the database.

Frontend: `tsc` + lint gates; component tests are SHOULD-level per Constitution IV and are not added for
presentational components. Browser verification is performed by the user (project memory), guided by
quickstart.md.
