# Implementation Plan: Course Reviews and Ratings

**Branch**: `001-course-reviews-ratings` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-course-reviews-ratings/spec.md`

## Summary

Let a student who has **completed** a course leave one editable star rating (1–5) + optional
comment. Reviews drive three surfaces:

1. **Course rating** — a new `reviews` Django app owns the `Review` table and keeps the existing
   denormalized `Course.rating` / `Course.reviews_count` fields accurate on every write. A public
   endpoint serves the aggregate (average, count) and a paginated review list for the
   course-detail carousel. A student-facing manage page (rebuild of the existing
   `dashboard/(main)/reviews` mockup, which currently uses non-project Material tokens) lets
   students create/edit/delete their own reviews.
2. **Instructor rating** — an aggregate (average rating + total reviews) computed on read across
   the instructor's **published** courses, surfaced through the existing `instructor_profile`
   block on the course-detail page (replacing the hardcoded `CourseInstructor` figures).

The `CourseFeedback` mock distribution/progress bars (hardcoded `["80%","45%","30%","100%","10%"]`)
are **deleted entirely** — no distribution chart is kept — and that area of the course-detail page
becomes the **student-reviews carousel**. **Course-discovery is out of scope and untouched** — it
already reads `Course.rating`, so keeping that field accurate is all this feature owes it; no
filtering, sorting, or course-card changes are made.

## Technical Context

**Language/Version**: Backend Python (Django 6.0 + DRF); Frontend TypeScript (Next.js 16, React 19, strict mode)
**Primary Dependencies**: DRF, `djangorestframework-simplejwt` (CookieJWTAuthentication), PostgreSQL; TanStack Query, Zustand, shadcn/ui (Radix), React Hook Form + Zod, Axios
**Storage**: PostgreSQL — new `Review` table; existing denormalized `Course.rating` (Decimal, 1 dp) and `Course.reviews_count` (Int) kept in sync
**Testing**: Django test / pytest for backend (aggregate recompute, eligibility, permissions); component tests optional per constitution
**Target Platform**: Web (SSR/CSR Next.js frontend + REST backend)
**Project Type**: Web application (`backend/` + `front-end/`)
**Performance Goals**: Course reviews endpoint paginated (page size 6, matching billing's `BillingPageNumberPagination`); course-detail first page + aggregate render with no noticeable delay at ≥500 reviews (SC-005)
**Constraints**: Denormalized `Course.rating` must stay exact after every add/edit/delete (SC-003) since the existing (untouched) discovery filter reads it; instructor aggregate must always equal live data (SC-004); never modify existing migrations (create new ones)
**Scale/Scope**: Modest — one new backend app, one new frontend feature module, edits to the course app serializer/pagination and two course-detail components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|-----------|------------|
| I. Type Safety First | New `reviews.types.ts` interfaces + Zod `reviewSchema` (rating 1–5, comment maxlen) validate the form and API responses. No `any`. ✅ |
| II. Component-First Architecture | New atoms (`StarRating`, `StarInput`), molecule (`ReviewCard`), organisms (`ReviewsCarousel`, `ReviewSubmissionCard`, `MyReviewsList`). Rebuilds the dashboard reviews page with project tokens (`darkmint`/`darktext`/`graytext2`/`lightbg`), dropping the stray Material Design tokens. ✅ |
| III. Security-First Development | All write endpoints use `CookieJWTAuthentication` + `IsAuthenticated`; enrollment + course-completion checked server-side; admin removal gated by `isAdmin`; ORM-only queries; public read is intentional and read-only. ✅ |
| IV. Testing Discipline | Backend unit tests for aggregate recompute, completion-eligibility, self-review block, duplicate block, and permission gates. ✅ (captured as tasks) |
| V. Documentation as Code | Spec/plan/data-model/contracts committed; `_overview.md` "Reviews System (Partial)" note updated after implementation. Response shape follows the (now-corrected) CLAUDE.md raw-payload standard. ✅ |

**Result**: PASS — no violations, Complexity Tracking not required. Adding a dedicated `reviews`
app (rather than folding into `progress` or `course`) mirrors the existing one-app-per-domain
layout (`authentication`/`course`/`enrollment`/`progress`) and is the user's stated preference.

## Project Structure

### Documentation (this feature)

```text
specs/001-course-reviews-ratings/
├── plan.md              # This file
├── spec.md              # Feature spec (with Clarifications)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
│   └── reviews-api.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit.tasks (NOT here)
```

### Source Code (repository root)

```text
backend/
├── apps/
│   ├── reviews/                     # NEW app (mirrors progress/ layout)
│   │   ├── models.py                # Review
│   │   ├── serializers.py           # ReviewSerializer, PublicReviewSerializer, ReviewableCourseSerializer, CourseRatingSummarySerializer
│   │   ├── views.py                 # StudentReviewViewSet, ReviewableCoursesView, CourseReviewsView, AdminReviewDeleteView
│   │   ├── permissions.py           # (reuse isAdmin from course/authentication if present)
│   │   ├── pagination.py            # ReviewPageNumberPagination (page_size=6)
│   │   ├── utils.py                 # has_completed_course(), recalculate_course_rating(), get_instructor_rating()
│   │   ├── urls.py
│   │   ├── admin.py                 # register Review for admin moderation
│   │   ├── tests.py
│   │   └── migrations/0001_initial.py
│   └── course/
│       └── serializers.py           # EDIT (only course-app change): instructor_profile block gains avg_rating + reviews_count (via get_instructor_rating). views.py / pagination.py NOT touched.
├── config/
│   ├── settings.py                  # EDIT: add 'apps.reviews' to INSTALLED_APPS
│   └── urls.py                      # EDIT: path('reviews/', include('apps.reviews.urls'))

front-end/src/
├── featuers/reviews/                # NEW feature module
│   ├── api/reviews.api.ts
│   ├── hooks/                        # useCourseReviews, useReviewableCourses, useMyReviews, useSubmitReview, useUpdateReview, useDeleteReview
│   ├── components/
│   │   ├── student/                  # ReviewSubmissionCard, MyReviewsList, ReviewFormModal (manage page)
│   │   └── course/                   # ReviewsCarousel, ReviewCard, ReviewsHeader (avg + count only)
│   ├── schemas/reviews.schma.ts      # Zod reviewSchema
│   ├── types/reviews.types.ts
│   └── index.ts
├── components/atoms/                 # StarRating (display), StarInput (interactive) — reusable
├── app/dashboard/(main)/reviews/page.tsx   # REWRITE: compose reviews feature components, project tokens
└── featuers/courses/components/CourseDetailPage/courseid/
    ├── CourseFeedback.tsx            # DELETE mock distribution bars; replace section with ReviewsCarousel (avg + count header, "not yet rated" when count 0). May be removed and superseded by ReviewsCarousel.
    ├── CourseInstructor.tsx          # EDIT: real instructor avg_rating + reviews_count (delete hardcoded 4.9/12,450)
    └── CourseDetailPage.tsx          # EDIT: mount <ReviewsCarousel courseId=…/>
```

**Structure Decision**: Web application. Backend follows the existing one-app-per-domain pattern —
`apps/reviews/` cloned from the `apps/progress/` shape (APIView/ViewSet + `urls.py` + `utils.py`).
Frontend follows the feature-module pattern (`featuers/reviews/`), consumed both by the dashboard
manage page and, cross-feature, by the course-detail components (same cross-feature consumption the
billing subfeature already uses). The instructor aggregate is delivered through the **existing**
course serializer's `instructor_profile` block rather than a new endpoint, since the course-detail
page is its only surface.

## Complexity Tracking

No constitution violations — section intentionally empty.
