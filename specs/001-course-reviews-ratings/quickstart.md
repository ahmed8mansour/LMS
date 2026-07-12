# Quickstart: Course Reviews and Ratings

How to build, wire, and verify this feature end to end. Two independent slices:
**(1) course rating**, **(2) instructor rating**.

## Prerequisites

- Backend running: `cd backend && env\Scripts\activate && python manage.py runserver`
- Frontend running: `cd front-end && npm run dev`
- At least one student account **enrolled in and 100%-completed** a course (needed to satisfy the
  review-eligibility gate). Complete a course via the dashboard learn flow, or seed
  `LectureProgress` rows.

---

## Slice 1 — Course rating

### Backend
1. Create app `apps/reviews/` (clone the `apps/progress/` file layout).
2. `Review` model (see data-model.md). `python manage.py makemigrations reviews && migrate`.
3. `reviews/utils.py`:
   - `has_completed_course(student_profile, course)` — reuse `LectureProgress` completion math.
   - `recalculate_course_rating(course)` — `Avg`/`Count` → save `Course.rating`, `reviews_count`
     inside `transaction.atomic()`.
4. Serializers + `StudentReviewViewSet` + `ReviewableCoursesView` + `CourseReviewsView` +
   `AdminReviewDeleteView`; `ReviewPageNumberPagination(page_size=6)`.
5. Register: add `'apps.reviews'` to `INSTALLED_APPS`; add
   `path('reviews/', include('apps.reviews.urls'))` to `config/urls.py`.
6. (Decision D4) Add a data migration / management command to recompute all courses' denormalized
   `rating`/`reviews_count` from `Review`. **Confirm with user first** — this resets demo seed
   ratings to "not yet rated" until real reviews exist.

### Frontend
1. `featuers/reviews/`: `types`, `schemas/reviews.schma.ts` (Zod: rating 1–5, comment ≤2000),
   `api/reviews.api.ts`, hooks (`useCourseReviews`, `useReviewableCourses`, `useMyReviews`,
   `useSubmitReview`, `useUpdateReview`, `useDeleteReview`).
2. Atoms: `StarRating` (display, supports fractional average) + `StarInput` (interactive form).
3. Course-detail carousel: build `ReviewsCarousel` + `ReviewCard` + a small `ReviewsHeader`
   (average + count only). Mount `<ReviewsCarousel courseId={id}/>` in `CourseDetailPage.tsx`.
4. `CourseFeedback.tsx`: **delete the mock distribution/progress bars**
   (`["80%","45%","30%","100%","10%"]`) entirely — no distribution chart. Replace that section with
   the `ReviewsCarousel` (average + count header, "Not yet rated" when `count === 0`). The
   `CourseFeedback` component may be removed outright once the carousel supersedes it.
5. Rewrite `app/dashboard/(main)/reviews/page.tsx` using **project tokens** (`darkmint`,
   `darktext`, `graytext2`, `lightbg`, `darkbg`) — drop the Material `surface-*`/`on-*` tokens and
   `material-symbols-outlined`; compose `ReviewSubmissionCard` (from reviewable-courses) +
   `MyReviewsList` (edit/delete).

### Verify slice 1 (use preview tools / browser)
- As an eligible student, submit a review on `/dashboard/reviews` → toast success; the course
  disappears from "reviewable" and appears under "Your Submitted Reviews".
- Open `/courses/{id}` → the reviews carousel shows the new review; the carousel's average + count
  header and the hero `reviews_count` reflect it. Confirm the old mock distribution bars are gone
  (`preview_snapshot`).
- Edit then delete the review → aggregates update both places.
- Negative checks (expect rejection): review while <100% complete, as the instructor, or a second
  time.
- `GET /reviews/course/{id}/` payload average/count equals a manual recompute (SC-003).

---

## Slice 2 — Instructor rating

### Backend
1. `reviews/utils.get_instructor_rating(instructor)` — `Avg`/`Count` over `Review` where
   `course__instructor=instructor, course__is_published=True`.
2. Edit `apps/course/serializers.py` `get_instructor_profile` (or the instructor block) to add
   `avg_rating` (null when count 0) and `reviews_count`.

### Frontend
1. `CourseInstructor.tsx`: **delete the hardcoded** "4.9 Instructor Rating" / "12,450 Reviews";
   read `profile.avg_rating` + `profile.reviews_count`; show "Not yet rated" when count 0. (The
   "45,820 Students" figure is out of scope — leave or wire to real students separately.)

### Verify slice 2
- Give an instructor reviews across ≥2 **published** courses; open `/courses/{id}` → instructor
  block shows the combined average/count (SC-004). Unpublish one course → aggregate drops that
  course's reviews on refresh (FR-015). An instructor with no reviews shows "Not yet rated".

---

## Out of scope — course-discovery
Do **not** touch `apps/course/views.py` or `apps/course/pagination.py`. No `?sort=highest_rated`,
no course-card changes. The existing `?rating=` filter already works and only depends on the
denormalized `Course.rating` this feature keeps accurate.

## Done when
- All SC-001…SC-006 pass; constitution gates (types, tokens, auth, tests) green; `_overview.md`
  "Reviews System (Partial)" note updated to reflect the implemented state.
