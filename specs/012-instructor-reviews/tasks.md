# Tasks: Instructor Reviews

**Input**: Design documents from `/specs/012-instructor-reviews/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/instructor-reviews.md, quickstart.md

**Tests**: Backend tests are **included and not optional**. Constitution IV requires unit tests for services,
and four of this feature's rules fail *silently* without them — `created_at` vs `updated_at` (both numbers
come out wrong, nothing raises), `Review.Meta.ordering` winning over a forgotten `.order_by()` (right rows,
wrong order), the `-updated_at` tiebreak (pages repeat **and** skip with zero writes), and the three
identical 404s (a `500` on `?course=abc` is itself an information leak). Frontend component tests are
optional (Constitution IV "SHOULD") and are not included; the gates are `tsc --noEmit` and lint.

**Organization**: grouped by user story, in priority order — US1 → US2 → US4 → US3.

- **US4 (access) is P1 and comes before US3 (P2)**, as the spec's priorities require.
- **The endpoint itself is Phase 2 Foundational.** One endpoint serves all four stories (owner answer P1),
  and the star filter and paging are *configuration on that view* — the view cannot exist without them. So
  Phase 2 builds the endpoint, and each story phase adds the tests that **prove its own slice** plus its UI.
  Same shape 009 and 010 used.
- Each story phase is still independently verifiable: stop at any checkpoint and the story below it works.

**No migration, no new package — backend or frontend.** `StarRating`, `avatar`, `skeleton` and
`RosterPagination` are already vendored. If you find yourself writing a migration or running
`npm install <library>`, stop and re-read plan.md Technical Context.

---

## Tags

Every task carries exactly one ownership tag:

| Tag | Meaning | Rule |
|-----|---------|------|
| **[ME]** | Do this yourself (or review it line by line) | Invariants, security, or the **first instance** of a pattern in this feature |
| **[AI]** | Safe to delegate to an LLM | Repetition of a pattern already established by a `[ME]` task, and wiring |

An `[AI]` task always names the `[ME]` task (or the existing file) whose pattern it repeats. If an `[AI]`
task turns out to need a new decision, stop and promote it to `[ME]`.

**Count**: 20 `[ME]`, 18 `[AI]` across 38 tasks. The `[ME]` weight sits in Phase 2 and in the backend test
classes — the stats aggregate, the queryset, the rating parse and the overridden `list()` are where every
invariant in this feature lives, and the tests are what hold them there. Phase 6 (US3) is almost entirely
`[AI]`, because by then every pattern it needs exists.

## How to use this file (humans and LLMs)

Each task is meant to be picked up **on its own**, without the conversation that produced it.

- **First line**: what to do, and in which file.
- **What**: what this task actually accomplishes, in one or two sentences.
- **Read first**: the exact documents or sections that hold the details.
- **Pattern**: for `[AI]` tasks — the existing file or earlier task to copy.
- **Done when**: the acceptance check. The task is incomplete until every bullet holds.
- **`[P]`**: touches a different file from the other open tasks in its phase and has no unfinished
  dependency, so it can run in parallel with other `[P]` tasks.
- Mark a task `[X]` once it's finished.
- **Work tasks that share a file in ID order**, one at a time. Shared files are `views.py`,
  `serializers.py`, `utils.py`, `tests_instructor.py`, `CourseReviews.tsx` and `index.ts`.

Terms used throughout:

- **row**: one object in `results` — one review (contracts §2).
- **scope**: `?course=<id>` (one course) or no `course` parameter (every owned course).
- **profile**: the signed-in user's `InstructorProfile`.
- **stats**: the four summary figures, always computed over the **unfiltered** scope.

## Path Conventions

- **Backend**:
  - New: `backend/apps/reviews/tests_instructor.py`.
  - Edited: `backend/apps/reviews/{views,urls,serializers,pagination,utils}.py`,
    `backend/config/settings.py`.
  - **`models.py` is not edited. There is no migration.**
- **Frontend**:
  - New module: `front-end/src/featuers/instructor-reviews/`. Keep the house spelling `featuers`; schema
    files end in `.schma.ts`.
  - Pages (both currently `ComingSoon`): `front-end/src/app/instructor/reviews/page.tsx` and
    `front-end/src/app/instructor/courses/[courseId]/reviews/page.tsx`.
  - **No new shared component.** `components/molecules/RosterPagination.tsx` is reused as-is.
- **Run backend tests with a module label**: `python manage.py test apps.reviews.tests_instructor` (from
  `backend/`, venv active). A bare `apps.reviews` **does not resolve** — there is no `__init__.py` under
  `backend/apps/`, and the bare label dies in `unittest`'s discovery with a `TypeError`, not a useful message.
  Use `env/Scripts/python.exe manage.py ...` on Windows; a bare `python` is the Microsoft Store shim.
- **`apps/reviews/tests.py` is already red on `master`** — 11 errors and 1 failure, none of them this
  feature's. The 11 pass `video_url=` to `Lecture.objects.create()`, a field spec 006 replaced with
  `video_public_id`/`video_status`; the 1 asserts `page_size == 2` against a paginator that says 10. Do not
  try to fix them here and do not read them as a regression — see T036.
- **Zod is v4**; **Next.js 16** (`useSearchParams` must sit under `<Suspense>`).
- **`created_at` is `auto_now_add` and `updated_at` is `auto_now`**, so both ignore values passed to
  `create()` *and* `save()`. Set them with
  `Review.objects.filter(pk=...).update(created_at=..., updated_at=...)` — `.update()` is the only path that
  bypasses `auto_now`. Getting this wrong makes every date test pass vacuously.

---

## Phase 1: Setup

**Purpose**: scaffolding that later tasks import from.

- [X] T001 [P] [AI] Add the throttle rate `'instructor_reviews': '60/min'` to `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']` in `backend/config/settings.py`
  - **What**: gives the new endpoint a rate ceiling. Without a `throttle_scope`, `ScopedRateThrottle` (the
    project default) silently no-ops and the endpoint is unthrottled.
  - **Pattern**: the existing `'instructor_students': '120/min'` entry (spec 010), around `settings.py:167`.
  - **Read first**: contracts §1.
  - Place it after `'instructor_students'`, with a one-line comment on why this is **60, not 120**: this read
    is driven by filter chips and page arrows, not a debounced search box, so its traffic is not bursty. The
    limit is a ceiling against a runaway client loop, not a security boundary — ownership is the boundary.
  - **Done when**: `python manage.py check` passes.

- [X] T002 [AI] Create `backend/apps/reviews/tests_instructor.py` with shared fixtures
  - **What**: the test module every later backend task adds classes to. It reuses the existing fixture
    helpers instead of redefining them, so these tests and the 008/010 tests build identical data.
  - **Pattern**: the top of `backend/apps/course/tests_roster.py` (spec 010) — imports, the
    `APITestCase` subclass, the `url()`/`get()` helpers, the `_all_keys` generator.
  - **Read first**: quickstart.md Prerequisites (the fixture shape) and §1.
  - Module docstring:
    `"""012 — Instructor reviews. Stats unit tests first, then API tests grouped by user story."""`
  - Import and reuse — **do not redefine**: `make_instructor`, `make_course` from `apps.course.tests`;
    `make_student` from `apps.course.tests_dashboard` (it already accepts `first_name`, `last_name`,
    `profile_picture`); `_all_keys` from `apps.course.tests_analytics`.
  - Add `InstructorReviewsTestCase(APITestCase)` with helpers:
    - `url(course=None, rating=None, page=None)` — builds `reverse('instructor_reviews')` with only the
      given query parameters.
    - `get(user, url)` — `force_authenticate` then `GET`.
    - `make_review(student, course, rating, comment='', created=None, updated=None)` — creates the row, then
      applies `created`/`updated` through `Review.objects.filter(pk=...).update(...)`. **The `.update()` is
      the point**: `auto_now_add` and `auto_now` ignore anything passed to `create()` or `save()`, so a
      helper that does not use `.update()` makes every date assertion in this module vacuous.
  - Add a placeholder `class SetupTests(SimpleTestCase)` with one assertion that the imported helpers are
    callable, so the module runs green before the endpoint exists.
  - **Done when**: `python manage.py test apps.reviews.tests_instructor` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the endpoint, end to end, plus the frontend contract and address plumbing every story renders
from.

**⚠️ CRITICAL**: no user story work can begin until this phase is complete.

### Backend

- [X] T003 [P] [ME] Add `build_instructor_review_stats(queryset)` to `backend/apps/reviews/utils.py`
  - **What**: the entire computation of this feature — the four summary figures, in **one** database query.
  - **Read first**: research.md R5, R6, R7; data-model.md §2 (`ReviewStats`); contracts §2.
  - Place it directly **below `get_instructor_rating`**, which is its sibling. Both aggregate an
    instructor's reviews, and they deliberately disagree: `get_instructor_rating` counts **published**
    courses only (it backs the public profile and 008's dashboard tile), this one counts **every owned
    course**. Put that divergence in a comment on this function, naming research follow-up F3, so the next
    reader finds it here rather than discovering it as a bug report.
  - Take a **queryset**, not an instructor — the caller has already applied ownership and any `?course=`
    narrowing, and this function must never re-derive scope. One `.aggregate()`:
    - `avg_rating=Avg('rating')`, `total_reviews=Count('id')`,
    - `five_star_count=Count('id', filter=Q(rating=5))`,
    - `this_month_count=Count('id', filter=Q(created_at__gte=<month start>))`.
    Comment that `filter=` compiles to Postgres `COUNT(*) FILTER (WHERE ...)`, so all four arrive in one
    pass — four separate queries for four tiles is the obvious wrong turn here.
  - Month start: `timezone.now().astimezone(dt_timezone.utc)`, then `.replace(day=1, hour=0, minute=0,
    second=0, microsecond=0)`. **UTC, not `settings.TIME_ZONE`** — FR-011 names UTC so that two instructors
    in different zones reading the same feed see the same number.
  - **`created_at`, not `updated_at`.** The sort key of this feature is `updated_at` (T006), so both
    timestamps are in play and picking the wrong one here is silent: `this_month_count` is simply wrong and
    nothing raises. Comment the distinction at the line.
  - Round `avg_rating` to one decimal, and return **`None`** — never `0.0` — when there are no reviews, so
    the client can tell "no reviews yet" from "rated zero" (FR-012). `Avg` already returns `None` for an
    empty set; do not coerce it.
  - **Done when**: `python manage.py check` passes. (Behaviour is proven by T013–T015.)

- [X] T004 [P] [ME] Add `InstructorReviewsPagination` to `backend/apps/reviews/pagination.py`
  - **What**: fixes the page size at 10, attaches `stats` to the response envelope, and makes an
    out-of-range or malformed `?page=` fall back to page 1 with a `200`.
  - **Read first**: research.md R3, R9, R10; contracts §1, §2.
  - Subclass `PageNumberPagination` with `page_size = 10`. **Do not** set `page_size_query_param` — FR-028
    fixes the size on the server. Comment that this is exactly why the existing
    `ReviewPageNumberPagination` in this same file cannot be reused *and must not be amended*: it backs the
    public course-reviews endpoint, and changing it there is out of scope.
  - Override `get_paginated_response(self, data)` to return
    `{'stats': self.stats, 'count': ..., 'next': ..., 'previous': ..., 'results': data}`, reading
    `self.stats` which the view sets before paginating. Build the envelope **here**, not by hand in the
    view: this is the single place DRF already assembles these four keys, and a view that reconstructs them
    drifts the moment DRF changes one. Note in a comment that the array is `results` (not `reviews`) to keep
    this a standard DRF page object per CLAUDE.md, and that renaming it is a one-line change here (owner
    answer P3).
  - Override `get_page_number(self, request, paginator)` rather than catching `NotFound` afterwards:
    `request.query_params` is an immutable `QueryDict`, so the page cannot be rewritten once the exception
    has been raised. Return `1` for a non-numeric value, for `< 1`, and for `> paginator.num_pages`;
    otherwise the number. Keep DRF's `last_page_strings` handling (`?page=last`) — and return the resolved
    **number**, not the literal `'last'`, or `Paginator` raises `PageNotAnInteger` on the very request the
    branch exists to serve.
  - **Pattern for the `get_page_number` body**: `StudentRosterPagination` in
    `backend/apps/course/pagination.py` — copy it, including the `num_pages == 1` note about
    `allow_empty_first_page`.
  - **Done when**: `python manage.py check` passes. (Behaviour is proven by T024.)

- [X] T005 [P] [ME] Add the three serializers to `backend/apps/reviews/serializers.py`
  - **What**: one row of the feed, at exactly the six contracted fields and no more.
  - **Read first**: research.md R14; data-model.md §2 (`ReviewRow`); contracts §2.
  - `ReviewerRefSerializer` (`name`, `avatar`) and `ReviewCourseRefSerializer` (`id`, `title`) — the shapes
    008 already ships as `PersonRef` and `CourseRef`. Three instructor reads agreeing on `{name, avatar}`
    and `{id, title}` is worth more than any per-feature naming preference.
  - `InstructorReviewSerializer(ModelSerializer)` over `Review`, fields exactly
    `['id', 'rating', 'comment', 'updated_at', 'reviewer', 'course']`. Add a docstring saying **nothing may
    be added to `fields`** — FR-039 and SC-007 fix this set and T029 asserts it over the raw response body,
    so a convenient extra field fails a test rather than quietly leaking a student's email, orders, progress
    or quiz results.
  - `name`: `from apps.course.dashboard.service import person_name`. **Import it, do not restate it** — that
    is what keeps the username fallback identical across 008, 010 and 012 (FR-015).
  - `avatar`: `obj.user.user.profile_picture or None`, so `''` and `NULL` both become `null` and the client
    has one absent case. Note the **two hops**: `Review.user` is a `StudentProfile`, and the person is one
    relation further on.
  - `comment`: pass through unchanged. The model is `blank=True`, never nullable, so this is `''` and never
    `null` (FR-018) — say so in a comment, because the client branches on it.
  - `updated_at`: a **date, never a timestamp** — `obj.updated_at.astimezone(dt_timezone.utc).date()
    .isoformat()`. Spell the conversion out rather than using `DateField`, which refuses a datetime outright
    precisely so that no timezone gets picked silently. **Pattern**: `get_enrolled_at` in
    `InstructorStudentSerializer` (`backend/apps/course/serializers.py`) does this exact thing; copy its
    comment too. Note that this is the one place 012 deviates from 008, which returns a full ISO datetime.
  - **Done when**: `python manage.py check` passes. (Behaviour is proven by T016.)

- [X] T006 [ME] Add `InstructorReviewsView(ListAPIView)` to `backend/apps/reviews/views.py`
  - **What**: the endpoint. Ownership, scope resolution, the rating parse, stats-before-filter, and the
    page — all four of this feature's silent-failure traps live in this one class.
  - **Read first**: research.md R1, R2, R4, R8, R11, R12; data-model.md §3; contracts §1, §3.
  - **Depends on** T003, T004, T005.
  - Class attributes: `authentication_classes = [CookieJWTAuthentication]`,
    `permission_classes = [IsAuthenticated, isInstructor]` (imported from `apps.course.permissions`, as
    `isAdmin` already is in this file), `throttle_scope = 'instructor_reviews'`,
    `serializer_class = InstructorReviewSerializer`, `pagination_class = InstructorReviewsPagination`.
    **No `filter_backends`** — the rating filter is parsed by hand (below), not by DRF.
  - `_resolve_owned_course(self, raw)` — `int()` parse, reject `< 1`, then
    `Course.objects.filter(instructor=self._profile, id=course_id).first()`. **Every** failure returns
    `None` so `list()` answers all of them with one identical `404`: another instructor's course, a course
    that does not exist, and an unparseable id. A different response for any of them turns this endpoint
    into a probe for which course ids exist (FR-038). The `int()` parse is the part that is easy to omit —
    without it `?course=abc` reaches the ORM, raises `ValueError` → `500`, and that `500` is itself the
    distinguishing signal.
    - **Pattern**: `InstructorStudentsView._resolve_owned_course` in `backend/apps/course/views.py`. This is
      the **second copy** — add a comment pointing at both, and at research follow-up **F1** (extract a
      shared ownership mixin, deliberately deferred so this feature does not edit 010's shipped view).
  - `_rating_filter(self, raw)` — return `5`, `4`, or `None`. **Anything else is `None`**: absent, `all`,
    `abc`, `0`, and notably **`3`**. Comment why `3` is "unrecognised" here: the page has exactly three
    chips, so honouring `3` would leave the UI in a state it cannot display or clear (FR-021, FR-027).
    **Never `400`** — the address is the least trustworthy input on the page (a stale bookmark, a
    hand-edited URL) and FR-027 requires a silent fallback.
  - `get_queryset(self)` — built from ownership **outward**, so scoping is a filter rather than a check
    someone can forget:
    `Review.objects.filter(course__instructor=self._profile)`, then `.filter(course=self._course)` when a
    course was resolved. A course id from the client can only *narrow* this, and only after `list()` has
    resolved it against the owned set. **This method returns the queryset `stats` is computed from** — it
    must **not** apply the rating filter.
  - `filter_queryset(self, queryset)` — apply `.filter(rating=...)` when `self._rating` is set, then
    `.select_related('user__user', 'course').order_by('-updated_at', '-id')`.
    - `select_related('user__user', 'course')` is what keeps name, picture and course title off the N+1
      path — the same two-hop join 008's `_recent_reviews` uses.
    - `.order_by()` is **mandatory, not optional**: `Review.Meta.ordering = ['-created_at']` means a
      queryset that stays silent is sorted by creation date, which contradicts FR-020 and makes the
      displayed date disagree with the row's position.
    - The `'-id'` tiebreak is **not cosmetic**: `updated_at` is `auto_now`, and a bulk edit or two
      simultaneous submissions produce identical timestamps; with `-updated_at` alone the order among tied
      rows is unspecified, so pages repeat **and** skip reviews with no writes happening at all.
  - `list(self, request, *args, **kwargs)` — override, because the unfiltered queryset has to survive to the
    aggregate:
    1. Resolve `self._profile` from `request.user.instructor_profile`; on `InstructorProfile.DoesNotExist`
       return `403 {'error': 'No instructor profile is associated with this account.', 'code':
       'no_instructor_profile'}`. Refused explicitly, not served an empty page: an empty feed already means
       "no reviews yet", and a broken account must not look like a new instructor (FR-035, FR-040). Same
       shape as 009 and 010, so the client's existing no-profile state handles it.
    2. Resolve `self._course` from `?course=` when present; `None` → `404 {'error': 'Course not found.'}`.
    3. Resolve `self._rating` from `?rating=`.
    4. `base = self.get_queryset()`; `self.paginator.stats = build_instructor_review_stats(base)`.
       **`base`, not the filtered queryset** — FR-007 and owner answer P4 fix the tiles to the whole scope,
       so selecting "5 stars" must not make the average read 5.0. Comment this line; it is the single most
       reversible mistake in the feature.
    5. `page = self.paginate_queryset(self.filter_queryset(base))` — **outside** the try/except below, on
       purpose: a `NotFound` raised here is a genuine 404 and must not be reported as a server error.
    6. Serialize and `return self.get_paginated_response(serializer.data)`, wrapped in a
       `try/except Exception` that logs and returns
       `500 {'error': "We couldn't load the reviews. Please try again."}`.
  - **Done when**: `python manage.py check` passes and `python manage.py test apps.reviews` is green.

- [X] T007 [AI] Register the route in `backend/apps/reviews/urls.py`
  - **What**: exposes the view at `/reviews/instructor/reviews/`.
  - **Pattern**: the existing `path('course/<int:course_id>/', ...)` line in the same file.
  - **Read first**: research.md R2; contracts §1.
  - Add `path('instructor/reviews/', InstructorReviewsView.as_view(), name='instructor_reviews')` to
    `urlpatterns` (not the router — this is an `APIView`, not a viewset), and import the view. The
    `name='instructor_reviews'` must match exactly: T002's `url()` helper reverses it.
  - **Done when**: `python manage.py show_urls` (or a `reverse('instructor_reviews')` in a shell) resolves to
    `/reviews/instructor/reviews/`.

### Frontend

- [X] T008 [P] [ME] Create `front-end/src/featuers/instructor-reviews/types/instructorReviews.types.ts`
  - **What**: the TypeScript shape of the contract plus the three formatters every component shares.
  - **Read first**: contracts §2, §5; data-model.md §2.
  - **Pattern**: `featuers/instructor-students/types/instructorStudents.types.ts`.
  - Types: `ReviewRow`, `ReviewStats`, `ReviewsPage`, `ReviewsQuery`, and
    `RatingFilter = "all" | "5" | "4"`.
  - `export const REVIEWS_PAGE_SIZE = 10` — must match T004's `page_size`; `RosterPagination` needs it to
    compute the position label.
  - `RATING_OPTIONS`: `[{value:"all",label:"All ratings"}, {value:"5",label:"★ 5"}, {value:"4",label:"★ 4"}]`
    — the single source of the three chips, so T025 cannot add a fourth.
  - Formatters: `formatReviewDate(iso)` (a `"YYYY-MM-DD"` string → `"Jul 14"`; **split the string, never
    `new Date()`** — a date-only string is parsed as UTC midnight and renders as the previous day west of
    Greenwich), `fiveStarRate(stats)` returning `number | null` (`null` when `total_reviews === 0`, so the
    caller cannot print "0%" for an unreviewed course — FR-012), and `hasReviews(stats)`.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T009 [P] [ME] Create `front-end/src/featuers/instructor-reviews/schemas/instructorReviews.schma.ts`
  - **What**: runtime validation of the response. Constitution I requires Zod on API responses.
  - **Read first**: contracts §2, §5.
  - **Pattern**: `featuers/instructor-students/schemas/instructorStudents.schma.ts` — copy its structure and
    the reasoning in its comments.
  - `ReviewStatsSchema`: `avg_rating: z.number().nullable()` — **`.nullable()`, deliberately not
    `.optional()` with a default**. Defaulting it to `0` would print "0.0" for a course nobody has reviewed,
    which FR-012 forbids; making the null case unavoidable at every call site is the whole point.
    `total_reviews`, `five_star_count`, `this_month_count` are `z.number()`.
  - `ReviewRowSchema`: `id`, `rating`, `comment: z.string()` (never nullable — the model is `blank=True`),
    `updated_at: z.string()` with a comment that it is `"YYYY-MM-DD"` and must never be passed to
    `new Date()`, `reviewer: z.object({name: z.string(), avatar: z.string().nullable()})`,
    `course: z.object({id: z.number(), title: z.string()})`.
  - `ReviewsPageSchema`: `stats` + `count` + `next`/`previous` nullable + `results`.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T010 [P] [ME] Create `front-end/src/featuers/instructor-reviews/hooks/useReviewParams.tsx`
  - **What**: puts the star filter and the page number in the address, so refresh, Back/Forward and shared
    links all restore the same view (FR-027, FR-030).
  - **Read first**: contracts §5; spec FR-025, FR-027, FR-030, FR-031.
  - **Pattern**: `featuers/instructor-students/hooks/useRosterParams.tsx` — this is that hook with `rating`
    in place of `search`. Keep all three of its decisions and its comments explaining them:
    - `router.replace`, not `push`, so clicking through three chips does not leave three history entries;
    - a parameter at its default (`rating=all`, `page=1`) is **deleted**, not written empty;
    - the page reset happens **in the same write** as the filter change, not in a follow-up effect — two
      writes would fire a request for page 5 of a result set that may now have one page, which the server
      bounces to page 1, producing a visible flicker for no reason (FR-025).
  - Reads fall back silently: an unrecognised `page` is `1`, and an unrecognised `rating` — including `"3"`
    — is `"all"`. Validate against `RATING_OPTIONS` from T008 rather than a second hand-written list. The
    API is the strict one; the address never errors.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T011 [AI] Create `front-end/src/featuers/instructor-reviews/api/instructorReviews.api.ts`
  - **What**: the one request this feature makes, parsed by Zod rather than cast.
  - **Pattern**: `featuers/instructor-students/api/instructorStudents.api.ts` — same structure, same
    "send a parameter only when it carries a value" rule so the URL is never `?rating=all&page=1`.
  - **Read first**: contracts §1, §5.
  - `getReviews({courseId, rating, page})` → `GET /reviews/instructor/reviews/`, sending `course` only when
    defined, `rating` only when not `"all"`, `page` only when `> 1`. Return
    `ReviewsPageSchema.parse(data)` — parsed, not cast, so a mismatched payload throws and the page shows
    its error state instead of rendering missing values as blanks or zeros.
  - Export as `export const instructorReviewsAPI = { getReviews }`.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T012 [AI] Create `front-end/src/featuers/instructor-reviews/hooks/useInstructorReviews.tsx`
  - **What**: the TanStack Query wrapper.
  - **Pattern**: `featuers/instructor-students/hooks/useInstructorStudents.tsx` — copy its
    `queryKey` shape, `placeholderData` choice and `staleTime`.
  - **Read first**: spec FR-043.
  - `queryKey: ['instructor', 'reviews', courseId ?? 'all', rating, page]`. Do **not** use
    `placeholderData: keepPreviousData` — FR-043 forbids showing the previous filter's or page's rows as if
    they were the new result, which is exactly what keeping previous data does. The skeleton is the
    intended in-between state; say so in a comment, because this is the opposite of the usual instinct.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T013 [AI] Create `front-end/src/featuers/instructor-reviews/index.ts`
  - **What**: the module's public surface. Later phases extend it; nothing outside the module may import a
    deep path.
  - **Pattern**: `featuers/instructor-students/index.ts`.
  - Export the API object, the types and formatters from T008, and both hooks. Component exports are added
    by T022 and T034 as they are written.
  - **Done when**: `npx tsc --noEmit` passes.

**Checkpoint**: the endpoint is live and independently verifiable. Run quickstart.md §3 (all 16 checks) and
§4 (query budget) now, before any component exists.

---

## Phase 3: User Story 1 — Read the reviews on one course (Priority: P1) 🎯 MVP

**Goal**: the course workspace Reviews tab shows four accurate tiles and a paged list of reviews.

**Independent test**: for one course with a known set of reviews — different ratings, one with no comment,
a reviewer with no picture, one with no name set, and reviews from different months — open its Reviews tab
and confirm every tile and every row matches the underlying data (quickstart.md §5, first half).

### Tests

- [X] T014 [P] [ME] `StatsTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: pins the four figures. This is the arithmetic the whole page rests on.
  - **Read first**: contracts §2; spec FR-008 – FR-013, and its Acceptance Scenarios 2 and 3 for US1.
  - Cover: ratings 5/5/4/2 → `avg_rating == 4.0`, `total_reviews == 4`, `five_star_count == 2`; a scope with
    **no reviews** → `avg_rating is None` (**not `0.0`**) with the other three at `0`; a single review → no
    small-sample hiding; and an average that needs rounding → one decimal.
  - Assert `stats` is byte-identical across `?page=1` and `?page=2` of the same scope.
  - **Done when**: the class is green and each assertion fails if `build_instructor_review_stats` is
    reverted to a plain `Count`.

- [X] T015 [P] [ME] `MonthBoundaryTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: the `created_at` vs `updated_at` trap. Both numbers come out wrong together and **nothing
    raises**, which is why this is its own class.
  - **Read first**: research.md R7; spec FR-011 and US1 Acceptance Scenario 4.
  - Build a review `created_at` **last month**, `updated_at` **today**, via T002's `make_review(...)`
    `.update()` path. Assert in one test that it is **absent** from `this_month_count` **and** **first** in
    `results`, dated today. One test, both assertions — they fail together and must be read together.
  - Add a review created on the first instant of the current UTC month (boundary inclusive) and one created
    a microsecond before it (excluded).
  - Freeze time with the project's existing approach (`tests_analytics.py` patches `timezone.now`; reuse it)
    so the class does not break on the 1st of a month.
  - **Done when**: the class is green, and swapping `created_at` for `updated_at` in T003 fails it.

- [X] T016 [P] [ME] `OrderingTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: pins `-updated_at, -id` and proves the model's own `Meta.ordering` does not win.
  - **Read first**: research.md R8; spec FR-020.
  - Cover: reviews with distinct `updated_at` come back newest-updated first; a review whose `created_at` is
    oldest but `updated_at` is newest sorts **first** (this is the assertion that fails if `.order_by()` is
    omitted and `Meta.ordering` takes over); and **three reviews with identical `updated_at` straddling the
    10-row page boundary** appear exactly once each across two pages — no repeat, no skip.
  - **Done when**: the class is green, and removing `'-id'` from the `order_by` makes the tiebreak test
    flaky-to-failing rather than passing.

- [X] T017 [P] [AI] `RowShapeTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: pins each row field's format and its absent case.
  - **Pattern**: the row-shape tests in `backend/apps/course/tests_roster.py` (spec 010).
  - **Read first**: contracts §2; spec FR-014 – FR-019.
  - Cover: a review with no comment → `comment == ''` (**not `null`**); a reviewer with no picture →
    `avatar is None`, and one with `profile_picture=''` → also `None`; a reviewer with blank first and last
    names → `name` is their username, never blank; `updated_at` matches `^\d{4}-\d{2}-\d{2}$` with **no time
    component**; and `course` carries `id` and `title` in the per-course scope as well as the aggregate one.
  - **Done when**: the class is green.

### Implementation

- [X] T018 [P] [AI] Create `front-end/src/featuers/instructor-reviews/components/ReviewsTiles.tsx`
  - **What**: the four summary tiles.
  - **Pattern**: `featuers/instructor-analytics/components/AnalyticsTiles.tsx` — reuse its `Tile` and
    `Empty` sub-components' markup and token classes verbatim; only the labels, icons and values change.
  - **Read first**: spec FR-006, FR-008 – FR-012; quickstart.md §5.
  - Four tiles in this order: **Avg rating**, **Total reviews**, **5-star**, **This month**.
  - `avg_rating` renders to **one decimal** — `4.0` must read "4.0", not "4" (spec Edge Cases). Use
    `.toFixed(1)`.
  - When `stats.total_reviews === 0`, every tile shows the neutral label from `fiveStarRate`/`hasReviews`
    (T008), never `0.0` or `0%` (FR-012). This mirrors `AnalyticsTiles`' own "a percentage is shown only
    when a real denominator exists" rule — copy that comment.
  - Icons from `lucide-react`, matching the analytics tiles' visual weight.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T019 [P] [ME] Create `front-end/src/featuers/instructor-reviews/components/ReviewCard.tsx`
  - **What**: one review row. First instance of this feature's row pattern — every later phase reuses it
    unchanged.
  - **Read first**: spec FR-014 – FR-019, FR-005; the "Reviews (read-only)" frame in the UI/UX wireframe
    (avatar · name · stars on the left, course title · date on the right, comment beneath).
  - Compose the existing `StarRating` atom (`@/components/atoms/StarRating`) — **do not draw stars by
    hand**. It already renders fractional fills and carries `role="img"` with an
    `aria-label="N out of 5 stars"`, which is exactly what FR-017 ("legible to assistive technology, not by
    shape alone") requires. Pass the integer rating.
  - Avatar: the existing `avatar` atom with a neutral placeholder fallback, and `onError` falling back too —
    a removed Cloudinary image must not render broken (FR-016, spec Edge Cases).
  - `comment === ""` → render an explicit muted line ("No comment written."), **never an empty block**
    (FR-018). This is the case that reads as a loading failure if it is left blank.
  - Date via `formatReviewDate` from T008. **Never `new Date(updated_at)`** — see T008.
  - The course title is shown in **both** scopes (spec Assumptions), so this component always renders it and
    takes no "hide course" prop.
  - Long comments and non-Latin names must wrap, not push the layout sideways: use `break-words` /
    `min-w-0`, and verify at 375px (FR-005).
  - **Done when**: `npx tsc --noEmit` passes and the card renders correctly for: a 5-star review with a long
    comment, a 4-star review with none, and a reviewer with no picture.

- [X] T020 [P] [AI] Create `front-end/src/featuers/instructor-reviews/components/ReviewsStates.tsx`
  - **What**: the five non-list states, in one file because they are variants of one idea and always change
    together.
  - **Pattern**: `featuers/instructor-students/components/RosterStates.tsx` — copy its structure, its
    `aria-busy`/`aria-live` handling and its comments.
  - **Read first**: spec FR-026, FR-035, FR-042 – FR-044.
  - Export: `ReviewsSkeleton` (tiles + cards, preserving layout — it **replaces** the list rather than
    dimming it, because FR-043 forbids showing the previous result during a fetch), `ReviewsError`
    (plain message + retry, never a raw technical error), `NoReviewsYet` ("student reviews will appear
    here"), `NoFilterMatch` (names the active filter and offers a way to clear it), and `NoCoursesYet`
    (points at creating a course).
  - `NoReviewsYet` and `NoFilterMatch` must be **visibly different** (FR-026) — different icon, different
    copy, and only the latter carries a clear-filter action.
  - Also export a `NoInstructorProfileState` re-export or equivalent for the `403 no_instructor_profile`
    body, reusing 010's component rather than writing a second one.
  - **Done when**: `npx tsc --noEmit` passes.

- [X] T021 [ME] Create `front-end/src/featuers/instructor-reviews/components/CourseReviews.tsx`
  - **What**: the per-course orchestrator — the component the workspace tab renders. Decides which state is
    on screen.
  - **Read first**: spec FR-001, FR-003, FR-026, FR-042 – FR-044; contracts §4 (the worked examples are the
    state table).
  - **Pattern**: `featuers/instructor-students/components/CourseStudents.tsx`.
  - **Depends on** T010, T012, T018, T019, T020.
  - Takes `courseId: number`. Calls `useReviewParams()` and `useInstructorReviews({courseId, rating, page})`.
  - Layout order per FR-003: header (title + filter, added in T026) → tiles → list → paging.
  - **The state decision, in this order** — get it wrong and the two empty states collapse into one:
    1. loading → `ReviewsSkeleton`;
    2. error, `403 no_instructor_profile` → the no-profile state; any other error → `ReviewsError`;
    3. `stats.total_reviews === 0` → `NoReviewsYet` (the course has never been reviewed);
    4. `count === 0` → `NoFilterMatch` (**reviews exist, this filter matches none** — this is precisely what
       `total_reviews > 0 && count === 0` means; see contracts §4);
    5. otherwise the list.
    Tiles render in cases 4 and 5, never in 3.
  - Paging: `RosterPagination` from `@/components/molecules/RosterPagination`, with `label="reviews"` and
    `pageSize={REVIEWS_PAGE_SIZE}`. **Do not write a new pagination component** — 010 put that one in
    `molecules/` with no roster vocabulary specifically for this spec.
  - **Done when**: `npx tsc --noEmit` passes and each of the five states can be reached.

- [X] T022 [AI] Replace the `ComingSoon` placeholder in `front-end/src/app/instructor/courses/[courseId]/reviews/page.tsx`, and extend the barrel
  - **Pattern**: `front-end/src/app/instructor/courses/[courseId]/students/page.tsx` — copy it exactly,
    swapping the component names.
  - `"use client"`, read `courseId` from `useParams()`, render `<CourseReviews courseId={...} />` inside
    `<Suspense fallback={<ReviewsSkeleton />}>`. **The Suspense boundary is required, not decorative**:
    `useReviewParams` reads `useSearchParams`, which Next 16 requires to sit under one.
  - Add `CourseReviews` and `ReviewsSkeleton` to `featuers/instructor-reviews/index.ts`.
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass, and `/instructor/courses/<id>/reviews` renders
    real data with the Reviews tab marked active.

**Checkpoint**: User Story 1 is complete and demonstrable on its own. Run quickstart.md §5 (first half) and
§7.

---

## Phase 4: User Story 2 — Filter the list by star rating (Priority: P1)

**Goal**: three chips narrow the list to 5-star or 4-star reviews, and the four tiles do not move.

**Independent test**: for a course with reviews at every rating, select each option in turn and confirm the
list content, the tiles' independence from it, the page reset, and the address (quickstart.md §5, second
half).

### Tests

- [X] T023 [P] [ME] `FilterTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: pins the rating parse and — the important one — that `stats` ignores it.
  - **Read first**: research.md R4, R11; contracts §1, §4; spec FR-007, FR-021 – FR-024, FR-027, SC-004.
  - Cover: `?rating=5` and `?rating=4` return only that rating; `?rating=3`, `?rating=all`, `?rating=abc`,
    `?rating=0` and `?rating=` **all** return the unfiltered list with a `200` — assert the **status is 200
    and not 400 or 500** explicitly, because `?rating=abc` reaching the ORM is a `ValueError` → `500`.
  - Assert `response.data['stats']` is **identical** under `?rating=5`, `?rating=4` and no filter for the
    same scope. This is SC-004 and the single most reversible mistake in the feature.
  - Assert the `total_reviews > 0, count == 0` case for a course whose reviews are all 5-star filtered to 4
    — the signal the client uses to tell "no match" from "no reviews".
  - **Done when**: the class is green, and moving the `stats` call after `filter_queryset` in T006 fails it.

- [X] T024 [P] [ME] `PagingTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: pins the page fallback and that paging is exhaustive under a filter.
  - **Read first**: research.md R9; contracts §1; spec FR-028 – FR-032.
  - Cover: `?page=999`, `?page=0`, `?page=-1`, `?page=abc` and `?page=` all return **page 1 with a `200`**,
    never a `404`; `?page=last` resolves to the final page; an **empty** scope resolves to page 1 rather
    than tripping the upper bound; `page_size` is fixed at 10 and `?page_size=100` is **ignored** (FR-028);
    and paging through a filtered feed twice returns every review exactly once, with no duplicate and no
    omission.
  - **Done when**: the class is green.

### Implementation

- [X] T025 [P] [ME] Create `front-end/src/featuers/instructor-reviews/components/RatingFilter.tsx`
  - **What**: the three chips.
  - **Pattern**: `featuers/instructor-analytics/components/PeriodSelector.tsx` — same
    `role="group"` + `aria-pressed` button pattern and the same active/inactive token classes.
  - **Read first**: spec FR-021 – FR-023, FR-027.
  - Render from `RATING_OPTIONS` (T008), never a hand-written list — that is what makes "exactly three
    options" (FR-021) structural rather than a convention someone can break.
  - Exactly one chip carries `aria-pressed={true}` at all times. `aria-label="Filter by rating"` on the
    group.
  - The 5 and 4 chips show a star glyph; keep it decorative (`aria-hidden`) since the label already carries
    the meaning.
  - **Done when**: `npx tsc --noEmit` passes and keyboard tabbing reaches all three chips.

- [X] T026 [AI] Wire the filter into `front-end/src/featuers/instructor-reviews/components/CourseReviews.tsx`
  - **What**: puts `RatingFilter` in the header and connects it to the address.
  - **Pattern**: how `CourseStudents.tsx` wires `StudentSearch` to `useRosterParams`.
  - **Read first**: spec FR-003, FR-025; T010's notes.
  - Render `RatingFilter` in the header row beside the title, per FR-003 and the wireframe.
  - `onChange` calls `setRating` from `useReviewParams` — which **already** resets the page in the same
    write (T010). Do **not** add a second `setPage(1)` call or an effect; that is the flicker T010's
    comment warns about.
  - Pass the active filter's label to `NoFilterMatch` so the empty state names it (FR-026).
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass; selecting each chip changes the list, leaves
    the tiles unchanged, returns to page 1, and updates the address.

**Checkpoint**: User Stories 1 and 2 are both complete. The P1 per-course slice ships here.

---

## Phase 5: User Story 4 — Nobody reads another instructor's reviews (Priority: P1)

**Goal**: prove the ownership boundary built in T006. **No new production code** — this phase is tests, plus
the privacy and query-budget assertions that hold the design in place.

**Independent test**: request each scope as its owner, as a different instructor, as a student, and while
signed out, directly and without the interface (quickstart.md §3, checks 10–16).

### Tests

- [X] T027 [P] [ME] `OwnershipTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: the security property. The three `404`s being **indistinguishable** is the whole test.
  - **Read first**: research.md R12; contracts §3; spec FR-036 – FR-038, FR-040, SC-006.
  - Cover, with two instructors A and B:
    - `?course=<B's course>`, `?course=999999` and `?course=abc` return **the same status and the same
      response body** — assert equality between the three responses directly, not three separate
      `assertEqual(404)` calls. A difference in either makes the endpoint a probe for which course ids
      exist.
    - A's aggregate scope contains **no** review of B's courses, and A's `stats` counts none of them.
    - A review **A wrote as a student** on B's course appears nowhere in A's feed (US4 Acceptance
      Scenario 5) — the scope is reviews *of* A's courses, not *by* A.
    - A student account → `403`; signed out → `401`; `POST`/`PATCH`/`DELETE` → `405` (FR-041).
    - A staff account with `is_staff=True` but **no** `InstructorProfile` → `403` with
      `code == 'no_instructor_profile'`, not a `500` and not an empty page.
  - **Done when**: the class is green, and removing the `int()` parse from `_resolve_owned_course` fails the
    indistinguishability assertion (it becomes a `500`).

- [X] T028 [P] [ME] `PrivacyTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: asserts the **exact key set** of a row over the raw response body, so a future convenient
    field fails a test instead of leaking.
  - **Pattern**: `RosterPrivacyTests` in `backend/apps/course/tests_roster.py`, and the `_all_keys`
    generator T002 imports.
  - **Read first**: contracts §2; spec FR-039, SC-007.
  - Assert a row's keys are exactly
    `{'id', 'rating', 'comment', 'updated_at', 'reviewer', 'course'}`, `reviewer`'s are exactly
    `{'name', 'avatar'}`, and `course`'s are exactly `{'id', 'title'}`.
  - Walk the whole response with `_all_keys` and assert no key or value anywhere contains the reviewer's
    **email**, and that no `progress`, `order`, `enrolled_at`, `quiz`, `score` or `user_id` key appears.
  - **Done when**: the class is green, and adding any field to `InstructorReviewSerializer.Meta.fields`
    fails it.

- [X] T029 [P] [ME] `PerformanceTests` in `backend/apps/reviews/tests_instructor.py`
  - **What**: pins the query budget, so the feature cannot silently become N+1.
  - **Pattern**: `RosterPerformanceTests` in `backend/apps/course/tests_roster.py`.
  - **Read first**: research.md R5; data-model.md §3 (Query budget); quickstart.md §4.
  - `assertNumQueries(3)` for the aggregate scope and `assertNumQueries(4)` for `?course=<id>`, via the
    `QUERIES_AGGREGATE` / `QUERIES_COURSE` constants at the top of the module.
  - **Then assert flatness**: run each again with roughly three times the reviews and **the same** expected
    counts. A budget test that only ever sees one fixture size passes while the endpoint is N+1.
  - Comment which query is which (stats · `COUNT(*)` · the page · ownership), and why the ownership query
    cannot be folded into the main scope: an owned course with no reviews must stay distinguishable from a
    course the caller does not own, and an empty result cannot tell those apart.
  - **Done when**: the class is green, and dropping `select_related('user__user', 'course')` from T006 fails
    the flatness assertion.

**Checkpoint**: the P1 stories are all complete and proven. This is a shippable feature.

---

## Phase 6: User Story 3 — Read reviews across all courses (Priority: P2)

**Goal**: the sidebar Reviews page shows the same thing across every owned course.

**Independent test**: for an instructor owning several courses — including an unpublished one with reviews
and one with no reviews — open the sidebar Reviews page and confirm the scope, the interleaved ordering, and
both empty states (quickstart.md §6).

### Tests

- [X] T030 [P] [AI] `AggregateScopeTests` in `backend/apps/reviews/tests_instructor.py`
  - **Pattern**: the cross-course test class in `backend/apps/course/tests_roster.py`.
  - **Read first**: spec FR-033 – FR-035; research.md R14 (008 already scopes this way).
  - Cover: reviews from **all** owned courses appear together, each row naming its course; an
    **unpublished** course's reviews **are** included, in both `results` and `stats` (this is the assertion
    that fails if someone "helpfully" adds `is_published=True` to the queryset); ordering interleaves
    courses by `updated_at` regardless of which course a review belongs to; and the filter applies across
    every owned course.
  - Also assert an instructor who owns **no courses** gets `total_reviews == 0` and `count == 0` with a
    `200` — the client, not the server, distinguishes that from "no reviews yet" (it knows the course count
    from elsewhere).
  - **Done when**: the class is green.

### Implementation

- [X] T031 [AI] Create `front-end/src/featuers/instructor-reviews/components/InstructorReviews.tsx`
  - **What**: the all-courses orchestrator.
  - **Pattern**: `featuers/instructor-students/components/InstructorStudents.tsx`, and T021's
    `CourseReviews` — this is that component with `courseId` omitted.
  - **Read first**: spec FR-002, FR-004, FR-035.
  - Takes no props. Same hooks, same state order as T021, with `courseId: undefined`.
  - Header states that it covers **all** the instructor's courses (FR-004), matching the wireframe's
    "Read-only · across all your courses" subtitle.
  - **The one behavioural difference**: distinguish an instructor with **no courses** from one whose courses
    have **no reviews** (FR-035). The endpoint returns `total_reviews == 0` for both, so read the course
    count from the existing instructor-courses query — `NoCoursesYet` when it is zero, `NoReviewsYet`
    otherwise.
  - **Done when**: `npx tsc --noEmit` passes and both empty states can be reached.

- [X] T032 [AI] Replace the `ComingSoon` placeholder in `front-end/src/app/instructor/reviews/page.tsx`, and extend the barrel
  - **Pattern**: `front-end/src/app/instructor/students/page.tsx` — copy it exactly, swapping the component
    names. Note this page is **not** `"use client"` at the top level; the Suspense boundary wraps a client
    orchestrator, exactly as 010's does.
  - Render `<InstructorReviews />` inside `<Suspense fallback={<ReviewsSkeleton />}>`.
  - Add `InstructorReviews` to `featuers/instructor-reviews/index.ts`.
  - **Done when**: `npx tsc --noEmit` and `npm run lint` pass, `/instructor/reviews` renders real data, the
    Reviews sidebar item is marked active, and no "coming soon" text remains anywhere
    (`grep -rn "ComingSoon" front-end/src/app/instructor/` returns only the pages this spec does not own).

**Checkpoint**: every user story is complete. Run quickstart.md §6.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T033 [P] [ME] Verify both pages at a 375px viewport
  - **Read first**: spec FR-005, SC-011; quickstart.md §8.
  - No horizontal page scrolling; all four tiles readable; every field of a row reachable. Check the hard
    cases specifically: a very long comment, a non-Latin name, and a long course title on a narrow row.
  - Tiles may restack and a row may reflow, but nothing may become unreachable.
  - **Done when**: both pages pass at 375px in light and dark.

- [X] T034 [P] [AI] Confirm the feature adds no dependency and no migration
  - `git diff` on `front-end/package.json`, `front-end/package-lock.json` and
    `backend/requirements.txt` → **empty**.
  - `backend/apps/reviews/migrations/` → **no new file**.
  - `python manage.py makemigrations --check --dry-run` → reports nothing to do.
  - **Done when**: all four hold. If any does not, stop and re-read plan.md Technical Context.

- [X] T035 [P] [AI] Frontend gates
  - `cd front-end && npx tsc --noEmit` and `npm run lint`, both clean.
  - No `console.log` left in the new module; no `any`.
  - **Done when**: both commands exit zero.

- [X] T036 [AI] Backend regression
  - `python manage.py test apps.reviews.tests_instructor apps.course.tests_dashboard apps.course.tests_roster`
    — all green. Module labels, not a bare `apps.reviews` (which does not resolve).
  - `tests_dashboard` matters because T005 imports `person_name` from 008's service; `tests_roster` because
    T027's ownership pattern is copied from it. Neither should move, but a failure here means something
    shared did.
  - **`apps.reviews.tests` is deliberately excluded**: it is already red on `master` with 11 errors and 1
    failure that predate this feature (stale `video_url=` from spec 001 vs spec 006's schema, and a
    `page_size == 2` assertion against a paginator that says 10). Run it if you like, but compare against
    the same 12 — this feature must not add a thirteenth, and must not be blamed for the twelve.
  - **Done when**: the three named modules are green, and `apps.reviews.tests` fails in exactly the same 12
    places it did before Phase 1.

- [ ] T037 [ME] Run quickstart.md end to end
  - All nine sections, including §9 Regression — the **public** course-reviews list still pages as before
    (its paginator was not amended), a student can still write/edit/delete a review, and the instructor
    dashboard's Recent reviews card still renders.
  - §9 also records the expected divergence: the dashboard's avg-rating tile counts **published** courses
    only and may legitimately differ from this page's average. Confirm it is the *expected* difference, not
    a bug.
  - **Done when**: every section passes, and any deviation is either fixed or written into research.md.

- [X] T038 [AI] Update `specs/_overview.md` with the shipped feature
  - **Pattern**: how 010 was recorded there.
  - Move instructor reviews from planned to shipped; note that `/instructor/reviews` and the workspace
    Reviews tab are live and that the remaining `ComingSoon` placeholder is Earnings (spec 013).
  - **Done when**: `specs/_overview.md` reflects the current state.

---

## Dependencies & Execution Order

### Phase dependencies

```
Phase 1 (Setup)
   └─> Phase 2 (Foundational — the endpoint)     ⚠️ BLOCKS EVERYTHING
          ├─> Phase 3 (US1, P1)  🎯 MVP
          │      └─> Phase 4 (US2, P1)           needs CourseReviews from T021
          ├─> Phase 5 (US4, P1)                  tests only — independent of Phases 3, 4
          └─> Phase 6 (US3, P2)                  needs T021's state logic as its pattern
                 └─> Phase 7 (Polish)
```

### Within Phase 2

- T003, T004, T005 are `[P]` — three different files, no shared dependency.
- **T006 depends on all three** and is the only serialised task in the phase.
- T007 depends on T006.
- The frontend track (T008–T013) runs **at the same time as the whole backend track** — it depends only on
  contracts/, which is already written. T008 and T009 are `[P]`; T010 needs T008's `RATING_OPTIONS`; T011
  needs T009; T012 needs T011; T013 needs all of them.

### Serialised by shared file

Work these in ID order, one at a time:

| File | Tasks |
|------|-------|
| `backend/apps/reviews/tests_instructor.py` | T002 → T014 → T015 → T016 → T017 → T023 → T024 → T027 → T028 → T029 → T030 |
| `backend/apps/reviews/views.py` | T006 |
| `front-end/.../CourseReviews.tsx` | T021 → T026 |
| `front-end/.../index.ts` | T013 → T022 → T032 |

The test module is the heaviest contention point — eleven tasks. They are marked `[P]` because they are
independent *classes* that can be written in any order, but they land in one file, so commit them one at a
time.

### Parallel opportunities

- **Phase 2**: the entire backend track and the entire frontend track, simultaneously.
- **Phase 3**: T014–T017 (four test classes) and T018–T020 (three components) — seven files, no overlap.
- **Phase 5**: all three test classes.
- **Phase 7**: T033, T034, T035.

---

## Parallel Example: Phase 3

```
# Backend track — four independent test classes (one file, so commit in ID order):
T014  StatsTests
T015  MonthBoundaryTests        <- the silent-failure trap; write this one yourself
T016  OrderingTests             <- the second silent-failure trap
T017  RowShapeTests

# Frontend track, at the same time — three different files, no shared dependency:
T018  ReviewsTiles.tsx
T019  ReviewCard.tsx            <- first instance of the row pattern
T020  ReviewsStates.tsx

# Then, serialised:
T021  CourseReviews.tsx         (needs T018, T019, T020)
T022  page.tsx + barrel         (needs T021)
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Phase 1 → Phase 2 → Phase 3.
2. **Stop and verify**: quickstart.md §3, §4, §5 (first half), §7.
3. At this point the workspace Reviews tab shows accurate tiles and a paged, correctly ordered list. That is
   a real, demonstrable feature — discovery US-11 delivered — with the sidebar page still a placeholder.

### Incremental delivery

| Ship | Phases | What the instructor gets |
|------|--------|--------------------------|
| 1 | 1–3 | Per-course reviews: tiles + paged list 🎯 |
| 2 | 4 | The star filter, on that tab |
| 3 | 5 | No new UI — the ownership boundary proven and pinned |
| 4 | 6 | The sidebar all-courses page |
| 5 | 7 | Polish, regression, docs |

**Phase 5 is not optional and is not last.** US4 is P1: it proves a security boundary that already exists in
T006, and leaving it unproven until the end means shipping Phases 3 and 4 on an untested ownership filter.
Run it as soon as Phase 2 is done if you are not building Phases 3 and 4 back to back.

### Parallel team strategy

With two people after Phase 2: one takes the backend test classes (T014–T017, T023–T024, T027–T030), the
other takes the whole frontend (T018–T022, T025–T026, T031–T032). They meet at Phase 7. The only coupling is
the contract, which is already written and does not change.

---

## Notes

- **The two silent failures are T015 and T016.** Everything else in this feature fails loudly. If you
  delegate only two tasks to a careful human, make them those.
- **`stats` comes from `get_queryset()`, never from `filter_queryset()`.** T006 step 4. One line, and the
  whole tiles contract rests on it.
- **Do not amend `ReviewPageNumberPagination`.** It backs the public course-reviews endpoint. The new
  paginator sits beside it.
- **Do not add `is_published=True` anywhere.** Unpublished courses' reviews are in scope by design (spec
  Clarifications), and 008 already behaves this way.
- **Follow-ups deliberately deferred**, recorded in research.md: F1 (extract a shared ownership mixin — this
  is the second copy), F2 (index `Review.updated_at` when measurement calls for it), F3 (the dashboard's
  published-only average vs this page's all-courses average).
