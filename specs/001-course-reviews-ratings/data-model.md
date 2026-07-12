# Phase 1 Data Model: Course Reviews and Ratings

## New entity (owned by the `reviews` app)

### Review

One student's rating of one course. Hard-deleted on student delete or admin removal (no
soft-delete state — per Clarifications 2026-07-09).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | AutoField | PK | |
| user | FK → `authentication.StudentProfile` | non-null, `on_delete=CASCADE` | The reviewer. CASCADE: deleting the student removes their reviews. |
| course | FK → `course.Course` | non-null, `on_delete=CASCADE`, `related_name='reviews'` | CASCADE: deleting a course removes its reviews (edge case). |
| rating | `PositiveSmallIntegerField` | `validators=[MinValueValidator(1), MaxValueValidator(5)]` | Whole stars 1–5 (FR-005). |
| comment | `TextField` | `blank=True`, bounded max length (e.g. 2000) enforced in serializer | Optional free text (FR-006). |
| created_at | `DateTimeField` | `auto_now_add=True` | FR-007. |
| updated_at | `DateTimeField` | `auto_now=True` | FR-007; changes on edit. |

**Meta**
- `unique_together = ('user', 'course')` — one review per student per course (FR-001, FR-004).
- `ordering = ['-created_at']` — newest first default (FR-017).
- Index on `course` (FK, for the per-course list/aggregate) and on `(user,)`.

**Business rules enforced in the view/serializer (not columns)**
- Author must be **enrolled** and must have **completed the course** (100%) — `has_completed_course`
  (FR-002). Checked on create.
- Author must **not** be the course's instructor (FR-003, edge case "self-review").
- Duplicate (same user+course) → 409/validation error offering update instead of a second row
  (FR-004); DB `unique_together` is the backstop.

---

## Existing entities — changes

### course.Course (denormalized aggregate — already present, now maintained)

No new columns. Existing fields become **derived and kept in sync**:

| Field | Existing type | New behavior |
|-------|---------------|--------------|
| rating | `DecimalField(max_digits=6, decimal_places=1)` | Recomputed = `round(Avg(review.rating), 1)` on each review write. When `reviews_count == 0`, value is ignored by UI ("not yet rated"). |
| reviews_count | `IntegerField` | Recomputed = `Count(reviews)`; `0` ⇒ "not yet rated" state. |

Maintained by `reviews/utils.recalculate_course_rating(course)` inside `transaction.atomic()` after
every create/update/delete.

### authentication.InstructorProfile (no schema change)

Instructor aggregate is **computed on read**, not stored:
`reviews/utils.get_instructor_rating(instructor)` →
`Review.objects.filter(course__instructor=instructor, course__is_published=True).aggregate(avg=Avg('rating'), n=Count('id'))`
Returned as `{ avg_rating: round(avg,1) | null, reviews_count: n }`; `n == 0` ⇒ "not yet rated".

---

## Relationships

```
StudentProfile 1───∞ Review ∞───1 Course ∞───1 InstructorProfile
                                   │
                     (denormalized rating / reviews_count kept in sync)

Review eligibility reads (read-only):
Course ──< Section ──< Lecture ──< LectureProgress (progress app)   # 100% completion gate
```

## Derived / computed values

| Value | Source | Where |
|-------|--------|-------|
| Course average rating | `round(Avg(Review.rating),1)` | stored on `Course.rating` |
| Course review count | `Count(Review)` | stored on `Course.reviews_count` |
| Instructor avg rating + count | `Avg/Count` over published-course reviews | computed in `get_instructor_rating` (FR-014) |
| Is-eligible-to-review | 100% `LectureProgress` completion | `has_completed_course` (FR-002) |

## Lifecycle / state transitions

```
(eligible student, no review)  --create-->  Review(created_at,updated_at)
Review  --student edit-->  Review(updated_at bumped)      → recompute course + instructor aggregates
Review  --student delete-->  (row hard-deleted)           → recompute aggregates
Review  --admin remove-->    (row hard-deleted)           → recompute aggregates
Course  --publish/unpublish--> (no review change)         → instructor aggregate changes on next read (FR-015)
```

## TypeScript interfaces (frontend `reviews.types.ts`)

```typescript
export interface Review {
  id: number;
  rating: number;          // 1..5
  comment: string;         // "" when none
  created_at: string;      // ISO
  updated_at: string;      // ISO
  // present on public course-review payloads:
  student_name?: string;
  student_avatar?: string | null;
  // present on the student's own-review payloads:
  course_id?: number;
  course_title?: string;
  course_thumbnail?: string;
}

export interface CourseReviewsSummary {
  average: number;                 // ignore when count === 0
  count: number;                   // 0 ⇒ "not yet rated"
}

export interface CourseReviewsPage extends CourseReviewsSummary {
  results: Review[];               // paginated slice (page_size 6)
  next: string | null;
  previous: string | null;
}

export interface ReviewableCourse {
  course_id: number;
  title: string;
  thumbnail: string;
  instructor_name: string;
}

export interface InstructorRating {   // added onto the existing instructor_profile payload
  avg_rating: number | null;          // null ⇒ not yet rated
  reviews_count: number;
}

export interface SubmitReviewInput { course_id: number; rating: number; comment?: string; }
export interface UpdateReviewInput { rating: number; comment?: string; }
```
