# Contract: Instructor Analytics

**Feature**: `009-instructor-analytics` | **Spec**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

Two read-only endpoints. They share one response shape, except that the per-course response carries
`section_drop_off` and the aggregate carries `course_drop_off` + `courses_count`. Both follow the project
contract: the payload is returned directly with no envelope, and errors are `{"error": "..."}`.

---

## 1. `GET /courses/instructor/courses/{id}/analytics/`

Analytics for one owned course. An `@action(detail=True)` on `InstructorCourseViewSet`.

| Aspect | Value |
|--------|-------|
| Auth | `CookieJWTAuthentication` (HttpOnly `access_token` cookie) |
| Permissions | `IsAuthenticated`, `isInstructor`. The course is resolved via `get_object()` (owned courses only) |
| Throttle scope | `instructor_analytics`, `60/min` |
| Path | `id`: course id |
| Query | `days` ∈ `30` \| `90` \| `all`. Optional, default `30` |
| Pagination | None (bounded by sections / buckets) |
| Caching | None server-side. The client refetches on every mount |

### 200 OK

```json
{
  "scope": "course",
  "course": { "id": 24, "title": "Django for Beginners" },
  "period": "30d",
  "window": { "start": "2026-08-19", "end": "2026-09-17" },
  "completion": { "rate": 0.71, "completed": 36, "total": 51 },
  "quiz_pass": { "rate": 0.35, "passed": 28, "attempted": 80, "has_quizzes": true },
  "active_students": 51,
  "enrollments_over_time": [
    { "start": "2026-08-19", "end": "2026-08-19", "count": 0 },
    { "start": "2026-08-20", "end": "2026-08-20", "count": 3 },
    "… one bucket per day …",
    { "start": "2026-09-16", "end": "2026-09-16", "count": 30 },
    { "start": "2026-09-17", "end": "2026-09-17", "count": 2 }
  ],
  "section_drop_off": [
    { "section_id": 101, "title": "Getting started", "order": 1, "count": 4 },
    { "section_id": 102, "title": "Models & the ORM", "order": 2, "count": 7 },
    { "section_id": 103, "title": "Views and URLs", "order": 3, "count": 4 },
    { "section_id": 104, "title": "Deploying", "order": 4, "count": 0 }
  ]
}
```

---

## 2. `GET /courses/instructor/analytics/`

Analytics pooled across **every** course the caller owns (draft, unpublished, published). An
`InstructorAnalyticsView(APIView)`. It reads **no ids**.

| Aspect | Value |
|--------|-------|
| Auth / permissions | as §1 (`IsAuthenticated`, `isInstructor`). Scope comes only from `request.user.instructor_profile` |
| Throttle scope | `instructor_analytics`, `60/min` |
| Query | `days` ∈ `30` \| `90` \| `all`. Optional, default `30` |

### 200 OK

```json
{
  "scope": "instructor",
  "period": "90d",
  "window": { "start": "2026-06-20", "end": "2026-09-17" },
  "completion": { "rate": 0.42, "completed": 210, "total": 500 },
  "quiz_pass": { "rate": 0.64, "passed": 640, "attempted": 1000, "has_quizzes": true },
  "active_students": 430,
  "courses_count": 6,
  "enrollments_over_time": [
    { "start": "2026-06-20", "end": "2026-06-21", "count": 5 },
    { "start": "2026-06-22", "end": "2026-06-28", "count": 41 },
    "… one bucket per Monday-start week …",
    { "start": "2026-09-14", "end": "2026-09-17", "count": 22 }
  ],
  "course_drop_off": [
    { "course_id": 31, "title": "React Fundamentals", "drop_off_rate": 0.75, "not_completed": 15, "total": 20 },
    { "course_id": 24, "title": "Django for Beginners", "drop_off_rate": 0.5, "not_completed": 25, "total": 50 },
    { "course_id": 40, "title": "Advanced SQL", "drop_off_rate": 0.2, "not_completed": 2, "total": 10 }
  ]
}
```

### 200 OK — no data (e.g. `?days=all` for an instructor whose courses have no active enrollments)

```json
{
  "scope": "instructor",
  "period": "all",
  "window": { "start": null, "end": "2026-09-17" },
  "completion": { "rate": null, "completed": 0, "total": 0 },
  "quiz_pass": { "rate": null, "passed": 0, "attempted": 0, "has_quizzes": false },
  "active_students": 0,
  "courses_count": 2,
  "enrollments_over_time": [],
  "course_drop_off": []
}
```

With `courses_count: 0`, the client shows the no-courses empty state with a create-course link (FR-024).

---

## 3. Field rules (both endpoints)

| Field | Rule |
|-------|------|
| `period` | `"30d"` \| `"90d"` \| `"all"`, echoing the resolved `days` |
| `window.start` / `window.end` | ISO dates, inclusive, UTC. `30d`: `end − 29`. `90d`: `end − 89`. `all`: earliest counted enrollment date, or `null` when there is none. `end` is today (UTC) |
| `completion.rate` | Fraction in `[0,1]` rounded to 4 dp, or `null` when `total = 0`. `completed` is the number of cohort students who completed **every current lecture and passed every current quiz** |
| `quiz_pass.rate` | Fraction or `null` when `attempted = 0`. Counts (student, quiz) **pairs**, so retakes collapse. `passed` is pairs with ≥ 1 passed attempt. `has_quizzes` is whether any current quiz exists in scope |
| `active_students` | Per course: active enrollments with enrollment date in the window. Aggregate: **distinct students** across those enrollments |
| `enrollments_over_time` | Contiguous, non-overlapping buckets covering the window, **including zero counts**. `30d`: daily (30). `90d`: Monday-start weeks, first/last clipped. `all`: calendar months, first/last clipped. `[]` when `window.start` is `null`. `sum(count) = completion.total` |
| `section_drop_off` | Course scope only. **Every** current section in curriculum `order`, including `count: 0`. `count` is not-completed cohort students whose stuck section is this one. `sum(count) = total − completed`. `[]` if the course has no sections |
| `course_drop_off` | Instructor scope only. Only courses with ≥ 1 cohort student. `drop_off_rate = not_completed / total` (4 dp). Sorted by `drop_off_rate` desc, `not_completed` desc, `title` asc, `course_id` asc |
| `courses_count` | Instructor scope only. Number of owned courses |
| Student identity | **Never present**: no user ids, names, emails or avatars (FR-028) |

Only `is_active=True` enrollments count anywhere. Refunded enrollments are invisible.

## 4. Errors

| Status | Body | When |
|--------|------|------|
| `400` | `{"error": "days must be one of 30, 90, all.", "code": "invalid_period"}` | `days` present but not in the allowed set |
| `401` | DRF default | Unauthenticated |
| `403` | DRF default | Authenticated non-instructor (e.g. student) |
| `403` | `{"error": "No instructor profile is associated with this account.", "code": "no_instructor_profile"}` | **Aggregate only**: staff account without an `InstructorProfile` |
| `404` | DRF default | **Per course**: course missing, owned by another instructor, or caller has no instructor profile (queryset is empty). Identical in all three cases (FR-026) |
| `429` | DRF default | Throttled |
| `500` | `{"error": "We couldn't load analytics. Please try again."}` | Any failure while building or serialising. **Never a partial body.** Logged with the profile id |

---

## 5. Frontend consumer contract (`featuers/instructor-analytics`)

| Concern | Rule |
|---------|------|
| API | `instructorAnalyticsAPI.getCourseAnalytics(courseId, days)` and `.getInstructorAnalytics(days)`. Both `Schema.parse(data)`; a mismatch throws and becomes the error state |
| Query keys | `['instructor', 'course', courseId, 'analytics', days]` and `['instructor', 'analytics', days]` |
| Freshness | `staleTime: 0`, `gcTime: 0`, `refetchOnMount: 'always'`. No `placeholderData` (a period change shows the skeleton, never mixed periods) |
| Retry | No retry on `no_instructor_profile` or 404. Otherwise at most 1 |
| Period | `?days=` read with `useSearchParams`, `normalizePeriod()` falls back to `'30'`. Changing it calls `router.replace(`${pathname}?days=…`, { scroll: false })` |
| Percentages | Displayed as `Math.round(n / d × 100)` from the **counts**, with "`{p}% · {n} of {d}`" |
| Empty labels | `completion.rate === null` or `active_students === 0`: "No data yet" (`all`) / "No data in this period". `!quiz_pass.has_quizzes`: "No quizzes". `quiz_pass.rate === null`: "No attempts". Empty `enrollments_over_time` / all-zero or empty drop-off: the chart's no-data label (same wording rule). All-zero **course** drop-off bars are real data and still render |
| Course bar link | `/instructor/courses/{course_id}/analytics?days={current}` |
| Error | Page-level error + Retry replaces tiles and charts |
| No profile | Aggregate: the 008 handled state for `no_instructor_profile`. Per course: the workspace layout's existing "Course not found" |

---

## 6. Backend test checklist (`apps/course/tests_analytics.py`)

**Definitions (pure, no DB)**
- [ ] Section completed: quiz section needs a passed attempt; lecture-only section needs all lectures; empty section never completes.
- [ ] Course completed needs all lectures **and** all quizzes. Lectures done with a failed quiz is not completed. A course with 0 lectures and 0 quizzes is never completed.
- [ ] Stuck section: none completed gives the first; last completed 1, 1, 3 of 4 gives the counts in spec US1-5; the no-next-section fallback gives the first section with an uncompleted lecture or unpassed quiz; a completed course gives none.
- [ ] Quiz pass: fail, fail, pass counts as one passed pair; fail only is one attempted, not passed; unattempted quizzes are not in the denominator.
- [ ] Course drop-off ordering, including ties (rate, then not_completed, then title, then id).
- [ ] Buckets: 30 daily; 90d weekly with clipped first and last; all-time monthly across a year boundary with clipped first and last; zero buckets present; `[]` when there are no enrollments.
- [ ] Rates round to 4 dp; `null` on zero denominators.
- [ ] Agreement: `section_completed` matches `progress.utils.is_section_unlocked` for the next section on a shared fixture.

**API**
- [ ] Per course 200 matches the §1 shape. Invariants I2, I3, I5, I6 hold.
- [ ] Aggregate 200 matches the §2 shape. Invariants I2, I4, I5 hold. A student in two courses is counted once in `active_students` and twice in `completion.total`.
- [ ] Cohort: an enrollment 45 days old is excluded at `30`, included at `90`/`all`; its progress is ignored at `30`.
- [ ] Aggregate cohort pairing: progress in a course the student enrolled in before the window is ignored.
- [ ] Refunded (inactive) enrollment contributes to nothing, including buckets.
- [ ] Unpublished course with active enrollments is included.
- [ ] Curriculum change: a lecture added after completion makes the student not completed and places them at that section.
- [ ] Missing `days` gives `30d`; `days=7` gives 400 `invalid_period`.
- [ ] Another instructor's course gives 404, same as a nonexistent id.
- [ ] Student gives 403; unauthenticated gives 401; staff without profile gives aggregate 403 `no_instructor_profile` and per-course 404.
- [ ] Aggregate for instructor A contains none of B's courses or students.
- [ ] Response bodies contain no `user`, `email`, `name` or `avatar` keys (I7).
- [ ] Service exception gives 500 with the `error` message only (no partial keys).
- [ ] `assertNumQueries`: same count for 1 and 10 courses (I8).
