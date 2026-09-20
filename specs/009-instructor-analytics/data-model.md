# Data Model: Instructor Analytics

**Feature**: `009-instructor-analytics` | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

## 1. Summary

**No new model, field, or migration.** Every value is computed on read from existing tables and returned as an
**analytics snapshot**, one per scope (one course or all owned courses) and period. Nothing is stored.

## 2. Existing entities read (unchanged)

| Entity | Fields used | Notes |
|--------|-------------|-------|
| `InstructorProfile` | `id`, `user` | Ownership anchor. Taken from the session only |
| `Course` | `id`, `title`, `instructor` | Scope. Draft, unpublished and published all count |
| `Section` | `id`, `course`, `title`, `order` | Curriculum order (`unique_together (course, order)`) |
| `Lecture` | `id`, `section`, `order` | Current lectures define completion |
| `Quiz` | `id`, `section` (1:1) | Current quizzes define completion |
| `Enrollment` | `user` → `CustomUser`, `course`, `is_active`, `enrolled_at` | The cohort. Only `is_active=True` |
| `LectureProgress` | `user` → `StudentProfile`, `lecture`, `is_completed` | `unique_together (user, lecture)` |
| `QuizAttempt` | `user` → `StudentProfile`, `quiz`, `passed` | Many per (student, quiz) (retakes) |

**Identity join**: `Enrollment.user` is a `CustomUser`, while progress and attempts point at `StudentProfile`.
All rows are keyed by `CustomUser.id` through `user__user_id` (research R6).

## 3. Value types (`backend/apps/course/analytics/periods.py`)

### `Period`
String enum: `THIRTY = "30"`, `NINETY = "90"`, `ALL = "all"`.
- `parse_period(raw: str | None) -> Period`: `None` gives `THIRTY`. Anything else outside the enum raises
  `InvalidPeriod`, which the view turns into a 400.
- `Period.label`: `"30d" | "90d" | "all"` (wire value).

### `Window`
| Field | Type | Rule |
|-------|------|------|
| `start` | `date \| None` | `30d`: today − 29. `90d`: today − 89. `all`: earliest counted enrollment date, or `None` |
| `end` | `date` | today (UTC) |

Cohort lower bound: `enrolled_at >= datetime.combine(start, 00:00, UTC)` when `period != ALL`.

### `Bucket`
| Field | Type | Rule |
|-------|------|------|
| `start` | `date` | Inclusive. Clipped to `window.start` |
| `end` | `date` | Inclusive. Clipped to `window.end` |
| `count` | `int ≥ 0` | Counted enrollments with `start ≤ enrolled_at.date() ≤ end` |

`build_buckets(period, window, enrolled_dates) -> list[Bucket]`:
- `30d`: 30 one-day buckets.
- `90d`: Monday-start weeks. The first and last are clipped.
- `all`: calendar months from `window.start`'s month. The first and last are clipped. `[]` when
  `window.start is None`.

Buckets are contiguous, never overlap, cover the window exactly, and `sum(count) == active_students`
(per-course scope) or `== cohort pair count` (aggregate).

## 4. Definitions (`backend/apps/course/analytics/metrics.py`, pure)

Inputs are plain data, not ORM objects:

- `CourseShape`: `course_id`, `title`, `sections: list[SectionShape]` (curriculum order)
- `SectionShape`: `section_id`, `title`, `order`, `lecture_count`, `quiz_id | None`
- `StudentCourseProgress`: for one cohort pair, `done_by_section: dict[section_id, int]` and
  `passed_quiz_ids: set[int]`, `attempted_quiz_ids: set[int]`

| Function | Rule (spec ref) |
|----------|-----------------|
| `section_completed(section, progress)` | `quiz_id` → `quiz_id in passed_quiz_ids`. Else `lecture_count ≥ 1 and done == lecture_count` (FR-014) |
| `course_completed(course, progress)` | `total_lectures + total_quizzes ≥ 1` **and** every section has `done == lecture_count` **and** every `quiz_id` is passed (FR-007) |
| `stuck_section(course, progress)` | `None` if completed. With no completed section, the first section. Otherwise the section after the highest-ordered completed one. If there is none, the first section with `done < lecture_count` or an unpassed quiz (FR-015) |
| `rate(numerator, denominator)` | `None` if `denominator == 0`, else `round(n / d, 4)` |

## 5. Computed DTOs (`backend/apps/course/analytics/dto.py`, frozen dataclasses)

### `CompletionStat`
| Field | Type | Rule |
|-------|------|------|
| `rate` | `float \| None` | `rate(completed, total)` (FR-008) |
| `completed` | `int` | Cohort pairs whose course is completed |
| `total` | `int` | Cohort pairs |

### `QuizPassStat`
| Field | Type | Rule |
|-------|------|------|
| `rate` | `float \| None` | `rate(passed, attempted)` (FR-009) |
| `passed` | `int` | Attempted (student, quiz) pairs with ≥ 1 passed attempt |
| `attempted` | `int` | (student, quiz) pairs with ≥ 1 attempt, among cohort pairs |
| `has_quizzes` | `bool` | Any current quiz exists in scope (drives "No quizzes") |

### `SectionDropOff`
| Field | Type | Rule |
|-------|------|------|
| `section_id` | `int` | |
| `title` | `str` | |
| `order` | `int` | Curriculum position |
| `count` | `int ≥ 0` | Not-completed cohort students stuck here (FR-013) |

Every current section appears, in `order`. `sum(count) == total − completed`.

### `CourseDropOff`
| Field | Type | Rule |
|-------|------|------|
| `course_id` | `int` | |
| `title` | `str` | |
| `drop_off_rate` | `float` | `round(not_completed / total, 4)`. Never null (total ≥ 1) |
| `not_completed` | `int` | |
| `total` | `int ≥ 1` | Cohort pairs for this course |

Only courses with `total ≥ 1`. Order: `drop_off_rate` desc, `not_completed` desc, `title` asc, `course_id` asc
(FR-019a).

### `AnalyticsSnapshot`
| Field | Type | Present in |
|-------|------|------------|
| `scope` | `"course" \| "instructor"` | both |
| `course` | `{id, title} \| None` | course only (`None` for instructor) |
| `period` | `"30d" \| "90d" \| "all"` | both |
| `window` | `Window` | both |
| `completion` | `CompletionStat` | both |
| `quiz_pass` | `QuizPassStat` | both |
| `active_students` | `int` | both. Per course = cohort pairs. Aggregate = distinct users (FR-018) |
| `enrollments_over_time` | `list[Bucket]` | both |
| `section_drop_off` | `list[SectionDropOff]` | **course scope only** |
| `course_drop_off` | `list[CourseDropOff]` | **instructor scope only** |
| `courses_count` | `int` | **instructor scope only**. Owned courses, which drives the no-courses empty state (FR-024) |

`to_dict()` emits dates as ISO `YYYY-MM-DD` and omits the key that doesn't belong to the scope.

## 6. Invariants (asserted in tests)

- **I1**: Every row read is filtered to courses owned by the session's `InstructorProfile`. No id from the
  client widens scope (FR-025).
- **I2**: `0 ≤ completed ≤ total`, `0 ≤ passed ≤ attempted`, and every rate is in `[0, 1]` or `null`.
- **I3**: `sum(section_drop_off.count) == completion.total − completion.completed` (course scope, when the course has ≥ 1 section; a course with no sections has `section_drop_off == []`).
- **I4**: `sum(course_drop_off.total) == completion.total` and
  `sum(course_drop_off.not_completed) == completion.total − completion.completed` (instructor scope).
- **I5**: `sum(enrollments_over_time.count) == completion.total`.
- **I6**: Per course, `active_students == completion.total`. Aggregate: `active_students ≤ completion.total`.
- **I7**: No `user_id`, name, email or avatar appears anywhere in the snapshot (FR-028).
- **I8**: Query count is identical for 1 and 10 courses (research R6).
- **I9**: Changing only `period` never changes which courses, sections or curriculum are read, only the cohort.

## 7. Frontend types (`front-end/src/featuers/instructor-analytics/`)

Inferred from Zod schemas in `schemas/instructorAnalytics.schma.ts`:

```text
PeriodParam        = '30' | '90' | 'all'                     // address + request value
PeriodLabel        = '30d' | '90d' | 'all'                   // response value
Window             = { start: string | null; end: string }
Bucket             = { start: string; end: string; count: number }
CompletionStat     = { rate: number | null; completed: number; total: number }
QuizPassStat       = { rate: number | null; passed: number; attempted: number; has_quizzes: boolean }
SectionDropOff     = { section_id: number; title: string; order: number; count: number }
CourseDropOff      = { course_id: number; title: string; drop_off_rate: number; not_completed: number; total: number }
CourseAnalytics    = { scope: 'course'; course: {id, title}; period; window; completion; quiz_pass;
                       active_students; enrollments_over_time: Bucket[]; section_drop_off: SectionDropOff[] }
InstructorAnalytics= { scope: 'instructor'; period; window; completion; quiz_pass; active_students;
                       enrollments_over_time: Bucket[]; course_drop_off: CourseDropOff[]; courses_count: number }
```

Helpers in `types/instructorAnalytics.types.ts`:
- `normalizePeriod(raw: string | null): PeriodParam`: FR-004a fallback.
- `percent(n, d): number`: `Math.round(n / d * 100)`, computed from counts (research R5).
- `emptyLabel(period: PeriodLabel)`: `"No data yet"` for `all`, otherwise `"No data in this period"`.
