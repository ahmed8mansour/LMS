# Phase 0 Research: Course Reviews and Ratings

All spec-level `[NEEDS CLARIFICATION]` were resolved during `/speckit.clarify` (hard-delete,
retain-on-refund, published-courses-only). This document records the remaining **technical**
decisions needed before design.

---

## D1 — Aggregate storage: denormalized vs computed-on-read

**Decision**: **Split.** Keep the **course** aggregate *denormalized* on the existing
`Course.rating` / `Course.reviews_count` fields, recomputed on every review write. Compute the
**instructor** aggregate *on read*.

**Rationale**:
- Course-discovery (out of scope / untouched) already filters with
  `Course.objects.filter(rating__gte=…)` (`apps/course/views.py:174`) — that existing filter needs
  the value **in the DB column**, so the course aggregate must be denormalized and kept exact
  (SC-003). This feature only keeps that field correct; it does not modify discovery.
- The instructor aggregate is shown on exactly one surface (the course-detail `instructor_profile`
  block) for a single instructor per request, so a small aggregate query on read is cheap and is
  guaranteed correct at all times (SC-004) with zero extra sync code / signals.

**Alternatives considered**:
- *Denormalize instructor too (fields on `InstructorProfile`)*: needs recompute hooks on publish/
  unpublish and on every review write across all their courses — more moving parts for a
  single-surface value. Rejected.
- *Compute course aggregate on read*: cannot be filtered efficiently at the DB layer by the
  existing discovery filter. Rejected.

---

## D2 — Recompute strategy & concurrency

**Decision**: On every create/update/delete of a `Review`, recompute the owning course's average
and count **from scratch** inside a DB transaction:
`Review.objects.filter(course=c).aggregate(avg=Avg('rating'), n=Count('id'))`, then
`round(avg, 1)` (matches `Course.rating` = `DecimalField(decimal_places=1)`), `reviews_count = n`,
and `save(update_fields=[...])`.

**Rationale**: Full recompute is idempotent and immune to lost-update drift (SC-003, edge case
"concurrent reviews") — no incremental `F()` arithmetic to get wrong. Volume per course is small
(≤ low thousands), so a single aggregate query is fine. Wrap the review write + recompute in
`transaction.atomic()`.

**Alternatives**: Incremental `F('reviews_count') + 1` + running average — faster but fragile under
concurrency and on edit (rating delta). Rejected for correctness.

---

## D3 — "Not yet rated" signal without a schema change

**Decision**: Treat **`reviews_count == 0`** as the "not yet rated" state on both course and
instructor. Do not make `Course.rating` nullable (avoids touching the existing non-null column and
its seed data).

**Rationale**: FR-013 / SC-006 require a distinct unrated state, not a misleading 0.0. Driving the
UI off `reviews_count === 0` gives that state with no migration and no ambiguity. When count is 0,
frontend renders "Not yet rated"; `rating` value is ignored.

---

## D4 — Backfilling the existing denormalized seed values

**Decision**: Ship a **data migration** (or management command) in the new app that recomputes
`rating`/`reviews_count` for **all** courses from the (initially empty) `Review` table, so the
denormalized columns reflect reality from day one.

**Consequence / assumption to confirm with the user**: existing **demo/seed** `rating` and
`reviews_count` values (set directly on courses today, with no backing `Review` rows) will reset to
"not yet rated" until real reviews arrive. This is the price of SC-003 correctness. *If the user
wants to preserve seed ratings for demos, we instead skip the backfill and let values converge as
real reviews come in* — flagged in quickstart.

---

## D5 — Eligibility check reuses student-progress (the "big bond")

**Decision**: A `reviews/utils.py::has_completed_course(student_profile, course)` helper computes
completion the same way the dashboard does: total lectures in the course vs. distinct
`LectureProgress` rows with `is_completed=True` for that student. Eligible ⇔ total > 0 and
completed == total (100%).

**Rationale**: Mirrors `apps/progress/utils.get_student_sorted_courses` progress math
(`completed_count / total_count * 100`), reusing `apps.progress.models.LectureProgress` and
`apps.course.models.Lecture`. This is the concrete dependency on the student-progress feature
(FR-002). No new progress state is introduced.

**Alternatives**: A stored "completed course" flag — doesn't exist today and would duplicate
progress state. Rejected.

---

## D6 — Endpoint shape & auth (follow existing conventions)

**Decision**:
- **Student review CRUD** → a `StudentReviewViewSet` (DRF `ModelViewSet`) scoped to
  `request.user`, matching the ViewSet-for-CRUD convention (`_conventions.md`). `CookieJWTAuthentication`
  + `IsAuthenticated`.
- **Reviewable courses** and **public course reviews** → `APIView`s (like the progress app).
  Public course-reviews endpoint is **read-only and unauthenticated** (course detail is public).
- **Admin removal** → an admin-gated delete (reuse the existing `isAdmin` permission pattern) plus
  Django admin registration.
- Responses use **raw payloads / standard DRF pagination** (no `{data,status}` wrapper), per the
  corrected CLAUDE.md standard; errors as `{ "error": "…" }`.
- Pagination: `ReviewPageNumberPagination(page_size=6)`, cloning `enrollment.pagination.BillingPageNumberPagination`.

**Rationale**: Consistency with `progress` (APIViews) and `enrollment` billing (page-number
pagination, ViewSet/serializer split) minimizes review-surface and reuses known patterns.

---

## D7 — Instructor aggregate surfaced via the course serializer

**Decision**: Extend the course app's `get_instructor_profile` serialization to include
`avg_rating` and `reviews_count`, computed by `reviews/utils.get_instructor_rating(instructor)` =
aggregate over `Review` where `course.instructor == instructor` **and** `course.is_published=True`.
No new instructor endpoint.

**Rationale**: The course-detail page is the instructor's only UI surface (user-confirmed), and it
already receives `instructor_profile`. Adds a cross-app import (`course` → `reviews.utils`),
acceptable and one-directional.

---

## Summary of decisions

| # | Area | Decision |
|---|------|----------|
| D1 | Storage | Course aggregate denormalized; instructor aggregate computed on read |
| D2 | Recompute | Full recompute in a transaction on each write |
| D3 | Unrated state | `reviews_count == 0` drives "not yet rated" (no schema change to `rating`) |
| D4 | Backfill | Data migration recomputes all courses; seed demo ratings reset (confirm) |
| D5 | Eligibility | `has_completed_course` reuses `LectureProgress` (100% completion) |
| D6 | Endpoints | ViewSet for student CRUD; APIViews for read; admin-gated delete; page-number pagination |
| D7 | Instructor UI | Aggregate delivered through existing `instructor_profile` serialization |
