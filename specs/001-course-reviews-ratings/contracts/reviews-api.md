# API Contract: Course Reviews and Ratings

All responses are **raw payloads** or **standard DRF page-number pagination** (no `{data,status}`
wrapper), per the corrected CLAUDE.md standard. Errors: `{ "error": "message" }` or DRF field
errors `{ "field": ["message"] }`. Auth via `CookieJWTAuthentication` unless marked **public**.

Base include: `path('reviews/', include('apps.reviews.urls'))` in `config/urls.py`.

---

## 1. Public — course reviews (carousel + summary)

`GET /reviews/course/{course_id}/?page={n}` — **public, read-only**

Serves User Story 2. Aggregate fields (`average`, `count`) repeat on every page (cheap) so the
summary header and the carousel list come from one call. **No per-star distribution** is returned
(distribution is out of scope — FR-012).

**200**
```json
{
  "average": 4.6,
  "count": 128,
  "next": "http://localhost:8000/reviews/course/1/?page=2",
  "previous": null,
  "results": [
    {
      "id": 41,
      "rating": 5,
      "comment": "Excellent, very thorough.",
      "created_at": "2026-06-30T10:00:00Z",
      "updated_at": "2026-06-30T10:00:00Z",
      "student_name": "Sarah J.",
      "student_avatar": "https://res.cloudinary.com/..."
    }
  ]
}
```
- `count == 0` ⇒ frontend renders "Not yet rated"; `average` ignored.
- Page size 6. Order newest first (FR-017).

---

## 2. Student — reviewable courses (submission cards)

`GET /reviews/student/reviewable-courses/` — auth (student)

Serves User Story 1 (the "Courses You Can Review" column). Returns the student's **completed**
courses that they have **not yet reviewed**.

**200**
```json
[
  { "course_id": 7, "title": "Advanced UI Design Systems", "thumbnail": "https://...", "instructor_name": "Sarah Jenkins" }
]
```
Empty list ⇒ "You're all caught up" empty state.

---

## 3. Student — own reviews CRUD (`StudentReviewViewSet`)

Scoped to `request.user`. Auth (student).

### List own reviews
`GET /reviews/student/reviews/` → **200**
```json
[
  {
    "id": 41, "rating": 5, "comment": "Excellent...",
    "created_at": "2026-06-30T10:00:00Z", "updated_at": "2026-06-30T10:00:00Z",
    "course_id": 7, "course_title": "Advanced UI Design Systems", "course_thumbnail": "https://..."
  }
]
```

### Create
`POST /reviews/student/reviews/`
```json
{ "course_id": 7, "rating": 5, "comment": "Excellent course!" }
```
**201** → the created review object (as above).

Validation / errors:
| Condition | Status | Body |
|-----------|--------|------|
| Not enrolled | 403 | `{ "error": "You are not enrolled in this course." }` |
| Course not completed (eligibility, FR-002) | 403 | `{ "error": "Finish the course before reviewing it." }` |
| Reviewer is the course instructor (FR-003) | 403 | `{ "error": "You cannot review your own course." }` |
| Already reviewed (FR-004) | 409 | `{ "error": "You already reviewed this course.", "review_id": 41 }` |
| rating out of 1–5 / missing | 400 | `{ "rating": ["Ensure this value is between 1 and 5."] }` |
| comment too long | 400 | `{ "comment": ["Ensure this field has no more than 2000 characters."] }` |

On success: recompute the course aggregate (and thus the instructor aggregate on next read).

### Update (edit own review)
`PATCH /reviews/student/reviews/{id}/`
```json
{ "rating": 4, "comment": "Updated thoughts." }
```
**200** → updated object. `404` if not the caller's review. Recompute aggregates (FR-009).

### Delete (hard delete)
`DELETE /reviews/student/reviews/{id}/` → **204**. `404` if not caller's. Recompute aggregates
(FR-009). Row is physically removed (Clarifications).

---

## 4. Admin — remove a review (moderation)

`DELETE /reviews/admin/reviews/{id}/` — auth + `isAdmin`

**204**. Hard-deletes any review and recomputes aggregates (FR-010, same effect as student delete).
Also available via Django admin. `403` for non-admins.

---

## 5. Instructor aggregate — via existing course serializer (no new endpoint)

`GET /courses/student/courses/{id}/` (existing course-detail endpoint) — the `instructor_profile`
block gains two fields:

```json
{
  "instructor_profile": {
    "first_name": "Sarah",
    "last_name": "Jenkins",
    "profile_picture": "https://...",
    "specific_data": { "title": "Senior Designer", "about": "..." },
    "avg_rating": 4.9,
    "reviews_count": 12450
  }
}
```
`reviews_count == 0` ⇒ `avg_rating: null`, frontend shows "Not yet rated" (FR-014, FR-018, SC-006).
Aggregate is over the instructor's **published** courses only.

> **Course-discovery is out of scope** — this feature adds no `?sort=` key and changes nothing in
> `apps/course/views.py` / `pagination.py`. The existing `?rating=` filter is left as-is and relies
> only on the denormalized `Course.rating` this feature keeps accurate (FR-019).

---

## Endpoint ↔ requirement / story map

| Endpoint | Story | Requirements |
|----------|-------|--------------|
| `GET /reviews/course/{id}/` | US2 | FR-011, FR-013, FR-016, FR-017 |
| `GET /reviews/student/reviewable-courses/` | US1 | FR-001, FR-002 |
| `POST /reviews/student/reviews/` | US1 | FR-001–FR-007, FR-011 |
| `GET/PATCH/DELETE /reviews/student/reviews/{id}/` | US4 | FR-008, FR-009 |
| `DELETE /reviews/admin/reviews/{id}/` | (moderation) | FR-010 |
| `instructor_profile` on course detail | US3 | FR-014, FR-015, FR-018 |
