# Research: Instructor Analytics — Per-Course and Aggregate Learning Insight

**Feature**: `009-instructor-analytics` | **Date**: 2026-09-17 | **Spec**: [spec.md](./spec.md)

Every decision below was taken against the code as it stands on this branch (after 008), and is shaped
around the API contract the product owner sketched for `/speckit.plan`:

```text
1. instructor/courses/24/analytics?days=30
   completion rate: .71 · quiz pass rate: .35 · active students: 102 · period: 30d · window: {start, end}
   enrollments over time: [{start: 16-9, end: 16-9, count: 30}, ...]
   section drop-off: [{section id, title, count}, ...]
2. instructor/analytics — the same thing, aggregated over all courses
Frontend: use a third-party chart library.
```

Four points of that sketch conflicted with the clarified spec or left a choice open. They were put to the owner
on 2026-09-17 and answered:

| # | Question | Answer |
|---|----------|--------|
| P1 | The sketch returns rates only; the spec shows each rate with its counts ("71% · 36 of 50"). | **Add counts** next to each rate. |
| P2 | "The same thing but aggregate" vs. the clarified **course** drop-off on the all-courses page. | Aggregate carries **`course_drop_off`** instead of `section_drop_off`. |
| P3 | "Empty state: just leave them blank" vs. the spec's labelled empty states. | **Keep the labelled states** (FR-021). The API returns `null`; the client maps `null` to the label. |
| P4 | Which chart library. | **Recharts.** |

No `NEEDS CLARIFICATION` remains.

---

## R1 — Two endpoints, one snapshot each

**Decision**:
- **Per course**: `GET /courses/instructor/courses/{id}/analytics/?days=30|90|all`, an `@action(detail=True,
  methods=['get'])` on the existing `InstructorCourseViewSet`.
- **Aggregate**: `GET /courses/instructor/analytics/?days=30|90|all`, a new `InstructorAnalyticsView(APIView)`.

Each returns every tile and both chart series for one period in a single response.

**Rationale**:
- This is exactly the owner's sketch, placed under the existing `/courses/` prefix where the whole instructor
  API lives.
- The conventions doc (007) says: for an operation on one row that a viewset already scopes, use
  `@action(detail=True)` + `self.get_object()`. Another instructor's course is then a 404 before any analytics
  code runs, which *is* FR-026 ("refused exactly as if the course did not exist"), and the check cannot be
  forgotten.
- The conventions doc (008) says: cross-course reads with no owning row use an `APIView` that takes no ids and
  scopes every query to `request.user.instructor_profile`. The aggregate is exactly that.
- One response per period is what makes FR-020 ("one consistent snapshot") and SC-004 (never two periods on
  screen) true by construction.

**Alternatives considered**:
- *One endpoint per tile/chart* — rejected: tiles and charts could describe different moments, and a period
  change would need several requests to settle.
- *A single endpoint with an optional `course` query param* — rejected: ownership would move from
  `get_object()` into hand-written checks, and FR-026's "same as a missing course" would have to be re-created.
- *`@action(detail=False)` on the viewset for the aggregate* (`instructor/courses/analytics/`) — rejected for
  the same reason 008 rejected it: it reads as a course-list sub-resource, and the owner's sketch names
  `instructor/analytics`.

---

## R2 — Where the logic lives

**Decision**: a new `backend/apps/course/analytics/` package, the same shape as `publishing/` and `dashboard/`:

| File | Holds |
|------|-------|
| `periods.py` | `Period` enum, `parse_period()`, `Window`, `build_buckets()` (pure, no ORM) |
| `metrics.py` | Pure functions over plain data: section completion, course completion, stuck section, rates, drop-off (no ORM) |
| `dto.py` | Frozen dataclasses + `to_dict()` for the wire shape |
| `service.py` | `CourseAnalyticsService`: the fixed query plan (R6), then hands rows to `metrics.py` |
| `__init__.py` | The only import surface |

`views.py` gains the `analytics` action and `InstructorAnalyticsView`. `urls.py` gains
`path('instructor/analytics/', ...)`.

**Rationale**: the conventions doc prescribes this shape. Splitting the **pure** definitions (`metrics.py`,
`periods.py`) from the **queries** (`service.py`) means every definition in FR-007 – FR-019 gets a
database-free unit test. That matters here more than in 008, because the definitions are the whole feature and
the clarifications changed them four times.

**Alternatives considered**: *extend `dashboard/`* — rejected: 008's conventions call its snapshot
all-or-nothing and lifetime-only (FR-008 of 008). Mixing a period-parameterised read into it would blur both.
*A new `apps/analytics` Django app* — rejected: an app with no models, as 008 R2 argued.

---

## R3 — One computation for both scopes

**Decision**: `CourseAnalyticsService.build(courses, period)` computes over a **list of courses**. The
per-course endpoint calls it with `[course]` and serialises `section_drop_off`. The aggregate calls it with
every owned course and serialises `course_drop_off`. The tiles and the enrollment series come from the same
code path in both cases.

**Rationale**: FR-017 requires the aggregate to be "the same measures … pooling the underlying counts". If both
views run the same code, pooling is just summing, and the two views can never define completion differently.
It also means SC-003's verification cases only need writing once.

**Alternatives considered**: *call the per-course build once per course and add up the results* — rejected: N
times the query count (breaks R6), and distinct active students (FR-018) can't be recovered from per-course
counts.

---

## R4 — Periods, windows and UTC buckets

**Decision**:
- **Query parameter** `days` ∈ {`30`, `90`, `all`}. If it's missing, use `30`. Any other value is
  `400 {"error": "days must be one of 30, 90, all.", "code": "invalid_period"}`. The API is strict; the
  **client** handles the FR-004a fallback before it ever calls the API (R10).
- **Response** `period` ∈ {`"30d"`, `"90d"`, `"all"`} (the owner's sketch).
- **Window** (dates are inclusive UTC calendar days, ISO `YYYY-MM-DD`):
  - `30d`: `start = today − 29 days`, `end = today`. That is the 30 UTC days ending today, including today.
  - `90d`: `start = today − 89 days`, `end = today`.
  - `all`: `start` = the UTC date of the earliest **counted** enrollment in scope, `end = today`. With no
    counted enrollment, `start = null` and the series is `[]`.
- **Cohort** (FR-005): active enrollments with `enrolled_at >= start 00:00:00Z`. For `all`, there is no lower
  bound.
- **Buckets** (FR-011, FR-011a):
  - `30d`: one per UTC day, so 30 buckets.
  - `90d`: one per ISO week starting Monday. The first and last buckets are **clipped** to the window, so
    `start`/`end` of the first bucket may be mid-week.
  - `all`: one per calendar month from the month of `start`, with the first bucket clipped to `start` and the
    last to `today`.
  - Every bucket is present, including zero-count buckets. Each is `{start, end, count}` (the sketch's shape),
    with both dates inclusive.

**Rationale**:
- The spec says "rolling windows ending now". Aligning the window to UTC days makes the daily chart exactly 30
  points, with no partial first day, and every viewer gets the same buckets (FR-011a). Enrollments up to the
  moment of the request are included, because today is in the window.
- `settings.TIME_ZONE` is already `'UTC'`, so `timezone.now().date()` is the UTC date with no conversion.
- A strict API keeps the contract honest: a typo can't silently look like real 30-day data. The page-address
  fallback is a UI concern, and FR-004a assigns it to the view.

**Alternatives considered**:
- *A true rolling `now − 30×24h` window* — rejected: the first daily bucket would be a partial day whose count
  isn't comparable with the others.
- *`TruncDay`/`TruncWeek`/`TruncMonth` in the database* — considered. Bucketing is instead done in Python over
  `enrolled_at` values that are already loaded for the cohort (R6 query 1). It costs no extra query, it keeps
  the clipping rules in one pure, unit-tested function, and it avoids any dependency on database time-zone
  settings.

---

## R5 — The definitions, pinned

The spec's clarifications, turned into rules for `metrics.py`. "Scope" is the list of courses. "Cohort pairs"
are the (student, course) pairs with a counted enrollment.

| Measure | Definition | `null` when |
|---------|------------|-------------|
| **Section completed** (FR-014) | If the section has a quiz, the student has a passed attempt on it. Otherwise the section has ≥ 1 lecture and the student has completed all of them. | — |
| **Course completed** (FR-007) | Every current lecture is completed **and** every current quiz is passed. A course with 0 lectures and 0 quizzes is never completed. | — |
| **Completion rate** (FR-008) | `completed pairs / cohort pairs` | cohort is empty |
| **Quiz pass rate** (FR-009) | Over (student, quiz) pairs for cohort pairs where the student has ≥ 1 attempt: `pairs with a passed attempt / attempted pairs` | no attempted pairs |
| **Active students** (FR-010, FR-018) | Per course: the number of cohort pairs. Aggregate: distinct `user_id` over cohort pairs. | never (0 is a count). The client shows the empty label when it is 0 |
| **Stuck section** (FR-015) | Let *h* be the highest-ordered completed section. With no *h*, the first section. Otherwise the next section after *h*. If there is none, the first section (in curriculum order) that contains an uncompleted lecture or an unpassed quiz. | the course is completed |
| **Section drop-off** (FR-013) | Per section in curriculum order: the number of not-completed cohort students whose stuck section is that section. Every current section is listed, including zeros. | — (`[]` if the course has no sections) |
| **Course drop-off** (FR-019 – FR-019a) | Per course with ≥ 1 cohort pair: `not_completed / total`. Sorted by rate desc, then `not_completed` desc, then `title` asc, then `course_id` asc. | — (course omitted) |

**Rates on the wire** are fractions rounded to 4 decimals (the sketch's `.71`). **The client computes the
displayed whole-number percentage from the counts**, not from the rounded rate. That way "71% · 36 of 50"
can never disagree with itself.

**Distinguishing empty labels** (FR-021, P3):
- `completion.rate === null`: "No data yet" when `period = "all"`, otherwise "No data in this period".
- `quiz_pass.has_quizzes === false`: "No quizzes".
- `quiz_pass.rate === null` with quizzes present: "No attempts".
- `active_students === 0`: the same no-data label as completion.

No extra fields are needed beyond `has_quizzes`.

**Edge cases the rules already cover**:
- A student who passed a section's quiz but has an uncompleted lecture there (possible after a lecture is
  added): that section counts as completed (unlock rule), but the course doesn't (FR-007). The fallback in
  FR-015 places the student at that section.
- A section with no lectures and no quiz is never completed. A student who reaches it is stuck there (spec
  edge case).
- Curriculum edits: progress rows for deleted lectures cascade away. New lectures simply have no progress rows.
  Every computation reads the **current** curriculum.

---

## R6 — A fixed query plan (no N+1)

**Decision**: `build()` runs the same number of queries for 1 course or 50:

1. **Cohort**: `Enrollment.objects.filter(course__in=scope, is_active=True[, enrolled_at__gte=start])
   .values_list('user_id', 'course_id', 'enrolled_at')`.
2. **Curriculum**: `Section.objects.filter(course__in=scope).order_by('course_id', 'order')
   .prefetch_related('lectures')` with `select_related('quiz')`. Every section's ordered lecture ids and
   optional quiz id come from here (1 query for sections + quiz, 1 for lectures).
3. **Lecture progress, per student per section**: `LectureProgress.objects.filter(is_completed=True,
   lecture__section__course__in=scope, user__user_id__in=cohort_user_ids).values('user__user_id',
   'lecture__section_id').annotate(done=Count('id'))`.
4. **Quiz results, per student per quiz**: `QuizAttempt.objects.filter(quiz__section__course__in=scope,
   user__user_id__in=cohort_user_ids).values('user__user_id', 'quiz_id').annotate(passed=Count('id',
   filter=Q(passed=True)))`.

Rows from 3 and 4 are then matched to cohort **pairs** in Python via section → course. A student's progress in
a course they did not enroll in *during the period* is ignored, which is what makes the aggregate cohort
correct (FR-005).

Plus the ownership query (`get_object()` or the owned-course list): about **6 queries** in total. A test pins
the count for 1 and 10 courses (008 convention: "Pin the query count").

**Rationale**:
- `LectureProgress`/`QuizAttempt` point at `StudentProfile` while `Enrollment` points at `CustomUser`. Joining
  on `user__user_id` keys everything by `CustomUser.id` in the database, with no per-student lookups.
- Grouping progress **per section** rather than per lecture bounds rows at students × sections (5,000 × 30 =
  150k at the SC-008 ceiling for one course) instead of students × lectures. `unique_together (user, lecture)`
  makes `Count('id')` an exact count of distinct completed lectures.
- Grouping quiz attempts per (student, quiz) collapses retakes in the database, which is exactly FR-009's
  "retakes do not count as extra attempts".

**Alternatives considered**:
- *Reuse `apps.progress.utils.get_section_progress`* — rejected: it takes one student and runs several queries
  per section (`is_section_unlocked` per section, per lecture). Across a cohort that is an N×M query storm.
  Only its **rule** is reused, restated in `metrics.py` and pinned by a test that checks it agrees with
  `is_section_unlocked` on the same fixture.
- *Reuse `StudentCoursesRating.has_completed_course`* — rejected: lectures-only, which clarification Q4
  deliberately rejected, and it runs 2 queries per student.
- *`user__in=cohort_users` with a subquery instead of an id list* — acceptable. The id list is used because it
  is already in memory from query 1 (at most 10,000 ids at the SC-008 ceiling). Implementation may switch to a
  subquery if PostgreSQL parameter limits are ever approached; the contract is unaffected.
- *New indexes* (`Enrollment(course, is_active, enrolled_at)`) — deferred, as in 008 R5. The query plan is
  already set-based, and a migration is only warranted once measured. Any index would be a **new** migration.

---

## R7 — Access, errors and the missing profile

**Decision**:
- **Per course**: auth `CookieJWTAuthentication`, `IsAuthenticated` + `isInstructor` (inherited from the
  viewset). `get_object()` returns 404 for a missing or another instructor's course. A caller without a profile
  already gets `Course.objects.none()` from the viewset, so also 404, which the course workspace layout already
  shows as "Course not found" (a handled state, FR-027).
- **Aggregate**: same auth. A missing profile gets `403 {"error": ..., "code": "no_instructor_profile"}`, the
  008 convention. The client reuses that handled state.
- **Both**: build **and** serialise inside one `try`. Any failure returns one logged
  `500 {"error": "We couldn't load analytics. Please try again."}` and never a partial snapshot (FR-020,
  FR-022; 008 convention "Snapshot endpoints are all-or-nothing").
- **No student identity on the wire** (FR-028): the response carries only counts, rates, dates, and
  course/section ids and titles. `user_id` values never leave the service.

**Throttle**: a new scope `instructor_analytics: '60/min'`. It is class-level on the `APIView` (one action),
and set through the existing `get_throttles()` branch for the viewset action, since `throttle_scope` can't be
passed to `@action` (007 convention).

---

## R8 — Chart library: Recharts

**Decision**: add **`recharts` (v3)** to `front-end`.
- `LineChart` for enrollments over time.
- `BarChart` with `layout="vertical"` (horizontal bars) for both drop-off charts.

Both sit inside `ResponsiveContainer`, and colours come from the project's Tailwind tokens (`darkmint` series,
`graytext2` axes).

**Rationale**:
- The owner asked for a third-party library (P4).
- Recharts is React-first and declarative, so a chart is a typed component tree, which fits Principle II. It
  renders SVG, so values are in the DOM, not a canvas.
- v3 supports React 19 and ships an `accessibilityLayer` that gives keyboard focus and tooltips. That covers
  FR-012 and FR-016/FR-019b "on hover **or focus**".
- `ResponsiveContainer` gives FR-003 / SC-009 (375px, no horizontal scroll).
- **Horizontal bars for drop-off.** Section and course titles are long, and FR-019c needs 50 courses to stay
  readable. Horizontal bars give each label a full row, and the chart's height grows with the number of bars
  (about 32px per bar) instead of squeezing widths. This departs from the wireframe's vertical columns, which
  show 6 unlabelled bars; the wireframe stays the structural reference for placement, and it is recorded here
  as a deliberate change.

**Alternatives considered** (all offered to the owner):
- *Chart.js + react-chartjs-2* — canvas-based: no DOM for focus/hover values, and imperative config.
- *Nivo* — heavier, and its styling system fights the Tailwind tokens.
- *Hand-rolled SVG* — rejected by the owner's instruction.

---

## R9 — Frontend module, freshness and loading

**Decision**: a new `front-end/src/featuers/instructor-analytics/` module (the discovery doc §14.3 name) with
`api`, `schemas`, `types`, `hooks`, `components`, `index.ts`.
- **One Zod schema per response**, with TS types inferred from it. The API function `parse`s, so a malformed
  payload becomes the error state rather than zeros (008 convention).
- **Hooks**:
  - `useCourseAnalytics(courseId, days)`: key `['instructor', 'course', courseId, 'analytics', days]`.
  - `useInstructorAnalytics(days)`: key `['instructor', 'analytics', days]`.
  - Both use `staleTime: 0, gcTime: 0, refetchOnMount: 'always'` (008 R11), which gives FR-023 without touching
    any mutation hook from 004–008. The per-course key also sits under the course prefix, so existing course
    invalidations refresh it for free (007 convention).
- **No `placeholderData` / `keepPreviousData`.** A period change shows the layout-matching skeleton until the
  new snapshot arrives, so the old period's values are never on screen next to the new selection (FR-020,
  SC-004).

---

## R10 — The period in the page address

**Decision**:
- The page reads `?days=` with `useSearchParams()`. `normalizePeriod(raw)` returns `'30'` for anything other
  than `'30' | '90' | 'all'`, which is FR-004a's silent fallback with no error.
- Changing the period calls `router.replace(`${pathname}?days=${value}`, { scroll: false })`. That is a
  client-side navigation (no full reload) which updates the address, so refresh, Back/Forward and shared links
  reproduce it.
- **Links**: the sidebar item and the workspace tab stay unchanged (no param means 30 days). A course drop-off
  bar links to `/instructor/courses/{id}/analytics?days={current}` (FR-019b).
- Because the pages use `useSearchParams`, each analytics page wraps its client component in `<Suspense>`
  (Next.js requirement for static rendering), with the skeleton as fallback.

**Rationale**: `replace` rather than `push` means switching through three periods doesn't add three history
entries. Back still returns to the previous page, where the address (and so the period) is preserved.

**Alternatives considered**: *Zustand/localStorage* — rejected by clarification Q2 (option C).

---

## R11 — Tests

**Decision**: `backend/apps/course/tests_analytics.py`, run with its module label
(`manage.py test apps.course.tests_analytics`).
- **Pure unit tests** (no DB) for `metrics.py` and `periods.py`: every row of R5, every edge case in the spec,
  and bucket clipping for all three periods, including month and week boundaries.
- **An agreement test**: on a fixture, `metrics.section_completed` matches `apps.progress.utils.
  is_section_unlocked` for the next section.
- **API tests**: the contract checklist (contracts §Test checklist), covering ownership 404, non-instructor
  refusal, no-profile 403 and 404, invalid `days` 400, all-or-nothing 500, and no student identity in the body.
- **`assertNumQueries`** with the same count for 1 and 10 courses.

**Frontend gates**: `tsc --noEmit` and `npm run lint`. The owner runs browser checks from quickstart.md (per the
owner's standing preference, the agent does not drive browser verification).
