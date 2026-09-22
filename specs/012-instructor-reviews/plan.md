# Implementation Plan: Instructor Reviews

**Branch**: `012-instructor-reviews` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-instructor-reviews/spec.md`, shaped by the owner's API
sketch and their answers to two questions raised against it (research.md, P1–P4)

## Summary

Replace the two `ComingSoon` review placeholders from spec 003 with a real feed:

- the course workspace's **Reviews** tab, for one course;
- the sidebar's **Reviews** page, across every owned course.

Both show the same thing — four summary tiles, a three-chip star filter, and a paged list of reviews carrying
the reviewer's picture and name, the course, the stars, the comment, and the date it was last updated.
Nothing on either page changes anything.

The build has three parts:

1. **One read endpoint, two scopes** (owner answer P1), returning stats and reviews together (P2).
   `GET /reviews/instructor/reviews/?course=<id>&rating=<5|4>&page=<n>` is a plain **`ListAPIView`** in
   **`apps/reviews/`** (R2), returning a standard DRF page-number object with one key added (P3, R3):
   `{stats, count, next, previous, results}`, rows of
   `{id, rating, comment, updated_at, reviewer{name,avatar}, course{id,title}}`.
2. **No new backend module.** A serializer, a paginator, a view, a route, a throttle scope, one function
   added to the existing `apps/reviews/utils.py`, and a test module — that is the whole backend. 008 and 009
   earned their packages with real aggregation; this feature's entire computation is **one `.aggregate()`
   call** (R5). It goes in `utils.py` beside `get_instructor_rating`, which is its exact sibling — the app's
   existing home for instructor-scoped review aggregation — so that the two functions' deliberate divergence
   (follow-up F3) is visible to the next reader instead of hidden in a view. There is no analogue of 010's
   `roster.py` here because there is nothing to compute per row.
3. **A new `featuers/instructor-reviews/` frontend module**, mirroring `instructor-students/` file for file,
   with the star filter and page number in the address.

**No database migration.** Every field already exists, `Review.course` already carries its index, and no new
index is added speculatively (R13). **No new dependency**, backend or frontend — `StarRating`, `avatar`,
`skeleton` and the tile and chip patterns are all already vendored (R15).

### Five findings that shape the build

- **Stats must be computed before `filter_queryset`, and returned on every page.** FR-007 and owner answer P4
  fix the tiles to the whole scope: selecting "5 stars" must not make the average read 5.0. That means the
  standard `list()` flow has to be overridden so the unfiltered queryset survives to the aggregate, while the
  filtered one feeds the page (R4). The consequence worth stating plainly: **`stats.total_reviews === count`
  only when no filter is active** — under a filter the tiles and the paging line describe different sets, on
  purpose, and that difference is exactly what lets the client tell "no reviews match this filter" from "no
  reviews yet" (FR-026 vs FR-042).
- **`Review.Meta.ordering = ['-created_at']` is a default that wins unless overridden.** The model sorts
  itself by creation date; FR-020 wants last-updated. A queryset that forgets `.order_by()` silently shows the
  right rows in the wrong order, with dates that no longer explain the positions. And `-updated_at` alone is
  not enough — `auto_now` produces ties, and ties make pages repeat *and* skip rows with no writes happening
  (R8, the same trap 010 hit with `enrolled_at`).
- **`created_at` and `updated_at` are both in play, in one query.** "This month" counts **creations**; the
  list orders and displays **updates** (R7). Swapping them raises nothing and breaks both at once, so a review
  created last month and edited today gets its own test and its own quickstart step.
- **The existing `ReviewPageNumberPagination` cannot be reused.** It exposes `page_size_query_param`, letting
  the client widen the page against FR-028; it has no out-of-range→page-1 override (FR-031); and it has no
  `stats`. Amending it would change the public course-reviews endpoint, which is out of scope — so a second
  paginator goes beside it (R10).
- **`?rating=` must be parsed before the ORM sees it.** `?rating=abc` reaching `filter(rating='abc')` raises
  `ValueError` → 500. Only `5` and `4` are honoured; everything else — including `3` — falls back to "all"
  with a `200`, because a value the three chips cannot represent would leave the page in a state it cannot
  clear (R11).

### Two deviations from the owner's sketch

Both were put to the owner and chosen by them (research P3, P4); both are one-line reversals.

- **`results`, not `reviews`.** The sketch's bare array carried no `count`/`next`/`previous`, which FR-029 and
  FR-031 need. Keeping DRF's four keys verbatim satisfies CLAUDE.md's response contract and lets the frontend
  reuse 010's page schema with one field added. Reverting is one line in `get_paginated_response`.
- **`five_star_count`, not `five_star_rate`.** The sketch's `{avg_rating, total_reviews, ...}` is kept exactly;
  the unnamed remainder is returned as counts, following 009's shipped `AnalyticsTiles`, which takes
  `{completed, total}` and divides client-side precisely so "no reviews at all" stays distinguishable from
  "0% of 213" (R6, FR-012).

### Phasing

- **Phase 1 (backend)**: paginator, serializer, view, route, throttle scope, `tests_instructor.py`.
  Independently verifiable over HTTP before any UI exists — quickstart §3 is 16 checks that need no component.
- **Phase 2 (frontend, per-course)**: the feature module and the workspace Reviews tab — User Stories 1 and 2,
  the P1 slice.
- **Phase 3 (frontend, aggregate)**: the sidebar Reviews page — User Story 3, P2. Reuses the whole module and
  omits one prop; droppable without touching Phase 2.

User Story 4 (nobody reads another instructor's reviews) is not a phase — it is the ownership filter built
into Phase 1 and the tests that pin it.

## Technical Context

**Language/Version**: Python 3 / Django 6.0 + DRF backend; TypeScript 5 (Next.js 16 / React 19) frontend

**Primary Dependencies**:
- Backend: DRF `ListAPIView`, `PageNumberPagination`, `ScopedRateThrottle`, `select_related`,
  `.aggregate()` with `Avg` / `Count(filter=Q(...))`, the existing `isInstructor` permission,
  `CookieJWTAuthentication`, and `person_name` imported from `apps/course/dashboard/service.py`.
- Frontend: TanStack Query `useQuery`, Zod, `next/navigation` (`useSearchParams`, `useRouter`, `usePathname`),
  and the existing `StarRating`, `avatar` and `skeleton` atoms. **Nothing new is installed.**

**Storage**: PostgreSQL, read-only. No migration.

**Testing**: Django `TestCase` (`apps/reviews/tests_instructor.py`), including `assertNumQueries` for the
query budget and an exact-key-set assertion for the privacy contract; `tsc --noEmit` and ESLint on the
frontend; manual verification per [quickstart.md](./quickstart.md).

**Target Platform**: Web — the existing instructor shell, down to a 375px viewport.

**Project Type**: Web application (Django REST backend + Next.js frontend).

**Performance Goals**: **3 queries** for the aggregate scope, **4** for the per-course scope, flat in the
number of reviews (R5). A page loads within the same budget as the rest of the instructor shell.

**Constraints**: Read-only — no write path anywhere in the feature. Ownership enforced server-side on every
request, with an indistinguishable `404` across all three not-your-course causes. A row exposes only the six
contracted fields. UTC for the month window and every date shown.

**Scale/Scope**: SC-010's ceilings — 5,000 reviews on one course, 20,000 across 50 courses for one
instructor. Two pages, one endpoint, one frontend module.

## Constitution Check

*GATE: checked before Phase 0 research, re-checked after Phase 1 design.*

| Principle | Status | How |
|-----------|--------|-----|
| **I. Type Safety First** | ✅ | Every response parsed by a Zod schema, not cast (contracts §5); explicit TS types for rows, stats, page and filter; no implicit `any`. `avg_rating` is `.nullable()` rather than defaulted, so the "no reviews" case cannot be papered over as `0`. |
| **II. Component-First Architecture** | ✅ | New components are composed from existing atoms (`StarRating`, `avatar`, `skeleton`); the feature module follows the established `api`/`hooks`/`components`/`schemas`/`types`/`index.ts` layout with two orchestrators as its only entry points. No new atom is needed. |
| **III. Security-First Development** | ✅ | `CookieJWTAuthentication` + `IsAuthenticated` + `isInstructor`; the queryset is built from ownership **outward** so scoping is a filter, not a check someone can forget; a client-supplied course id can only narrow, never widen, and only after resolution against the owned set; indistinguishable `404`s (FR-038); ORM only, no raw SQL; a throttle scope; an exact-key-set privacy test. |
| **IV. Testing Discipline** | ✅ | `tests_instructor.py` covers the stats arithmetic, the month boundary, ordering and its tiebreak, filter parsing, page fallback, ownership and refusals, the privacy key set, and the query budget. This is a read path, not an auth or payment flow, so no new integration test is required. |
| **V. Documentation as Code** | ✅ | spec / research / data-model / contract / quickstart in `specs/012-instructor-reviews/`; the non-obvious decisions (stats-before-filter, the two timestamps, the ordering default, the rating parse) carry inline "why" comments at the code that implements them, matching the density of `roster.py` and `dashboard/service.py`. |

**Result: PASS**, before and after design. No violation, so **Complexity Tracking is omitted**.

Two notes recorded rather than waved past:

- **Quality gate "API contracts remain backward compatible"** — nothing existing changes shape. The new
  paginator sits *beside* `ReviewPageNumberPagination` rather than amending it, specifically so the public
  course-reviews endpoint keeps its behaviour (R10).
- **Principle III and discovery §13.5** — the ownership resolution is duplicated from 010 rather than
  extracted into the recommended shared mixin. Deliberate and recorded as follow-up **F1** (R12): extracting
  it means editing 010's shipped view inside a feature that is meant to be additive, and the mixin's real
  shape is not yet clear from two samples. This is a debt entry, not a silent skip.

## Project Structure

### Documentation (this feature)

```text
specs/012-instructor-reviews/
├── plan.md                              # This file
├── spec.md                              # /speckit.specify output
├── research.md                          # Phase 0 — P1–P4, R1–R15, follow-ups F1–F3
├── data-model.md                        # Phase 1 — entities read, values computed, query budget
├── quickstart.md                        # Phase 1 — 9 verification sections
├── contracts/
│   └── instructor-reviews.md            # Phase 1 — the endpoint
├── checklists/
│   └── requirements.md                  # spec quality gate (passed)
└── tasks.md                             # Phase 2 output — NOT created by /speckit.plan
```

### Source Code (repository root)

```text
backend/apps/reviews/
├── views.py                   # + InstructorReviewsView(ListAPIView)
├── serializers.py             # + InstructorReviewSerializer, ReviewerRefSerializer, ReviewCourseRefSerializer
├── pagination.py              # + InstructorReviewsPagination  (beside ReviewPageNumberPagination, not replacing it)
├── utils.py                   # + build_instructor_review_stats()  (beside get_instructor_rating)
├── urls.py                    # + path('instructor/reviews/', ...)
├── models.py                  # UNCHANGED — no migration
└── tests_instructor.py        # NEW

backend/config/
└── settings.py                # + throttle scope 'instructor_reviews': '60/min'

front-end/src/featuers/instructor-reviews/          # NEW module
├── api/instructorReviews.api.ts                    # instructorReviewsAPI.getReviews
├── hooks/
│   ├── useInstructorReviews.tsx                    # useQuery wrapper
│   └── useReviewParams.tsx                         # ?rating= and ?page= in the address
├── components/
│   ├── CourseReviews.tsx                           # orchestrator — per-course scope
│   ├── InstructorReviews.tsx                       # orchestrator — all-courses scope
│   ├── ReviewsTiles.tsx                            # the four stats
│   ├── RatingFilter.tsx                            # the three chips
│   ├── ReviewCard.tsx                              # one row
│   └── ReviewsStates.tsx                           # skeleton · error · empty · no-match · no-courses
├── schemas/instructorReviews.schma.ts              # Zod
├── types/instructorReviews.types.ts                # types + formatters (date, percent, empty labels)
└── index.ts                                        # public surface

front-end/src/app/instructor/
├── reviews/page.tsx                                # REPLACES ComingSoon  (Suspense + InstructorReviews)
└── courses/[courseId]/reviews/page.tsx             # REPLACES ComingSoon  (Suspense + CourseReviews)
```

**Structure Decision**: the project's established web split — `backend/apps/<app>/` and
`front-end/src/featuers/<feature>/` — with the endpoint placed in **`apps/reviews/`** rather than
`apps/course/` (R2), because the reviews app already owns `Review` and the three sibling scopes at exactly
this URL shape (`student/reviews`, `course/<id>/`, `admin/reviews/<pk>/`). The frontend module mirrors
`featuers/instructor-students/` file for file; it is distinct from the existing `featuers/reviews/`, which is
the *student's* review-writing feature and shares only the word.

Both `page.tsx` files must render their orchestrator under `<Suspense>` — `useReviewParams` reads
`useSearchParams`, which Next 16 requires to sit under a boundary.
