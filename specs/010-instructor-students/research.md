# Research: Instructor Student Roster

**Feature**: 010-instructor-students | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

This document records the decisions taken before implementation. The owner supplied an API sketch and
reviewed a critique of it; the answers below (**P1–P7**) are fixed inputs, and **R1–R13** are the decisions
derived from them.

---

## Owner decisions (fixed inputs)

| # | Question | Answer |
|---|----------|--------|
| **P1** | `progress` as a fraction (`.71`) or a percent? | **Percent**, matching `progress/utils.py` (`70.0`). A sibling endpoint already ships `progress` as a percent; two meanings for one key is a bug waiting to happen. |
| **P2** | What is `id` on a row? | **The enrolment id.** The student id repeats across rows in the all-courses scope (duplicate keys, silent dedupe) and is not needed by the client. |
| **P3** | `ReadOnlyModelViewSet`? | **No — `ListAPIView`.** `retrieve` is out of scope, and `ListAPIView` is the only class that gives `PageNumberPagination` + `SearchFilter` for free, which is the reason both were chosen. |
| **P4** | URL prefix | The sketch's `/instructor/...` was shorthand for the idea. Real paths carry the app's `courses/` prefix. |
| **P5** | Pagination style | **`PageNumberPagination`.** Not cursor, not limit/offset. |
| **P6** | One endpoint or two? | **One**, with an optional `course` filter serving both scopes. |
| **P7** | Table component | **shadcn table**, restyled with the project's own tokens. |

---

## R1 — One endpoint, two scopes

**Decision**: `GET /courses/instructor/students/?course=<id>&search=<term>&page=<n>`.
`course` present → one course's roster (the workspace Students tab). `course` absent → every owned course
(the sidebar Students page).

**Rationale** (P6): the two scopes differ only in one `WHERE` clause. One endpoint means one view, one
serializer, one paginator, one search configuration and one test module; two endpoints would duplicate all of
them and let the two drift. The ownership rule is three lines either way.

**Alternatives considered**:
- *Two endpoints* (`.../courses/{id}/students/` + `.../students/`) — matches the `{Role}{Entity}` URL habit and
  reads better, but the per-course half wants to be an `@action` on `InstructorCourseViewSet`, and an
  `@action` fights this feature: `self.filter_queryset` would apply the **course** filter backends, and the
  viewset's paginator is not this feature's. Both would have to be hand-wired, losing exactly what
  `ListAPIView` gives free. Rejected.
- *`@action(detail=True)` for per-course only* — the ownership 404 is free (009 uses this for analytics), but
  see above; and it cannot serve the aggregate scope at all.

**Consequence**: the aggregate scope is the default. A bug that drops the `course` parameter widens the
result rather than narrowing it — still ownership-scoped and never another instructor's data, but the view
must be tested with the parameter absent, present-and-owned, present-and-not-owned, and present-and-garbage.

---

## R2 — `ListAPIView`, and where it lives

**Decision**: `InstructorStudentsView(ListAPIView)` in `backend/apps/course/views.py`, routed at
`courses/instructor/students/` in `backend/apps/course/urls.py`.

**Rationale**: the instructor read surface is consolidated in `apps/course/` — `InstructorDashboardView` (008)
and `InstructorAnalyticsView` (009) are both plain views there, and both already read `Enrollment` across app
boundaries. Putting the roster in `apps/enrollment/` would split the instructor surface across two apps for no
gain, and would not match the `courses/instructor/...` URL family the client already talks to.

**No new package.** 008 built `dashboard/` and 009 built `analytics/` because each had real aggregation logic
worth isolating. This feature has one non-trivial function (the progress map). It goes in a single new module,
`backend/apps/course/roster.py`, with no classes, no DTOs and no service object — per the owner's direction,
and because a package here would be ceremony around eight lines.

---

## R3 — Ownership, the `course` parameter, and identical refusals

**Decision**: build the queryset from ownership outward, never from the client's id inward.

```
base = Enrollment.objects.filter(course__instructor=<caller's profile>, is_active=True)
```

When `course` is supplied it is **resolved first** against the owned set, and anything that fails resolution
is a **404**:

| `?course=` | Outcome |
|---|---|
| absent | aggregate scope |
| an owned course's id | filtered to that course |
| another instructor's course id | **404** |
| a non-existent id | **404** (identical) |
| `abc`, `-1`, `0`, `1e5`, empty | **404** (identical) |

**Rationale**: FR-031 forbids trusting a client-supplied course id, FR-032 requires the refusal for a
non-owned course to be indistinguishable from one for a missing course, or the endpoint becomes a probe for
which course ids exist. Resolving through `Course.objects.filter(instructor=me, id=…)` collapses both cases
into one `DoesNotExist` naturally.

**The garbage-input case is not free.** `get_object_or_404(Course, id='abc')` raises `ValueError` before it
raises `Http404` — a 500, and a different response than the owned/not-owned cases, which is itself a signal.
The parameter is parsed explicitly (`int()` in a `try`, reject `< 1`) and a failure returns the same 404.

**No instructor profile** (FR-034): `request.user.instructor_profile` raises `InstructorProfile.DoesNotExist`
for a staff account that has no profile. `list()` catches it and returns **`403`** with
`{"error": ..., "code": "no_instructor_profile"}` — the same body 009's aggregate view returns, so the
client's existing `NoInstructorProfileState` handles it.

*Revised during implementation.* This originally said "an empty queryset, so the caller gets an empty page".
That was wrong on three counts: the spec word is "refusal", 009 already answers this case with a 403 the
frontend is wired for, and — decisively — a `200` with no rows already means "you have no students yet", so
an empty page would make a broken account indistinguishable from a brand-new instructor, which is the exact
confusion FR-029 exists to prevent.

---

## R4 — Page-number pagination: drift, and the first-page fallback

**Decision**: a `StudentRosterPagination(PageNumberPagination)` with `page_size = 20` and **no**
`page_size_query_param`.

**Rationale** (P5): the paging control states "21–40 of 318" (FR-022), which needs a total. `CursorPagination`
cannot produce one, so numbered pages require offsets. Page size is fixed on the server by FR-021, which is
why this paginator — unlike `ReviewPageNumberPagination` and `BillingPageNumberPagination` — does not expose
`page_size_query_param`.

**Accepted cost — page drift.** Offset pagination is unstable under concurrent writes, and this ordering makes
it worse than usual: rows are newest-first, so a new enrolment inserts at the *top* and shifts every later row
down one. Anyone who is on page 1 when an enrolment lands sees its last row again as the first row of page 2.
This is not a narrow race; it happens on any course that is actively selling. It is accepted: it is the price
of numbered pages, the spec's edge cases already acknowledge it, and a refresh resolves it. SC-003 is scoped
to "an unchanged roster".

**Also accepted**: DRF issues `COUNT(*)` and the page query separately, so under concurrent writes `count` can
disagree with the rows — "1–20 of 318" when there are now 319. Cosmetic.

**Not accepted — DRF's out-of-range behaviour.** `PageNumberPagination` raises `NotFound` for `?page=999` past
the end and for `?page=abc`, producing a **404**. FR-024 requires a silent fall back to the first page. The
paginator overrides `get_page_number()` rather than catching `NotFound` afterwards (`request.query_params` is
an immutable `QueryDict`, so the page cannot be rewritten after the fact):

```
non-numeric        → 1
< 1                → 1
> paginator.num_pages → 1
otherwise          → the number
```

`num_pages` is 1 even for an empty result (`allow_empty_first_page`), so an empty roster resolves to page 1
rather than tripping the bound.

---

## R5 — Deterministic ordering

**Decision**: `.order_by('-enrolled_at', '-id')`.

**Rationale**: `Enrollment.enrolled_at` is `auto_now_add`, and a free-enrolment batch or a webhook burst
produces identical timestamps. With `-enrolled_at` alone, the order among tied rows is unspecified — Postgres
may return them differently for the page-1 query than for the page-2 query, so pages can **repeat and skip
students with no writes happening at all**. The `-id` tiebreak makes the sort total, which is what SC-003 and
FR-012 actually require. This is the cheapest correctness fix in the feature and the easiest to omit.

---

## R6 — `SearchFilter`: what comes free, what does not

**Decision**: `filter_backends = [filters.SearchFilter]` with
`search_fields = ['user__first_name', 'user__last_name', 'user__username']`.

**What comes free** (verified against DRF's implementation):

- **Full-name search works without an annotation.** `SearchFilter` splits the term on whitespace and commas,
  ORs each part across every search field, then **ANDs the parts together**. `"maria gomez"` therefore matches
  `first_name='Maria'` AND `last_name='Gomez'`. FR-015's "first and last name together" needs no concatenated
  field.
- **Partial, case-insensitive matching**: a field with no prefix uses `icontains`. FR-015 satisfied.
- **Literal wildcards**: Django escapes `%` and `_` inside `icontains`, so FR-015's "special characters matched
  literally" is free.
- **Whitespace-only terms**: `get_search_terms` uses `.split()`, which yields `[]`, so the filter is a no-op.
  FR-017's "whitespace is no search" is free.
- **No duplicate rows**: `Enrollment.user` is a to-one FK, so the join cannot fan out. No `.distinct()`, and
  therefore no interaction with the `DISTINCT`/`ORDER BY` restrictions.

**What does not come free**: the username is searchable only because it is the displayed name's fallback
(FR-007). It is listed for that reason, not as a separate search facet.

**Alternative considered**: a hand-built `Q(first_name__icontains=…) | …`. Same result, more code, and it would
have to re-derive the AND-across-terms behaviour to support full names. Rejected.

---

## R7 — Progress is computed **after** pagination

**Decision**: paginate first, then compute progress for the ≤ 20 rows on screen, in two flat queries.

**Rationale**: nothing in this spec sorts or filters by progress — ordering is fixed (R5) and search is names
only (R6) — so progress never needs to exist in SQL. That makes the naive approach (a `SerializerMethodField`
counting per row: ~40 queries per page) unnecessary *and* the clever one (correlated `Subquery` annotations)
unnecessary. The plain version is also the fast one.

**The plan** — 4 queries in the aggregate scope, 5 in the course scope (the extra one resolves `?course=`
against the owned set: the FR-032 ownership check, which cannot be folded into the base queryset without
losing the ability to tell "your course, no students" from "not your course"). Flat in the number of rows:

| # | Query |
|---|-------|
| 1 | `COUNT(*)` over the filtered set (DRF's paginator) |
| 2 | the page: 20 `Enrollment` rows, `select_related('user', 'course')` |
| 3 | lecture totals per course: `Lecture.objects.filter(section__course_id__in=…).values('section__course_id').annotate(Count('id'))` |
| 4 | completions per (student, course): `LectureProgress.objects.filter(user__user_id__in=…, lecture__section__course_id__in=…, is_completed=True).values('user__user_id', 'lecture__section__course_id').annotate(Count('id'))` |

Queries 3 and 4 take the **id sets from the page**, so they are bounded by 20 courses and 20 students; query 4
returns at most one row per (student, course) pair, ≤ 400 rows worst case. The cross-product is a superset of
the pairs actually on the page, and the extra rows are simply never looked up.

With `?course=` there is a fifth query ahead of these four: resolving the id against the caller's own courses
(R3). It is the ownership check and cannot be folded into the base queryset, or an owned course with no
students would be indistinguishable from a course the caller does not own. So the plan is **4 queries in the
aggregate scope, 5 in the course scope**, flat in the number of rows either way, and `RosterPerformanceTests`
pins both.

`select_related('user', 'course')` on query 2 is what keeps name, picture and course title off the N+1 path.

**Alternatives considered**:
- *`Subquery` annotations* — one query instead of three, but two correlated subqueries per output row, harder
  to read, and no measurable win at this scale. Rejected on legibility.
- *Reusing `progress.utils.get_student_sorted_courses`* — it takes one student's enrolments and counts per
  course in a Python loop; it is the right *rule* but the wrong *shape* (it would issue queries per row). The
  rule is restated; see R9.

---

## R8 — The two user keys

**Finding**: `Enrollment.user` points at **`CustomUser`**
([enrollment/models.py:44](../../backend/apps/enrollment/models.py:44)), while `LectureProgress.user` points
at **`StudentProfile`** ([progress/models.py:8](../../backend/apps/progress/models.py:8)).

**Decision**: join through `user__user_id` in query 4 and key the resulting map on
`(custom_user_id, course_id)`, which is what the page rows carry. There is no per-row profile lookup anywhere.

This is the same trap 009 hit and documented; it is restated here because query 4 looks correct and returns
nothing at all if written as `user_id__in=<CustomUser ids>`.

**Also**: `LectureProgress.is_completed` defaults to `False` and rows exist in that state, so query 4 must
filter `is_completed=True`. The student-side code does the same at
[progress/views.py:100](../../backend/apps/progress/views.py:100).

---

## R9 — Field shapes, and two deviations from the sketch

**Decision** — one row:

```
{ "id", "name", "avatar", "enrolled_at", "progress", "course": { "id", "title" } }
```

| Field | Rule |
|-------|------|
| `id` | the **enrolment** id (P2) |
| `name` | `f"{first} {last}".strip() or username` (FR-007) — the same rule 008 uses |
| `avatar` | `profile_picture or None` (FR-008) |
| `enrolled_at` | `YYYY-MM-DD`, UTC, **date only** (FR-009) |
| `progress` | percent to one decimal (`70.0`), or **`null`** when the course has no lectures (FR-010, FR-011) |
| `course` | `{id, title}`, **always present** |

**Deviation 1 — `avatar`, not `pfp`.** 008's dashboard already ships this exact pair as
`PersonRef{name, avatar}` ([dashboard/dto.py:23](../../backend/apps/course/dashboard/dto.py:23)), and this
row's `course` is already `CourseRef{id, title}` verbatim. Using `pfp` would give two instructor read
endpoints two names for one concept. One-word change if the owner prefers `pfp`.

**Deviation 2 — `course` is always present**, not only in the aggregate scope. That was the right call when
there were two endpoints; with one (P6), a conditional field means two Zod schemas and two TS types for one
route. The frontend knows which columns to render from its own route, and the cost is ~40 bytes per row.

**`progress` is a percent with one decimal**, not a whole number, so it equals the value the student sees for
the same course ([progress/utils.py:147](../../backend/apps/progress/utils.py:147)) — which is what FR-010
requires. FR-010's "whole percentage" is a **display** rule: the label renders `Math.round(70.4)` → `70%`
while the bar uses the precise value.

**`progress: null` rather than `0`** for a course with no lectures. SC-007 forbids showing 0% where there is
no underlying data, and 009 established the pattern of the API returning `null` and the client mapping it to
a label — here, `—`.

**`name` is shared with 008, not re-derived.** `_person_name` at
[dashboard/service.py:197](../../backend/apps/course/dashboard/service.py:197) is the existing rule and has
two call sites, both in that file. It is promoted to `person_name` (drop the underscore) and imported by the
roster serializer, so FR-007 cannot drift from the dashboard. This is the only edit to existing behaviour in
the feature, and it changes no output.

**Date-string pitfall, for the client**: `enrolled_at` is a date string, not a timestamp. `new Date("2026-07-02")`
parses as UTC midnight, and `.toLocaleDateString()` then renders **1 July** in any negative-offset timezone —
which would break FR-009's "every viewer sees the same date". The string is formatted by splitting it, never
by constructing a `Date`. See R12.

---

## R10 — Throttle

**Decision**: a new scope, `instructor_students: '120/min'`, applied via `throttle_scope` on the view.

**Rationale**: `ScopedRateThrottle` is the project default and no-ops on views with no `throttle_scope`, so
the alternative is genuinely unthrottled. Unlike the dashboard and analytics reads (60/min), this endpoint is
driven by a **debounced search box**, so its natural traffic is burstier. With a 300 ms debounce a request
fires only on a typing pause; realistic use is tens of requests per minute including paging, so 120/min is far
above any human rate while still catching the failure this guards against — a runaway `useEffect` loop, which
would blow past it immediately. Consistent with the existing comments in
[settings.py:156](../../backend/config/settings.py:156): a ceiling against a client bug, not a security
boundary. Ownership is the security boundary.

---

## R11 — Frontend: the shadcn table, and where it goes

**Decision** (P7): add shadcn's table, then **move it to `components/atoms/table.tsx`** and restyle it with
the project's tokens.

**Rationale**: `components.json` aliases `ui` to `@/components/ui`, so `shadcn add table` lands in
`components/ui/` — a directory that is **empty** in this repo. Every shadcn primitive already in the project
(`button`, `input`, `select`, `accordion`, `avatar`, `skeleton`, …) lives in `components/atoms/`. Leaving the
table in `ui/` would start a second convention for one file. Move it, fix the import path, and it is an atom
like the rest.

**Restyling**: shadcn's defaults use `muted`/`border`/`foreground`. The house palette is `darktext`,
`graytext2`, `darkmint`, `lightbg`, `darkbg`, and existing specs discourage raw hex and Material tokens. The
table's header, row border, and hover styles are rewritten onto those tokens at the point it is moved, so
every consumer inherits the project's look rather than shadcn's.

**Net-new, reusable**: no pagination component exists anywhere in the project. `RosterPagination` is built
generically enough to live in `components/molecules/` so 012 (reviews) and 013 (earnings) can borrow it.
`components/atoms/avatar.tsx` is reused as-is, with `AvatarFallback` carrying initials for FR-008.

---

## R12 — Frontend: address, debounce, and why not `keepPreviousData`

**Decision**: `search` and `page` live in the address, via a `useRosterParams` hook modelled on
[usePeriodParam.tsx](../../front-end/src/featuers/instructor-analytics/hooks/usePeriodParam.tsx).

- `router.replace`, not `push` — three keystrokes must not leave three history entries, while Back still
  returns to the previous page.
- Unrecognised values fall back silently (`page` → 1, `search` → empty); the API is the strict one (FR-020,
  FR-024).
- Consumers render under `<Suspense>` — Next 16's requirement for `useSearchParams`.

**The input is local state, not the URL param.** If the text box reads its value back from
`useSearchParams`, every keystroke round-trips through the router and typing feels laggy. The flow is: local
state → `useDebounce` (300 ms) → URL → query key.

**`useDebounce` becomes generic.** It exists at
[hooks/useDebounce.tsx](../../front-end/src/hooks/useDebounce.tsx) with the signature
`(value: any, delay: number)`, and it has **zero call sites** today — this feature is its first consumer. It
is changed to `useDebounce<T>(value: T, delay: number): T` before use, so the debounced term is a `string` and
not an `any` leaking into the query key (Constitution I). Nothing can break; there is nothing to break.

**Changing the search term resets the page in the same URL write**, not in a follow-up effect. Two writes
would fire a request for page 5 of a one-page result set, which FR-024 would then bounce back to page 1 — a
visible flicker for no reason.

**No `placeholderData: keepPreviousData`.** It is the obvious choice for a paged table and it is wrong here:
FR-036 forbids showing rows from the previous page or search term as if they were the new result. The
skeleton shows instead. Queries follow 008/009's `staleTime: 0 / gcTime: 0`, so a roster is never served from
cache after an enrolment or a refund.

---

## R13 — Tests

**Backend** — `backend/apps/course/tests_roster.py` (`APITestCase`), mirroring 009's module-per-spec habit:

- **Scope**: aggregate lists every owned course; `?course=<owned>` narrows; another instructor's enrolments
  never appear in either.
- **Ownership** (FR-031, FR-032): `?course=` for a non-owned course, a missing course, `abc`, `0` and `-1`
  all return the **same** 404. A student and an anonymous caller are refused. A staff account with no
  instructor profile gets an empty page, not a 500.
- **Rows** (FR-006 – FR-011): refunded enrolments excluded from rows *and* from `count`; name falls back to
  username; `avatar` is `null` when unset; `enrolled_at` is a bare date; `progress` is a percent; `progress`
  is `null` for a course with no lectures; a student in two owned courses yields two rows with different
  `course` and different `progress`.
- **Agreement**: the same student and course produce the same `progress` here as on
  `/progress/student/courses/` — pins FR-010 to the student experience.
- **Ordering** (R5): rows with identical `enrolled_at` come back in a stable, repeatable order across two
  requests for the same page, and pages 1 and 2 of a tied roster share no rows.
- **Search** (FR-014 – FR-019): partial match; case-insensitive; surname-only; full name across two fields;
  `%`/`_` treated literally; whitespace-only is a no-op; `count` reflects matches.
- **Paging** (FR-021 – FR-025): page size 20; `count`/`next`/`previous` correct; `?page=999`, `?page=abc`,
  `?page=0` and `?page=-1` all return page 1 with **200**; search + page combine.
- **Query plan** (R7): 4 queries for a full page in the aggregate scope, 5 in the course scope (the extra one
  being the ownership resolution), unchanged across 20 different courses and unchanged by a search term — the
  guard against a `SerializerMethodField` creeping back in.
- **Privacy** (FR-033, SC-005): the serialized payload contains no email, no order or transaction data, no
  quiz data and no lecture ids — asserted over the raw response body.

**Frontend**: `tsc --noEmit` and lint are the gates, as in 003–009. Browser verification is the owner's, from
[quickstart.md](./quickstart.md) — per the standing instruction that browser testing is done by the owner, not
by the agent.
