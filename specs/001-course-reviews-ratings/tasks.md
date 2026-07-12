# Tasks: Course Reviews and Ratings

**Input**: Design documents from `/specs/001-course-reviews-ratings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reviews-api.md, quickstart.md

**Tests**: Backend unit tests ARE included — Constitution Principle IV requires unit tests for
models/services. Frontend component tests are omitted (SHOULD, not MUST) and can be added later.

**Organization**: Tasks are grouped by user story. Two delivery slices from the spec:
*course rating* (US1, US2, US4) and *instructor rating* (US3).

## Path Conventions

Web app: backend `backend/apps/reviews/`, frontend `front-end/src/featuers/reviews/`. Course-app
edits under `backend/apps/course/` and `front-end/src/featuers/courses/`. **Course-discovery is out
of scope** — no changes to `apps/course/views.py` or `apps/course/pagination.py`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the new backend app and frontend feature module.

- [X] T001 [P] Create backend app skeleton `backend/apps/reviews/` mirroring `apps/progress/` (`__init__.py`, `apps.py` with `ReviewsConfig`, empty `admin.py`, `models.py`, `serializers.py`, `views.py`, `utils.py`, `tests.py`, `urls.py` with empty `urlpatterns`, `migrations/__init__.py`) — already scaffolded (django startapp) prior to this session
- [X] T002 Register the app: add `'apps.reviews'` to `INSTALLED_APPS` in `backend/config/settings.py` and `path('reviews/', include('apps.reviews.urls'))` in `backend/config/urls.py` — already wired prior to this session
- [X] T003 [P] Create frontend feature module skeleton `front-end/src/featuers/reviews/` with `index.ts` and empty `api/`, `hooks/`, `components/student/`, `components/course/`, `schemas/`, `types/`
- [X] T004 [P] Add TypeScript interfaces (`Review`, `CourseReviewsSummary`, `CourseReviewsPage`, `ReviewableCourse`, `InstructorRating`, `SubmitReviewInput`, `UpdateReviewInput`) to `front-end/src/featuers/reviews/types/reviews.types.ts` per data-model.md
- [X] T005 [P] Add Zod `reviewSchema` (rating integer 1–5, optional comment ≤2000 chars) to `front-end/src/featuers/reviews/schemas/reviews.schma.ts`
- [X] T006 [P] Create shared atoms `StarRating` (display, supports fractional average) in `front-end/src/components/atoms/StarRating.tsx` and `StarInput` (interactive form input) in `front-end/src/components/atoms/StarInput.tsx`, using project tokens (`darkmint`, `darktext`, `graytext2`), not Material tokens

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `Review` table and the course-aggregate recompute util that every review-write
story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Create `Review` model in `backend/apps/reviews/models.py` — implemented manually; reviewed and verified (fixed: `ordering` was ascending, now `['-created_at']`; dropped redundant `comment` `null=True`). Uses `PositiveIntegerField` not `PositiveSmallIntegerField` (accepted, non-blocking).
- [X] T008 Generate and apply migration — `0001_initial.py` + `0002_rename_reviews_review.py` + `0003_alter_review_options_alter_review_comment.py`; `makemigrations --check` confirms zero drift
- [X] T009 [P] Register `Review` in `backend/apps/reviews/admin.py` — basic `admin.site.register(Review)` (no custom `list_display`, acceptable)
- [X] T010 Course-rating recompute — implemented as `RatingComputing(course).update_course_rating()` (class-based, not the flat `recalculate_course_rating(course)` function named in this task) in `backend/apps/reviews/utils.py`. Fixed a critical bug: `filter(Course=...)` → `filter(course=...)`. Downstream tasks (T014, T031, T035, T042) will call this class-based API.
- [X] T011 [P] `reviewsAPI` skeleton created in `front-end/src/featuers/reviews/api/reviews.api.ts` — currently exported as `reviewAPI` (singular); rename to `reviewsAPI` before T018 builds on it, for consistency with `authAPI`/`coursesAPI`/`progressAPI`/`enrollmentAPI`.

**Checkpoint**: Review table exists and course aggregates can be recomputed — stories can begin.

---

## Phase 3: User Story 1 - Enrolled student rates and reviews a course (Priority: P1) 🎯 MVP

**Goal**: A student who completed a course submits one rating (1–5) + optional comment; the course
aggregate updates and the review is persisted.

**Independent Test**: As a 100%-completed student, POST a review → 201; course `rating`/`reviews_count`
recompute; the course drops off the reviewable list. Ineligible attempts (not enrolled, not
completed, self-review, duplicate) are rejected.

### Implementation for User Story 1

- [X] T012 [US1] Eligibility check — implemented as `StudentCoursesRating(student_profile, course).has_completed_course()` (class-based) in `backend/apps/reviews/utils.py`. Fixed a critical bug (`if total > 0` compared a dict, not the count — now `if total_lectures > 0`) and a correctness gap (completed-lectures query now filters `is_completed=True`).
- [X] T013 [P] [US1] `ReviewSerializer` + `ReviewableCourseSerializer` created in `backend/apps/reviews/serializers.py` — reviewed and verified: fixed a critical bug (`instructor_name` was computed by concatenating `CharField` instances at class-definition time, crashing on import; now a `SerializerMethodField`), a high-severity bug (`course_thumbnail` was `CharField`, now `ImageField` so `.url` resolves correctly), and a contract mismatch (`ReviewableCourseSerializer` exposed `id`, now aliased to `course_id` per contracts/reviews-api.md)
- [X] T014 [US1] Implemented `StudentReviewViewSet.create` in `backend/apps/reviews/views.py`: validates enrollment (403), `has_completed_course` (403), instructor-self-review (403), duplicate → 409 `{error, review_id}`; success path creates `Review` + calls `RatingComputing(course).update_course_rating()` inside `transaction.atomic()`. Scoped the ViewSet to `Create/List/Retrieve` mixins only (not full `ModelViewSet`) — update/destroy are deliberately not exposed yet since their aggregate-recompute logic is T035's job; exposing them now via the router would let a client silently desync `Course.rating`. Also fixed a serializer gap found while wiring this up: `course_id`/`course_title`/`course_thumbnail` needed `read_only=True` (DRF cannot write dotted-source fields via `.create()`), and added the `comment` `max_length=2000` cap from FR-006/data-model.md that T013 hadn't included.
- [X] T015 [US1] Implemented `ReviewableCoursesView` (GET `/reviews/student/reviewable-courses/`) in `backend/apps/reviews/views.py` — enrolled, not-yet-reviewed, completed courses via `StudentCoursesRating(...).has_completed_course()`
- [X] T016 [US1] Wired URLs in `backend/apps/reviews/urls.py` — `DefaultRouter` registers `StudentReviewViewSet` at `student/reviews`, plus `student/reviewable-courses/`
- [X] T017 [P] [US1] 12 backend unit/API tests in `backend/apps/reviews/tests.py` — eligibility (4 tests), aggregate recompute (2), and the full create endpoint (6: not-enrolled 403, not-completed 403, instructor-has-no-StudentProfile 404, success 201 + aggregate recompute, duplicate 409, out-of-range rating 400). All 12 pass against real Postgres (`manage.py test apps.reviews.tests`). Note: explicit self-review-via-matching-StudentProfile is untestable through this endpoint — an instructor account never has a `StudentProfile` under this schema's one-role-per-account signal, so it 404s before reaching that guard; the guard itself remains as defensive code per FR-003.
- [X] T018 [P] [US1] Added `submitReview(input)` and `getReviewableCourses()` to `front-end/src/featuers/reviews/api/reviews.api.ts`; also renamed the exported object `reviewAPI` → `reviewsAPI` (per T011 follow-up) and removed the placeholder `test()` function
- [X] T019 [P] [US1] Hooks `useReviewableCourses` (query, staleTime 5m) and `useSubmitReview` (mutation; onSuccess toast + invalidate `['reviewable-courses']`, `['course-reviews']`, `['dashboard']`) in `front-end/src/featuers/reviews/hooks/`
- [X] T020 [US1] Built `ReviewSubmissionCard` in `front-end/src/featuers/reviews/components/student/ReviewSubmissionCard.tsx` — course header (thumbnail/title/instructor), `Controller`-wrapped `StarInput`, comment textarea, React Hook Form + `zodResolver(reviewSchema)`, submits via `useSubmitReview` and resets on success; project tokens throughout
- [X] T021 [US1] Rewrote `front-end/src/app/dashboard/(main)/reviews/page.tsx` with project tokens only (no Material `surface-*`/`on-*` tokens or `material-symbols-outlined`); renders "Courses You Can Review" from `useReviewableCourses` with loading (`BounceLoader`), error, and "You're all caught up" empty states. The "Your Submitted Reviews" column is intentionally not built yet — that's T041 (US4)

**Checkpoint**: A completed student can submit a review from the dashboard; aggregates update.

---

## Phase 4: User Story 2 - Anyone reads reviews and the aggregate on a course (Priority: P1)

**Goal**: The course-detail page shows average + count and a carousel of individual reviews
(newest first), readable without auth. Mock distribution bars removed.

**Independent Test**: Seed a course with reviews; open `/courses/{id}` as a guest → average, count,
and paginated carousel render; a course with 0 reviews shows "Not yet rated"; no mock bars remain.

### Implementation for User Story 2

- [X] T022 [P] [US2] `PublicReviewSerializer` created in `backend/apps/reviews/serializers.py` (id, rating, comment, created_at, updated_at, `student_name`/`student_avatar` via `SerializerMethodField` resolving `review.user.user.*`) — correct, no issues found
- [X] T023 [US2] `ReviewPageNumberPagination` implemented in `backend/apps/reviews/pagination.py` — **`page_size = 2`, not the spec's documented 6** (deliberate design choice per user; the carousel UI only needs 2 cards visible at a time). Spec/contract docs (`contracts/reviews-api.md`, `data-model.md`) still say 6 and haven't been reconciled with this — cosmetic doc drift, not a functional issue.
- [X] T024 [US2] `CourseReviewsView` implemented in `backend/apps/reviews/views.py` + wired in `urls.py` at `GET /reviews/course/<int:course_id>/`, public (no `authentication_classes`/`permission_classes` override → DRF default `AllowAny`, correctly public). **Deliberately returns no `average`** per user's design note — the frontend already has `course.rating`/`course.reviews_count` from the course serializer, so this endpoint is just standard DRF page-number pagination (`count`/`next`/`previous`/`results`) with no separate summary object. **Bug fixed**: `get_queryset()` used to `return Response({"error": "Course not found"}, ...)` on a missing course, but `get_queryset()` must return a QuerySet, and `ListAPIView.paginate_queryset()` crashed calling `len()` on that `Response` (confirmed empirically: `TypeError: object of type 'Response' has no len()`, a 500). Now uses `get_object_or_404(Course, id=course_id)`, verified via `test_nonexistent_course_returns_404`.
- [X] T025 [P] [US2] 7 backend tests in `CourseReviewsAPITests` (`backend/apps/reviews/tests.py`) — public access without auth, empty course → `count:0`/`results:[]`, page size is 2, newest-first ordering, student_name/avatar resolution, cross-course isolation, and nonexistent course → 404. **19/19 tests pass** (`manage.py test apps.reviews.tests`) against real Postgres.
- [X] T026 [P] [US2] `getCourseReviews(course_id, page)` added to `front-end/src/featuers/reviews/api/reviews.api.ts`
- [X] T027 [P] [US2] `useCourseReviews(course_id, page)` hook in `front-end/src/featuers/reviews/hooks/useCourseReviews.tsx` — `keepPreviousData` used correctly, matches the `useStudentOrders` billing pagination pattern
- [X] T028 [P] [US2] `ReviewCard` rebuilt in `front-end/src/featuers/reviews/components/course/ReviewCard.tsx`. All flagged issues fixed: (1) avatar now uses the `Avatar`/`AvatarImage`/`AvatarFallback` atom (initials fallback) instead of passing text as a `next/image` `src`; dropped the `as any` cast. (2) `material-symbols-outlined` quote icon replaced with `FaQuoteRight` (react-icons, matches the rest of the codebase). (3) Rewritten with project tokens only (`darktext`/`graytext2`/`darkmint`/`graylighttext`); dropped shadcn/raw-hex/Tailwind-gray mixing and unused `dark:` variants (this app has no dark-mode toggle). (4) Removed `hidden md:block` — reviews now show on mobile. (5) Comment paragraph only renders when `comment` is non-empty. Also dropped the duplicate `ReviewCardProps` interface in favor of the existing `Review` type. Verified: `tsc --noEmit` (no new errors) and `eslint` (clean).
- [X] T029 [US2] Combined into `ReviewCarouselSection.tsx` per user's note — no separate `ReviewsHeader`; average/count aren't duplicated here since `CourseDetailPage.tsx`'s hero already renders `course.rating`/`course.reviews_count` above this section. All flagged issues fixed: (1) `material-symbols-outlined` chevrons replaced with `FaChevronLeft`/`FaChevronRight` (react-icons). (2) Removed the fragile `totalPages = count/results.length` calculation entirely — prev/next buttons now gate purely on `page <= 1` and `!reviewsPage?.next` (the reliable DRF-provided fields). (3) Replaced the shadcn `Button` atom (whose default filled variant was fighting the custom outline-circle classes) with plain `<button>` elements styled with project tokens, matching `ReviewSubmissionCard`'s existing pattern. (4) Implemented the skeleton-loader the user had left as an inline comment — two `ReviewCardSkeleton` placeholders (avatar circle, name/badge bars, star-row bar, two text lines) replace the generic spinner while loading. Verified: `tsc --noEmit` (no new errors) and `eslint` (clean).
- [X] T030 [US2] `CourseFeedback.tsx` deleted; `ReviewCarouselSection` mounted in `CourseDetailPage.tsx` in its place (`<ReviewCarouselSection course_id={course.id as number} />` — the `as number` cast is redundant since `course.id` is already typed `number`, harmless)

**Checkpoint**: Course-detail page shows real reviews; mock bars gone. Course-rating slice complete when combined with US1.

---

## Phase 5: User Story 3 - Ratings reflect on the instructor (Priority: P2)

**Goal**: The instructor block on the course-detail page shows an aggregate rating + review count
computed across the instructor's **published** courses.

**Independent Test**: Give an instructor reviews on ≥2 published courses; open `/courses/{id}` →
instructor block shows the combined average/count; unpublishing a course drops its reviews;
an instructor with 0 reviews shows "Not yet rated".

### Implementation for User Story 3

- [X] T031 [US3] Implement `get_instructor_rating(instructor)` in `backend/apps/reviews/utils.py` — `Review.objects.filter(course__instructor=instructor, course__is_published=True).aggregate(Avg('rating'), Count('id'))` → `{avg_rating: round(avg,1)|None, reviews_count: n}`
- [X] T032 [US3] Edit `backend/apps/course/serializers.py` instructor-profile serialization (`get_instructor_profile`) to add `avg_rating` and `reviews_count` from `get_instructor_rating` (course-app change only; do NOT touch `views.py`/`pagination.py`)
- [X] T033 [P] [US3] Backend unit test in `backend/apps/reviews/tests.py` — instructor aggregate includes only published-course reviews, excludes unpublished, returns not-yet-rated (`avg_rating None`) at 0
- [X] T034 [US3] Edit `front-end/src/featuers/courses/components/CourseDetailPage/courseid/CourseInstructor.tsx` — remove hardcoded "4.9 Instructor Rating" / "12,450 Reviews"; read `profile.avg_rating` + `profile.reviews_count`; show "Not yet rated" when count 0. Extend `InstructorProfile` in `front-end/src/featuers/courses/types/course.types.ts` with `avg_rating`/`reviews_count`

**Checkpoint**: Instructor-rating slice complete.

---

## Phase 6: User Story 4 - Student manages their own review (Priority: P2)

**Goal**: A student can view, edit, and delete their own review; edits/deletes recompute aggregates.

**Independent Test**: With an existing review, PATCH the rating → course average updates; DELETE →
review hard-deleted and aggregates recompute; editing another user's review returns 404.

### Implementation for User Story 4

- [X] T035 [US4] Add **list / partial_update / destroy** actions to `StudentReviewViewSet` in `backend/apps/reviews/views.py`, `get_queryset` scoped to `request.user`; call `recalculate_course_rating` after update and delete (hard delete)
- [X] T036 [US4] Ensure `ReviewSerializer` list output includes `course_id`, `course_title`, `course_thumbnail` (from T013) for the "Your Submitted Reviews" list
- [X] T037 [P] [US4] Backend unit tests in `backend/apps/reviews/tests.py` — edit recomputes aggregate, delete hard-deletes + recomputes, editing/deleting another user's review → 404
- [X] T038 [P] [US4] Add `getMyReviews()`, `updateReview(id, input)`, `deleteReview(id)` to `front-end/src/featuers/reviews/api/reviews.api.ts`
- [X] T039 [P] [US4] Hooks `useMyReviews` (query), `useUpdateReview`, `useDeleteReview` (mutations invalidating `['my-reviews']`, `['course-reviews']`, `['dashboard']`) in `front-end/src/featuers/reviews/hooks/`
- [X] T040 [US4] Build `MyReviewsList` (+ edit form/modal using `StarInput` + `reviewSchema`, and delete confirm) in `front-end/src/featuers/reviews/components/student/MyReviewsList.tsx`; project tokens
- [X] T041 [US4] Add the "Your Submitted Reviews" column (`MyReviewsList` from `useMyReviews`) to `front-end/src/app/dashboard/(main)/reviews/page.tsx`

**Checkpoint**: Full student manage flow works; course-rating slice fully done.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Moderation, backfill, docs, and end-to-end verification.

- [X] T042 Implement `AdminReviewDeleteView` (DELETE `/reviews/admin/reviews/<int:pk>/`, `IsAuthenticated` + `isAdmin`) in `backend/apps/reviews/views.py` + URL — hard-delete any review and call `recalculate_course_rating` (FR-010)
- [X] T043 [P] Backend unit test — admin removal recomputes aggregates; non-admin gets 403 (`backend/apps/reviews/tests.py`)
- [ ] T044 ⚠️ GATED — add a data migration / management command in `backend/apps/reviews/` to backfill `Course.rating`/`reviews_count` from `Review` (decision D4). **Confirm with the user first** — this resets existing demo seed ratings to "not yet rated" until real reviews exist
- [X] T045 [P] Export public components/hooks from `front-end/src/featuers/reviews/index.ts`
- [X] T046 [P] Update `specs/_overview.md` "Reviews System (Partial)" note to reflect the implemented state
- [ ] T047 Run `quickstart.md` end-to-end verification with preview tools — submit/edit/delete, course carousel, instructor aggregate, and all negative cases; confirm no mock distribution bars remain

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies.
- **Foundational (P2)**: needs Setup. **Blocks all user stories** (Review model + `recalculate_course_rating`).
- **US1 (P3)** and **US2 (P4)**: need Foundational. Largely independent of each other (different files); US1 = write path, US2 = public read path.
- **US3 (P5)**: needs Foundational. Independent (course serializer + `CourseInstructor`).
- **US4 (P6)**: needs Foundational and the `StudentReviewViewSet` created in **US1 (T014/T016)** and the `ReviewSerializer` (T013), since it extends them.
- **Polish (P7)**: T042/T043 need Foundational; T047 needs the slices you intend to demo.

### Story dependency notes

- US4 depends on US1's viewset/serializer/URLs (same `StudentReviewViewSet`).
- US1 and US4 both edit `dashboard/(main)/reviews/page.tsx` (T021 then T041) → sequential, not parallel.
- US1, US2 both add functions to `reviews.api.ts` and `serializers.py` → those specific tasks are not `[P]` with each other.

### MVP

MVP = **Setup + Foundational + US1 + US2** (the full *course-rating* read+write loop on the
dashboard and course-detail page). US3 (instructor) and US4 (manage) are incremental.

---

## Parallel Opportunities

- **Setup**: T001, T003, T004, T005, T006 in parallel (T002 after T001).
- **Foundational**: T009, T011 in parallel with T007→T008→T010 chain.
- **US1**: T013, T017, T018, T019 marked `[P]` (distinct files) can run alongside the backend
  view chain T012→T014→T015→T016; T020 needs T019; T021 needs T020.
- **US2**: T022, T025, T026, T027, T028 `[P]`; T029 needs T027/T028; T030 needs T029.
- **US3**: T033 `[P]` with the T031→T032 chain; T034 needs T032.
- **US4**: T037, T038, T039 `[P]`; T035→T036 backend; T040 needs T039; T041 needs T040 (and T021).

### Parallel example: User Story 2

```
# After Foundational, launch in parallel:
T022 Create PublicReviewSerializer in backend/apps/reviews/serializers.py
T026 Add getCourseReviews() in front-end/.../reviews/api/reviews.api.ts
T027 Hook useCourseReviews in front-end/.../reviews/hooks/useCourseReviews.tsx
T028 Build ReviewCard in front-end/.../reviews/components/course/ReviewCard.tsx
```

---

## Implementation Strategy

1. **Setup → Foundational** — app scaffolded, `Review` table + recompute util ready.
2. **US1** — submit a review from the dashboard → STOP and validate aggregates update.
3. **US2** — course-detail carousel + delete mock bars → **MVP course-rating loop done**, demo.
4. **US3** — wire the instructor aggregate on course-detail (instructor-rating slice).
5. **US4** — edit/delete own reviews on the dashboard.
6. **Polish** — admin moderation, gated backfill, `_overview.md` update, quickstart verification.

## Notes

- `[P]` = different files, no incomplete dependency.
- Backend tests included per Constitution IV; run them before moving to the next story.
- Course-discovery is out of scope — do not modify `apps/course/views.py` / `pagination.py`.
- Commit after each task or logical group; do not commit without the user's request.
