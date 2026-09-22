# Data Model: Instructor Reviews

**Feature**: 012-instructor-reviews | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**No migration.** This feature reads existing tables and stores nothing. Every entity below is either an
existing model read unchanged, or a value computed per request and discarded.

---

## 1. Existing models read (unchanged)

### `Review` — `apps/reviews/models.py`

| Field | Type | Used for |
|-------|------|----------|
| `id` | PK | The row's identity on the wire |
| `user` | FK → `StudentProfile` | The reviewer, reached as `user.user` for name and picture |
| `course` | FK → `Course`, `db_index=True`, `related_name='reviews'` | Scope and ownership; the row's course title |
| `rating` | `PositiveIntegerField`, validated 1–5 | The stars, the `rating` filter, `avg_rating`, `five_star_count` |
| `comment` | `TextField(blank=True)` | The comment. **`''` when absent, never `NULL`** |
| `created_at` | `auto_now_add` | `this_month_count` only |
| `updated_at` | `auto_now` | The date shown, and the sort key |

**`Meta.ordering = ['-created_at']`** — a default this feature must override explicitly on every queryset
(research R8). Left untouched: it is correct for the public list.

**`Meta.unique_together = ['user', 'course']`** — one review per student per course. This is why a row can be
keyed on the review id with no ambiguity, unlike 010's roster where a student repeats across courses.

### `Course` — `apps/course/models.py`

`instructor` (FK → `InstructorProfile`) is the ownership anchor; `title` is shown on every row. `is_published`
is **read by nothing here** — the scope is every owned course, published or not (spec Clarifications, and
what 008's `_recent_reviews` already does).

### `CustomUser` — `apps/authentication/models.py`

`first_name`, `last_name`, `username`, `profile_picture`. Reached as `review.user.user`: `Review.user` is a
`StudentProfile`, and the person's details live one hop further on. Displayed name and its username fallback
come from `person_name()` in `apps/course/dashboard/service.py` — imported, not restated, so 008, 010 and 012
cannot disagree about how a nameless student is shown.

### `InstructorProfile`

The caller, as `request.user.instructor_profile`. Its absence on a staff account is an explicit `403`, not an
empty page (FR-040).

---

## 2. Computed values (per request, never stored)

### `ReviewStats`

Produced by one `.aggregate()` over the **unfiltered** scope (research R4, R5).

| Key | Type | Definition | Spec |
|-----|------|------------|------|
| `avg_rating` | `float \| null` | Mean of `rating` over the scope, one decimal. `null` — never `0.0` — when the scope is empty | FR-008, FR-012 |
| `total_reviews` | `int` | Count of reviews in the scope | FR-009 |
| `five_star_count` | `int` | Count where `rating == 5`. The client divides by `total_reviews` | FR-010, R6 |
| `this_month_count` | `int` | Count where `created_at >= ` first instant of the current UTC calendar month | FR-011, R7 |

**Invariants**
- Independent of `?rating=` (FR-007). Present on every page (P4).
- `total_reviews` equals the page's `count` **only when `?rating=` is absent** (FR-013). Under a filter,
  `count` describes the filtered list while `total_reviews` describes the scope — by design.
- `five_star_count <= total_reviews`; `this_month_count <= total_reviews`.
- `total_reviews == 0` ⟺ `avg_rating is None` ⟺ the client shows the "no reviews yet" state.

### `ReviewRow`

One serialized review (research R14).

| Key | Type | Notes |
|-----|------|-------|
| `id` | `int` | The **review** id. Unique per row in both scopes, via `unique_together` |
| `rating` | `int` 1–5 | Rendered as stars *and* readable as a number (FR-017) |
| `comment` | `string` | `''` when none was written; the client renders that explicitly (FR-018) |
| `updated_at` | `string` | `"YYYY-MM-DD"`, UTC, **date only** (FR-019). Not a timestamp — never `new Date()` it |
| `reviewer` | `{name, avatar}` | `PersonRef`. `name` falls back to username; `avatar` is `null` when absent or `''` |
| `course` | `{id, title}` | `CourseRef`. Present in **both** scopes, per 010's precedent |

**Nothing may be added to this set.** FR-039 and SC-007 restrict a row to these fields; a privacy test asserts
the exact key set over the raw response body, so a convenient extra field fails a test rather than quietly
leaking a student's email, orders, progress or quiz results.

### `ReviewsPage`

The envelope (research R3).

```
{ stats: ReviewStats, count: int, next: url|null, previous: url|null, results: ReviewRow[] }
```

`count` is the number of reviews matching **scope + filter** — not `results.length`.

### `RatingFilter` (value)

`"all" | "5" | "4"`. Anything else on the wire or in the address resolves to `"all"` (research R11).

---

## 3. Query shapes

**Scope** (ownership outward, never a check that can be forgotten):

```
Review.objects.filter(course__instructor=<caller's profile>)
              .filter(course=<resolved course>)        # only when ?course= is present
```

**Stats**: the scope, `.aggregate(...)` — one query (R5).

**List**: the scope, `.filter(rating=5|4)` when filtered, `.select_related('user__user', 'course')`,
`.order_by('-updated_at', '-id')`, then paginated.

`select_related('user__user', 'course')` is what keeps name, picture and course title off the N+1 path — the
same two-hop join 008's `_recent_reviews` already uses.

### Query budget

| Scope | Queries | Breakdown |
|-------|---------|-----------|
| `?course` absent | **3** | stats · `COUNT(*)` · the page |
| `?course=42` | **4** | the same three · resolving `?course=` against the owned set |

Measured, not estimated — `PerformanceTests` pins both. `request.user.instructor_profile` does not appear:
the test fixture's `get_or_create` populates the reverse one-to-one cache on the user object
`force_authenticate` reuses. Behind real JWT authentication that lookup is a real query, so production
costs one more than the figures above.

Flat in the number of reviews. Pinned by `assertNumQueries` (quickstart §4).

The fourth query is the ownership check and **cannot** be folded into the main scope: an owned course with no
reviews must stay distinguishable from a course the caller does not own, and an empty result cannot tell those
two apart (FR-038).

---

## 4. State transitions

None. This feature creates, updates and deletes nothing, and adds no state to any existing entity. Reviews
continue to be written only by students through the existing eligibility path, and removed only by an
administrator.
