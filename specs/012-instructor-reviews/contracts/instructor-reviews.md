# API Contract: Instructor Reviews

**Feature**: 012-instructor-reviews | **Date**: 2026-09-21 | **Spec**: [spec.md](../spec.md)

One endpoint serves both review views (owner answer P1), returning the rating summary and one page of
reviews together (P2).

---

## 1. Endpoint

```
GET /reviews/instructor/reviews/
```

| | |
|---|---|
| **View** | `InstructorReviewsView(ListAPIView)` — `apps/reviews/views.py` |
| **Auth** | `CookieJWTAuthentication` (project default) |
| **Permissions** | `IsAuthenticated`, `isInstructor` |
| **Throttle** | scope `instructor_reviews`, `60/min` |
| **Methods** | `GET` only. `POST`/`PATCH`/`PUT`/`DELETE` → `405` (FR-041) |
| **Pagination** | `InstructorReviewsPagination(PageNumberPagination)`, `page_size = 10`, fixed |
| **Filters** | none from DRF — `?rating=` is parsed by the view (research R11) |

### Query parameters

| Name | Type | Default | Behaviour |
|------|------|---------|-----------|
| `course` | positive int | — | Absent → all owned courses. Present → that course, resolved against the owned set |
| `rating` | `5` or `4` | — | Absent or **anything else** (`all`, `3`, `abc`, `0`) → no filter, `200` |
| `page` | positive int | `1` | Out of range / unparseable → page 1 with `200` |

Unknown parameters are ignored. No parameter ever produces a `400`.

---

## 2. Success — `200 OK`

Payload returned directly; no envelope (CLAUDE.md). A standard DRF page-number object with `stats` added
(research R3).

```json
{
  "stats": {
    "avg_rating": 4.6,
    "total_reviews": 213,
    "five_star_count": 145,
    "this_month_count": 19
  },
  "count": 213,
  "next": "http://localhost:8000/reviews/instructor/reviews/?page=3",
  "previous": "http://localhost:8000/reviews/instructor/reviews/?page=1",
  "results": [
    {
      "id": 884,
      "rating": 4,
      "comment": "Clear explanations, but the ORM section moves fast.",
      "updated_at": "2026-07-14",
      "reviewer": { "name": "Maria Gomez", "avatar": "https://res.cloudinary.com/demo/image/upload/v1/maria.jpg" },
      "course": { "id": 42, "title": "Django for Beginners" }
    },
    {
      "id": 883,
      "rating": 5,
      "comment": "",
      "updated_at": "2026-07-12",
      "reviewer": { "name": "kmansour", "avatar": null },
      "course": { "id": 51, "title": "React Fundamentals" }
    }
  ]
}
```

### `stats` — the four tiles

| Key | Type | Meaning |
|-----|------|---------|
| `avg_rating` | `number \| null` | Mean rating over the scope, one decimal. `null` when the scope has no reviews — **never `0.0`** (FR-012) |
| `total_reviews` | `number` | Reviews in the scope |
| `five_star_count` | `number` | Reviews rated 5. The client computes the rate as `five_star_count / total_reviews` (research R6) |
| `this_month_count` | `number` | Reviews **created** since the first instant of the current UTC calendar month (research R7) |

`stats` describes the **whole scope** and does **not** change when `?rating=` is applied (FR-007, owner
answer P4). It is present on **every** page, not only the first.

Consequently `stats.total_reviews === count` only when `?rating=` is absent. Under a filter, `count`
describes the filtered list while `total_reviews` describes the scope. This is intended, and the tiles and
the paging line say different things on purpose.

### `results[]` — one review

| Key | Type | Notes |
|-----|------|-------|
| `id` | `number` | The **review** id, unique per row in both scopes |
| `rating` | `number` | `1`–`5` |
| `comment` | `string` | `""` when the student wrote none — never `null` (FR-018) |
| `updated_at` | `string` | `"YYYY-MM-DD"`, UTC, **date only** (FR-019) |
| `reviewer.name` | `string` | First + last name, falling back to username. Never blank (FR-015) |
| `reviewer.avatar` | `string \| null` | `null` when absent or empty (FR-016) |
| `course.id` | `number` | Always present, in **both** scopes |
| `course.title` | `string` | |

**Ordering**: `updated_at` descending, tie-broken by `id` descending (research R8). A student who edits an
old review moves it to the top.

**Nothing may be added to a row.** FR-039 and SC-007 fix this key set; a privacy test asserts it over the raw
response body.

---

## 3. Errors

Per CLAUDE.md: `{"error": "message"}`. No raw exceptions, no stack traces.

| Status | When | Body |
|--------|------|------|
| `401` | Not authenticated | DRF default |
| `403` | Authenticated, not an instructor | DRF default |
| `403` | Instructor gate passed, **no** `InstructorProfile` | `{"error": "No instructor profile is associated with this account.", "code": "no_instructor_profile"}` |
| `404` | `?course=` names a course that does not exist, belongs to someone else, or is unparseable | `{"error": "Course not found."}` |
| `405` | Any method but `GET` | DRF default |
| `429` | Over `60/min` | DRF default |
| `500` | Unexpected failure | `{"error": "We couldn't load the reviews. Please try again."}` |

The three `404` causes are **indistinguishable** by design (FR-038): a different response for any of them
would turn this endpoint into a probe for which course ids exist. The `403` shape matches 009 and 010, so the
client's existing no-profile state handles it unchanged.

---

## 4. Worked examples

**The sidebar page, first load** — `GET /reviews/instructor/reviews/`
Every owned course, published or not. `stats` over all of them, page 1 of 10 reviews, newest-updated first.

**The workspace tab, filtered** — `GET /reviews/instructor/reviews/?course=42&rating=4&page=2`
Course 42 only (ownership resolved first, else `404`). `stats` still describes **all** of course 42's
reviews; `count` and `results` describe its 4-star ones; page 2.

**A scope with no reviews** — `GET /reviews/instructor/reviews/?course=77`

```json
{
  "stats": { "avg_rating": null, "total_reviews": 0, "five_star_count": 0, "this_month_count": 0 },
  "count": 0, "next": null, "previous": null, "results": []
}
```

`avg_rating: null` is what tells the client to show "no reviews yet" rather than a 0.0 tile (FR-012).

**A filter that matches nothing** — `GET /reviews/instructor/reviews/?course=42&rating=4`, all 5-star

```json
{
  "stats": { "avg_rating": 5.0, "total_reviews": 8, "five_star_count": 8, "this_month_count": 2 },
  "count": 0, "next": null, "previous": null, "results": []
}
```

`total_reviews: 8` with `count: 0` is exactly how the client distinguishes "no reviews match this filter"
from "no reviews yet" (FR-026 vs FR-042).

**A stale address** — `GET /reviews/instructor/reviews/?rating=3&page=999`
`rating=3` is not in this feature's vocabulary → no filter. `page=999` is out of range → page 1. `200`, with
the first page of everything. Neither produces an error (FR-027, FR-031).

---

## 5. Frontend contract

`RatingFilter = "all" | "5" | "4"`. The address carries `?rating=` and `?page=`, both dropped when at their
default, both restored on refresh, Back/Forward, and shared links (FR-027, FR-030).

The response is parsed by Zod (`ReviewsPageSchema`), not cast — a payload that does not match throws, so the
page shows its error state instead of rendering missing values as blanks or zeros. `avg_rating` is
`.nullable()`, deliberately not `.optional()` with a default: defaulting it to `0` would print "0.0" for a
course nobody has reviewed, which FR-012 forbids.
