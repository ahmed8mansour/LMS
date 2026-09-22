# Research: Instructor Reviews

**Feature**: 012-instructor-reviews | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

The owner supplied an API sketch — *"one backend endpoint the same as the students feature"*, returning
`{stats: {...}, reviews: [...]}` — and answered two questions raised against it. **P1–P4** below are fixed
inputs; **R1–R14** are the decisions derived from them and from reading the shipped 008/009/010 code.

---

## Owner decisions (fixed inputs)

| # | Question | Answer |
|---|----------|--------|
| **P1** | One endpoint or two? | **One**, shaped exactly like spec 010's roster: an optional `course` parameter selects the scope. |
| **P2** | Are stats and reviews returned together? | **Yes**, one request returns both. |
| **P3** | The sketch drops paging metadata. What is the response shape? | **`{stats, count, next, previous, results}`** — a standard DRF page-number object with `stats` added. The array is `results`, not `reviews`. |
| **P4** | Do the four tiles move when the star filter changes? | **No.** Stats always describe the whole scope, and are returned on **every** page, not only the first. |

---

## R1 — One endpoint, two scopes

**Decision**: `GET /reviews/instructor/reviews/?course=<id>&rating=<5|4>&page=<n>`.
`course` present → one course's reviews (the workspace Reviews tab). `course` absent → every owned course
(the sidebar Reviews page).

**Rationale** (P1): identical to R1 of spec 010, and for the same reason — the two scopes differ by one
`WHERE` clause. One view, one serializer, one paginator, one test module. This feature has an extra reason:
the `stats` aggregate has to be computed for both scopes, and splitting the endpoint would duplicate the
conditional-aggregation query as well.

**Alternatives considered**:
- *Two endpoints, or a stats endpoint plus a list endpoint.* Two requests to paint one screen, two loading
  states to coordinate, and two chances for the tiles and the list to disagree about what the scope is.
  Rejected on P2.
- *An `@action` on `InstructorCourseViewSet`.* Same objection as 010 R1: `self.filter_queryset` would run
  the **course** viewset's filter backends, and its paginator is not this feature's.

---

## R2 — The endpoint lives in `apps/reviews/`, not `apps/course/`

**Decision**: `apps/reviews/views.py`, routed from `apps/reviews/urls.py`, giving the `/reviews/` prefix.

**Rationale**: discovery §13.2 names `/reviews/instructor/reviews/` explicitly, and the reviews app already
owns the three sibling scopes at exactly this shape — `student/reviews`, `course/<id>/`,
`admin/reviews/<pk>/`. Adding `instructor/reviews/` completes an existing set rather than starting a second
home for `Review`. The app already imports `Course` and `isAdmin` from the course app, so reaching for
`isInstructor` breaks no layering rule that is not already broken.

**Alternatives considered**: `/courses/instructor/reviews/`, beside 010's roster. It would put every
instructor read under one prefix, but it splits `Review` access across two apps and leaves
`apps/reviews/urls.py` the only reviews scope that is not in the reviews app. Rejected.

---

## R3 — The response is a DRF page with `stats` added

**Decision**: a custom paginator overrides `get_paginated_response` to return

```
{ "stats": {...}, "count": N, "next": url|null, "previous": url|null, "results": [...] }
```

**Rationale** (P3): the owner's sketch carried no `count`/`next`/`previous`, but FR-029 requires the view to
state "21–40 of 213" and FR-031 requires an out-of-range page to resolve rather than error — neither is
possible from a bare array. Keeping DRF's four keys verbatim satisfies CLAUDE.md's response contract
("a standard DRF page-number pagination object"), and means the frontend's existing paging handling and the
010 Zod page schema transfer with one field added.

`stats` is attached by the **paginator**, not spliced into the view's `Response`, because that is the single
place DRF already builds this envelope; a view that assembles the dict by hand drifts the moment DRF changes
a key.

**Alternatives considered**:
- *`{stats, count, next, previous, reviews}`* — the owner's key name with full metadata. Offered and not
  chosen (P3). Reverting is one line in `get_paginated_response`.
- *`{stats, reviews: {count, next, previous, results}}`* — closest to the literal sketch, but nests the page
  so the shared page schema cannot be reused. Offered and not chosen (P3).

---

## R4 — Stats ignore the star filter, and ride on every page

**Decision**: `stats` is computed from the **ownership-scoped, unfiltered** queryset — `get_queryset()`
before `filter_queryset()` — and is present in the response of every page.

**Rationale** (P4, FR-007, SC-004): "68% 5-star" has to mean the same thing before and after the instructor
clicks a filter chip, otherwise selecting "5 stars" makes the average read 5.0 and the 5-star rate 100%,
which is worse than useless. Returning stats on every page rather than only the first keeps the response
shape uniform, so the client has no `stats | null` branch and no cross-page cache to keep warm — worth far
more than the ~80 bytes it costs.

**Consequence for the view**: the standard `ListAPIView.list` flow has to be overridden, because the
unfiltered queryset must survive to the point where stats are computed. `get_queryset()` returns the
ownership-scoped set; the rating filter is applied in `filter_queryset()`; stats are aggregated from the
former, the page from the latter.

---

## R5 — All four stats come from one `.aggregate()` call

**Decision**: one query with conditional aggregation:

```
Avg('rating'), Count('id'),
Count('id', filter=Q(rating=5)),
Count('id', filter=Q(created_at__gte=<month start, UTC>))
```

**Rationale**: four separate queries for four tiles is the obvious wrong turn here. Postgres computes all
four in one pass with `FILTER (WHERE ...)`, which Django's `filter=` argument compiles to directly. The whole
request is then:

| Scope | Queries |
|-------|---------|
| Aggregate (`?course` absent) | **3** — stats, DRF's `COUNT(*)`, the page |
| Per course (`?course=42`) | **4** — the same three, plus resolving `?course=` against the owned set |

Flat in the number of reviews, exactly as 010's roster is flat in the number of students. A performance test
pins both numbers.

---

## R6 — Stats are counts, not percentages

**Decision**: the endpoint returns `{avg_rating, total_reviews, five_star_count, this_month_count}`. The
client derives the 5-star rate as `five_star_count / total_reviews`.

**Rationale**: this is spec 009's rule, already shipped — `AnalyticsTiles` receives `{completed, total}` and
calls `percent(...)` itself, precisely so that "no reviews at all" and "0% of 213" stay distinguishable.
FR-012 makes that distinction mandatory here too: a scope with no reviews must not read "0.0" and "0%".
With `total_reviews === 0` the client renders the empty state and never divides.

`avg_rating` and `total_reviews` keep the owner's sketch names verbatim. `avg_rating` is `null`, never `0.0`,
when there are no reviews — matching `get_instructor_rating` and 008's `Rating` DTO.

**Alternatives considered**: returning `five_star_rate: 68.0`. It moves a one-line division to the server and
buys nothing, while forcing a second "is this null or zero?" decision into the payload. Rejected.

---

## R7 — "This month" is a UTC calendar month, computed per request

**Decision**: `datetime(now_utc.year, now_utc.month, 1, tzinfo=utc)`, compared against `created_at`.

**Rationale**: the spec's Clarifications fix this (calendar month to date, UTC, keyed on **creation** not
update), consistent with spec 009's UTC-everywhere rule. Computing it per request rather than caching it
means the rollover is correct with no scheduled work — the edge case "the month rolls over while the page is
open" resolves on the next load, which is what the spec says should happen.

**The trap**: `created_at`, not `updated_at`. The same row's `updated_at` orders the list (R8), so both
timestamps are in play in one query and picking the wrong one for either is silent — the numbers are simply
wrong, nothing raises. A test covers exactly this: a review created last month and edited today must be
absent from `this_month_count` and first in `results`.

---

## R8 — Ordering is `('-updated_at', '-id')`, and it must be explicit

**Decision**: `.order_by('-updated_at', '-id')` on every query.

**Rationale**: two separate hazards.

1. **`Review.Meta.ordering = ['-created_at']` is a default that will otherwise win.** The model already
   orders itself, so a queryset that does not say otherwise is sorted by creation date — which contradicts
   FR-020 and makes the shown date disagree with the position, exactly the confusion the spec's Clarifications
   set out to remove.
2. **The tiebreak is not cosmetic.** This is 010 R5 repeated: `updated_at` is `auto_now`, and a data
   migration, a bulk edit, or two students submitting in the same instant produce identical timestamps. With
   `-updated_at` alone the order among tied rows is unspecified, so pages can repeat *and* skip reviews with
   no writes happening at all.

---

## R9 — Out-of-range pages resolve to page 1, via `get_page_number`

**Decision**: copy the `get_page_number` override from `StudentRosterPagination` (spec 010).

**Rationale**: FR-031 wants a missing, unparseable, or beyond-the-end page to fall back to page 1 with a
`200`; DRF's default raises `NotFound` → `404`. 010 already established that this must be fixed in
`get_page_number` rather than by catching `NotFound` in `paginate_queryset`, because `request.query_params`
is an immutable `QueryDict` and the page cannot be rewritten after the exception is raised. The same override
applies verbatim.

---

## R10 — A new paginator, not the existing `ReviewPageNumberPagination`

**Decision**: add `InstructorReviewsPagination(PageNumberPagination)` to `apps/reviews/pagination.py`,
`page_size = 10`, no `page_size_query_param`.

**Rationale**: the existing `ReviewPageNumberPagination` serves the public course-reviews list and cannot be
reused or amended:
- it exposes `page_size_query_param = 'page_size'`, letting the client widen the page — FR-028 fixes the page
  size on the server;
- it has no `get_page_number` override (R9);
- it has no `stats` in `get_paginated_response` (R3).

Changing it in place would alter the public endpoint's behaviour, which is out of scope. `page_size = 10`
(not 010's 20) because a review is a tall card with a comment, not a table row.

---

## R11 — `?rating=` accepts only `5` and `4`; everything else means "all"

**Decision**: `5` → 5-star reviews, `4` → 4-star reviews, **anything else** — absent, `all`, `abc`, `0`, and
notably `3` — → no filter, with a `200`.

**Rationale**: FR-021 fixes the vocabulary at three options and FR-027 requires an unrecognised value to fall
back to "All ratings" without an error. `3` is unrecognised *in this feature's vocabulary*: honouring it would
put the page in a state its own controls cannot represent or clear, since no chip would read as selected.
Never `400` — the address is the least trustworthy input on the page (a stale bookmark, a hand-edited URL),
and FR-027 says it must not error.

**The trap**: the parse must happen before the ORM sees the value. `?rating=abc` reaching a
`filter(rating='abc')` raises `ValueError` → `500`, which is both a crash and a distinguishing signal.

---

## R12 — Ownership resolution is duplicated from 010, deliberately

**Decision**: a local `_resolve_owned_course` on the new view, functionally identical to
`InstructorStudentsView._resolve_owned_course` — `int()` parse, `< 1` guard, `Course.objects.filter(
instructor=profile, id=...)`, every failure returning `None` so `list()` answers all of them with one
identical `404`.

**Rationale**: discovery §13.5 recommends extracting a shared ownership mixin, and it is right — this is the
second copy. But doing it here means editing 010's shipped, tested view as part of a feature that is supposed
to be read-only and additive, and the mixin's real shape is not yet clear from two samples (008 and 009
resolve ownership differently again). Twelve duplicated lines with a comment pointing at both copies is the
cheaper mistake. **Recorded as a follow-up**, not silently skipped.

The indistinguishable-`404` property is the part that must not be lost in the copy: another instructor's
course, a course that does not exist, and `?course=abc` all return the same body, or the endpoint becomes a
probe for which course ids exist (FR-038).

---

## R13 — No migration, no new index

**Decision**: no database change.

**Rationale**: every field already exists — `Review.rating/comment/created_at/updated_at/course/user`,
`Course.instructor/title`, `CustomUser.first_name/last_name/username/profile_picture`. `Review.course`
already carries `db_index=True`, which serves both scopes' `WHERE`.

There is **no index on `updated_at`**, so the ordering is a sort. At SC-010's ceiling (20,000 reviews for one
instructor) Postgres sorts that in single-digit milliseconds, and 010 made the same call at a higher row
count. An index on `(course_id, updated_at DESC)` is an additive migration if measurement ever calls for one —
per the project's hard rule, a new migration, never an edit to an existing one.

---

## R14 — Row shape follows 008's `RecentReview`, with one change

**Decision**: `{id, rating, comment, updated_at, reviewer: {name, avatar}, course: {id, title}}`.

**Rationale**: spec 008's dashboard already ships a review row at almost exactly this shape, including
`reviewer` as a `PersonRef{name, avatar}` and `course` as a `CourseRef{id, title}`, and — importantly — it
already scopes to *"any of the instructor's courses, published or not"*, which is the rule this spec's
Clarifications independently arrived at. Three instructor reads agreeing on `{name, avatar}` and
`{id, title}` is worth more than any per-feature naming preference, so `reviewer` is kept over 010's flat
`name`/`avatar`.

**The one change**: 008 returns `created_at` as a full ISO datetime; 012 returns **`updated_at` as a date**
(`"2026-07-14"`, UTC, no time), per FR-019. The conversion is spelled out the way 010's `get_enrolled_at`
spells it — `.astimezone(utc).date().isoformat()` — because DRF's `DateField` refuses a datetime outright,
precisely to stop a timezone being picked silently.

`comment` is `''` when the student left none (the model is `blank=True`, never null), and the client renders
that as an explicit "no comment" line rather than a gap (FR-018).

---

## R15 — Frontend: one module, two orchestrators, params in the address

**Decision**: `featuers/instructor-reviews/`, mirroring `featuers/instructor-students/` file for file:
`api/` · `hooks/` · `components/` · `schemas/*.schma.ts` · `types/` · `index.ts`, exporting `CourseReviews`
and `InstructorReviews` as the only two entry points a page needs.

**Rationale**: the convention is established and the shapes line up — `useReviewParams` is `useRosterParams`
with `rating` in place of `search` (same `router.replace`, same "drop a parameter at its default", same
"reset the page in the *same* write, not a follow-up effect"). Both pages must sit under `<Suspense>`, as
010's do, because `useSearchParams` requires it in Next 16.

**Reused as-is**: the `StarRating` atom (already renders fractional fills and carries an
`aria-label`, satisfying FR-017), the `avatar` and `skeleton` atoms, `AnalyticsTiles`' tile visual language
for the four stats, and `PeriodSelector`'s chip pattern for the three filter chips — a `role="group"` of
`aria-pressed` buttons, which is what FR-021's "exactly one selected" needs to be legible to assistive
technology.

**`components/molecules/RosterPagination.tsx` is reused, not rebuilt.** 010 put it in `molecules/` rather
than inside its feature specifically so this spec could take it, gave its props no roster vocabulary, and
added a `label` prop whose doc comment already names `"reviews"` as the expected second caller. It takes
`count`/`hasNext`/`hasPrevious` straight from the server rather than computing pages from `results.length`,
which is what FR-029 needs. **No new pagination component.**

**Not reused**: `featuers/reviews/` is the *student's* review feature (writing and editing their own). It
shares the word and nothing else.

---

## Open follow-ups (out of scope for this feature)

| # | Item | Why deferred |
|---|------|--------------|
| F1 | Extract a shared instructor-ownership mixin (discovery §13.5) | Would edit 010's shipped view; the right shape needs a third sample. See R12. |
| F2 | Index `(course_id, updated_at DESC)` on `Review` | Speculative until measured. See R13. |
| F3 | The dashboard's avg rating (published courses only) and this page's (all owned courses) can differ | Accepted in the spec's Assumptions; a deliberate divergence, not a defect. |
