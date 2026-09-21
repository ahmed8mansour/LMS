w# Data Model: Instructor Student Roster

**Feature**: 010-instructor-students | **Date**: 2026-09-20 | **Plan**: [plan.md](./plan.md)

**No migration.** Nothing is created, altered or stored. Every value in a roster row is either read from an
existing column or derived on the request. This document records the shapes, the query plan, and the rules
that turn rows into a response.

---

## 1. Existing models read

| Model | Location | Fields used | Why |
|-------|----------|-------------|-----|
| `Enrollment` | `apps/enrollment/models.py:42` | `id`, `course_id`, `user_id`, `is_active`, `enrolled_at` | The row identity, the scope filter, and the date column |
| `CustomUser` | `apps/authentication/models.py:190` | `first_name`, `last_name`, `username`, `profile_picture` | Name and picture |
| `Course` | `apps/course/models.py` | `id`, `title`, `instructor_id` | The course cell, and the ownership anchor |
| `Section` → `Lecture` | `apps/course/models.py` | `section__course_id` | Denominator of the progress fraction |
| `LectureProgress` | `apps/progress/models.py:7` | `user_id` (→ `StudentProfile`), `lecture_id`, `is_completed` | Numerator |
| `InstructorProfile` | `apps/authentication/models.py:225` | (identity only) | Resolves the caller to an owner |

**Two traps, both load-bearing:**

- `Enrollment.user` → **`CustomUser`**, but `LectureProgress.user` → **`StudentProfile`**. The completions
  query must cross that with `user__user_id`. Written as `user_id__in=<CustomUser ids>` it silently returns
  nothing (R8).
- `LectureProgress` rows exist with `is_completed=False` (that is the field's default). The numerator must
  filter `is_completed=True`, as the student-side code does at `progress/views.py:100`.

---

## 2. Request

`GET /courses/instructor/students/`

| Parameter | Type | Default | Rule |
|-----------|------|---------|------|
| `course` | positive integer | absent | Absent → every owned course. Present → that course, **resolved against the owned set**. Non-owned, missing, or unparseable → `404`, all identical (FR-031, FR-032) |
| `search` | string | empty | Partial, case-insensitive, matched against first name / last name / username. Whitespace-only is treated as absent (FR-014 – FR-017) |
| `page` | positive integer | `1` | Out of range, `< 1`, or unparseable → page 1, with `200` (FR-024) |

Page size is fixed at **20** on the server and is not client-settable (FR-021).

---

## 3. Query plan — four queries, plus one for the ownership check

Flat in the number of rows and pages. Pinned by `RosterPerformanceTests`:
**4** in the aggregate scope, **5** in the course scope — the extra query resolves `?course=` against the
caller's own courses. It cannot be folded into the base queryset, because an owned course with no students
has to stay distinguishable from a course the caller does not own (FR-032), and an empty result cannot tell
those apart.

**Base queryset** — ownership is a *filter*, never a check that can be skipped:

```
Enrollment.objects
  .filter(course__instructor=<caller's InstructorProfile>, is_active=True)
  [.filter(course=<resolved course>)]          # only when ?course= was supplied
  .select_related('user', 'course')            # keeps name/picture/title off the N+1 path
  .order_by('-enrolled_at', '-id')             # the -id tiebreak is required (R5)
```

`InstructorProfile.DoesNotExist` → `403` with `code: no_instructor_profile`, the same body 009 returns
(FR-034). Deliberately not an empty queryset: a `200` with no rows already means "you have no students yet",
and a broken account must not be shown as a new instructor (FR-029).

| # | Query | Shape |
|---|-------|-------|
| 1 | `COUNT(*)` over the filtered set | DRF's paginator |
| 2 | The page — ≤ 20 `Enrollment` rows with `user` and `course` joined | the rows |
| 3 | `Lecture.objects.filter(section__course_id__in=<page course ids>).values('section__course_id').annotate(Count('id'))` | `{course_id: total_lectures}` |
| 4 | `LectureProgress.objects.filter(user__user_id__in=<page user ids>, lecture__section__course_id__in=<page course ids>, is_completed=True).values('user__user_id', 'lecture__section__course_id').annotate(Count('id'))` | `{(user_id, course_id): completed}` |

Queries 3 and 4 take their id sets **from the page**, so they are bounded by 20 courses and 20 students.
Query 4's filter is a cross-product — a superset of the (student, course) pairs actually on the page, at most
400 grouped rows — and the extra combinations are simply never looked up.

**Order matters**: pagination happens before queries 3 and 4. Progress is never in the queryset, because
nothing sorts or filters by it (R7).

---

## 4. Derivation rules

Implemented in `apps/course/roster.py` and the serializer, one rule each.

### `progress`

```
total = totals.get(course_id, 0)
if total == 0:  →  None                      # FR-011, SC-007: "—", never 0%
done  = completed.get((user_id, course_id), 0)
      →  round(done / total * 100, 1)        # FR-010: percent, one decimal
```

The rounding and the `* 100` are copied deliberately from `progress/utils.py:147`, so the figure equals what
the student sees for the same course. An agreement test pins the two together.

`done` can exceed nothing: lectures deleted after completion drop out of query 3's denominator *and* query
4's numerator, since both are filtered by the course's **current** lectures. The value cannot exceed 100.

### `name`

```
f"{first_name} {last_name}".strip() or username          # FR-007 — never blank
```

Shared with the dashboard rather than restated: `dashboard/service.py:197`'s `_person_name` is promoted to
`person_name` and imported, so 008 and 010 cannot drift.

### `avatar`

```
profile_picture or None                                   # FR-008
```

Empty string and `NULL` both become `null`, so the client has one case to handle.

### `enrolled_at`

```
enrolled_at.astimezone(timezone.utc).date().isoformat()   →  "2026-07-02"   # FR-009
```

A `SerializerMethodField`, not DRF's `DateField`. Handed a `datetime`, `DateField` refuses outright — it
asserts, telling you to use a custom read-only field and deal with timezone issues explicitly — because
narrowing a datetime to a date silently picks a timezone. So the conversion is spelled out: to UTC, then to a
date. That also keeps FR-009 true if `settings.TIME_ZONE` ever stops being `UTC`, since FR-009 names UTC
rather than the project timezone.

---

## 5. Response

Standard DRF page-number pagination, payload returned directly (no envelope), per CLAUDE.md.

```json
{
  "count": 318,
  "next": "http://.../courses/instructor/students/?course=42&page=3",
  "previous": "http://.../courses/instructor/students/?course=42&page=1",
  "results": [
    {
      "id": 1042,
      "name": "Maria Gomez",
      "avatar": "https://res.cloudinary.com/.../maria.jpg",
      "enrolled_at": "2026-07-02",
      "progress": 70.0,
      "course": { "id": 42, "title": "Django for Beginners" }
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `count` | integer | Students matching scope **and** search — not the page length (FR-018, FR-022) |
| `next` / `previous` | string \| null | DRF's absolute URLs |
| `results[].id` | integer | The **enrolment** id (P2) — unique in both scopes, unlike the student id |
| `results[].name` | string | Never empty |
| `results[].avatar` | string \| null | |
| `results[].enrolled_at` | string | `YYYY-MM-DD` |
| `results[].progress` | number \| null | Percent, one decimal. `null` ⇒ the course has no lectures |
| `results[].course` | object | `{id, title}` — **always present**, in both scopes (R9) |

---

## 6. Invariants

1. Every row's course is owned by the caller. There is no code path that reaches an `Enrollment` whose
   `course.instructor` is not the session's profile.
2. `is_active=False` rows appear nowhere — not in `results`, not in `count` (FR-006).
3. `count` describes scope + search, never the page.
4. `progress ∈ [0, 100] ∪ {null}`. It is `null` **iff** the course currently has no lectures.
5. `name` is never empty or whitespace.
6. The sort is total: `(-enrolled_at, -id)` has no ties, so page *n* and page *n+1* of an unchanged roster
   are disjoint and complete (SC-003).
7. A student in *k* owned courses produces exactly *k* rows, with distinct `course` and independent
   `enrolled_at` and `progress` (FR-027).
8. The serialized body contains no email address, order, transaction, quiz or lecture identifier
   (FR-033, SC-005) — asserted over the raw response, not the serializer definition.
9. The request is idempotent and writes nothing (FR-035).

---

## 7. Client types

Inferred from the Zod schema, never hand-written in parallel (Constitution I).

```ts
// schemas/instructorStudents.schma.ts
export const rosterCourseSchema = z.object({
  id: z.number(),
  title: z.string(),
});

export const rosterRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  avatar: z.string().nullable(),
  enrolled_at: z.string(),          // "YYYY-MM-DD" — a date, NOT a timestamp
  progress: z.number().nullable(),  // null ⇒ render "—", never 0%
  course: rosterCourseSchema,
});

export const rosterPageSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(rosterRowSchema),
});

// types/instructorStudents.types.ts
export type RosterRow = z.infer<typeof rosterRowSchema>;
export type RosterPage = z.infer<typeof rosterPageSchema>;
```

`progress` is `nullable`, not optional, so the "—" case is unavoidable at the call site rather than collapsing
to `0` through a default.

**`enrolled_at` must not be parsed into a `Date`.** `new Date("2026-07-02")` is UTC midnight, and
`.toLocaleDateString()` then renders **1 July** anywhere west of Greenwich — breaking FR-009's promise that
every viewer sees the same date. Format by splitting the string.

---

## 8. Address state

Not persisted; part of each view's URL so refresh, Back/Forward and shared links survive (FR-020, FR-023).

| Param | Values | Fallback |
|-------|--------|----------|
| `search` | any string | empty |
| `page` | positive integer | `1` |

Both are written with `router.replace` in a **single** update, so changing the search resets the page without
a second request for a page that no longer exists (FR-018, R12).

---

## 9. What this feature does not model

No new entity, no new column, no new index, no stored roster, no cached count, no per-student record, and no
history. A roster is a projection of `Enrollment` joined to `CustomUser` and counted against
`LectureProgress`, computed per request and thrown away.
