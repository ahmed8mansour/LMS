# Quickstart: Verifying the Instructor Reviews Feed

**Feature**: `012-instructor-reviews` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/instructor-reviews.md](./contracts/instructor-reviews.md)

## Prerequisites

```bash
cd backend && env\Scripts\activate && python manage.py runserver
```

```bash
cd front-end && npm run dev
```

**No new package**, backend or frontend. Every component this feature needs is already vendored.

**Fixture data.** The interesting cases only appear with deliberately awkward data. Reviews cannot be created
through the UI without completing a course, so the fastest route is the Django shell or the admin.

- Two instructor accounts, **A** and **B**.
- **A** owns at least four courses:
  - one **published** with ≥ 25 reviews (to cross the 10-row page boundary) spanning ratings 5, 4, 3, 2 and 1;
  - one **unpublished** that carries reviews (it must still appear — spec Clarifications);
  - one with reviews that are **all 5-star** (to see "no reviews match this filter" on the 4-star chip);
  - one with **no reviews at all**.
- **B** owns one reviewed course — nothing of B's may ever appear in A's feed.
- Among the reviewers include: one with **no profile picture**, one with **blank first and last names** (so
  the username shows), and one who left **no comment** (`comment=''`).
- **For the month boundary**: one review `created_at` **last month** but `updated_at` **today** (set both
  explicitly in the shell — `auto_now_add`/`auto_now` will not let you do this through the admin). It must be
  absent from `this_month_count` and first in `results`.
- **For the ordering tiebreak**: two or three reviews with the *exact same* `updated_at`, straddling the
  10-row page boundary.

```python
# Both fields are auto_*, so they must be written past the model's normal path.
Review.objects.filter(pk=884).update(
    created_at=datetime(2026, 8, 3, tzinfo=timezone.utc),
    updated_at=datetime(2026, 9, 21, tzinfo=timezone.utc),
)
```

## 1. Automated backend tests

```bash
cd backend && python manage.py test apps.reviews.tests_instructor
```

Use the module label, not `apps.reviews` (there is no `__init__.py` under `backend/apps/`).

Then confirm the existing reviews surface did not regress — this feature adds a paginator beside
`ReviewPageNumberPagination` and a view beside three others in the same module:

```bash
cd backend && python manage.py test apps.reviews apps.course.tests_dashboard
```

`tests_dashboard` matters because 008's `person_name` is imported by the new serializer (research R14); a
change there would surface here first.

## 2. Frontend gates

```bash
cd front-end && npx tsc --noEmit
```

```bash
cd front-end && npm run lint
```

## 3. The endpoint, without the UI

Sign in as **A** in the browser so the cookies are set, then use the same session. Every check below is
verifiable before a single component exists — this is the whole point of the phasing.

| # | Request | Expect |
|---|---------|--------|
| 1 | `/reviews/instructor/reviews/` | `stats` + `count`/`next`/`previous`/`results`; 10 rows; newest-updated first |
| 2 | `/reviews/instructor/reviews/?rating=5` | `results` all rated 5; **`stats` byte-identical to check 1** |
| 3 | `/reviews/instructor/reviews/?rating=4` | `results` all rated 4; `stats` still identical |
| 4 | `/reviews/instructor/reviews/?rating=3` | Unrecognised → **no filter**, `200`, same as check 1 |
| 5 | `/reviews/instructor/reviews/?rating=abc` | `200`, no filter. **Never a 500** — the parse must precede the ORM |
| 6 | `/reviews/instructor/reviews/?page=999` | `200`, page 1 — not a `404` |
| 7 | `/reviews/instructor/reviews/?page=abc` | `200`, page 1 |
| 8 | `?course=<A's unpublished course>` | Its reviews **are** returned |
| 9 | `?course=<A's course with no reviews>` | `avg_rating: null`, `total_reviews: 0`, `results: []` — not `0.0` |
| 10 | `?course=<B's course>` | `404 {"error": "Course not found."}` |
| 11 | `?course=999999` | **Byte-identical** `404` to check 10 |
| 12 | `?course=abc` | **Byte-identical** `404` again |
| 13 | `?course=<all-5-star course>&rating=4` | `count: 0`, `results: []`, but `total_reviews > 0` |
| 14 | `POST` to the endpoint | `405` |
| 15 | As a **student** account | `403` |
| 16 | Signed out | `401` |

Checks 10–12 are the security property. If any of the three differs in status *or* body, the endpoint is a
probe for which course ids exist (FR-038).

Check 13 is what lets the client tell FR-026 ("no reviews match this filter") from FR-042 ("no reviews yet").

**Privacy**: grep a response body for any reviewer's email address, `progress`, `order`, or quiz field. Zero
hits (FR-039, SC-007). The automated privacy test asserts the exact key set, but check it by eye once.

## 4. Query budget

Pinned by `assertNumQueries` in the test module (research R5):

| Scope | Queries |
|-------|---------|
| `?course` absent | **3** |
| `?course=42` | **4** |

(stats · `COUNT(*)` · the page, plus ownership resolution in the course scope)

Both must be flat in the number of reviews. Add 20 more reviews to a course and re-run — the numbers must not
move. If they climb with row count, `select_related('user__user', 'course')` has been lost and every row is
re-fetching its reviewer.

## 5. Per-course tab (User Stories 1 and 2)

Open `/instructor/courses/<A's big course>/reviews`.

- The **Reviews** tab is marked active in the workspace tab bar; the breadcrumb names the course.
- Four tiles: average rating (one decimal — `4.0` reads "4.0", not "4"), total reviews, 5-star rate as a whole
  percentage, and this month's count.
- Rows carry picture, name, course title, stars, comment, and a date.
- The review with **no comment** shows an explicit line saying so — not a gap.
- The reviewer with **no picture** shows the placeholder; the one with **no name** shows their username.
- Click **5 stars** → only 5-star rows; **the four tiles do not move**. Click **4 stars**, then
  **All ratings**.
- Go to page 3, then click **5 stars** → back to page 1, and the paging line describes the filtered set.
- On the all-5-star course, click **4 stars** → "no reviews match this filter" with a way to clear it, visibly
  different from the empty course's "no reviews yet".
- Refresh with `?rating=4&page=2` in the address → same filter, same page. Press Back → the previous view.
- Exactly one chip reads as selected at all times, and only three chips exist.

## 6. Sidebar page (User Story 3)

Open `/instructor/reviews`.

- The **Reviews** sidebar item is active. No "coming soon".
- Reviews from **all** of A's courses interleaved, each row naming its course, most-recently-updated first.
- The tiles describe every owned course together — including the **unpublished** one.
- The filter behaves as in §5.
- Sign in as an instructor who owns **no courses** → a state pointing at creating one, *not* an empty feed.
  Compare with A's empty course, which says reviews will appear there (FR-035).

## 7. The edited-review case

The review you back-dated in Prerequisites must, on both pages:

- appear **first** in `results`, dated **today**;
- be **absent** from `this_month_count`.

Both wrong at once means `created_at` and `updated_at` have been swapped. This fails silently — nothing
raises, the numbers are just wrong — which is why it gets its own step (research R7).

## 8. Responsive and theme

At 375px wide, on both pages: no horizontal scrolling, all four tiles readable, and every field of a row
reachable. Long comments and non-Latin names wrap or truncate visibly without pushing the layout sideways
(FR-005, SC-011).

## 9. Regression

Nothing this feature touches is written to, but confirm the surfaces that share code with it:

- `/courses/<id>` — the **public** course reviews list still pages as before (its paginator is untouched).
- `/dashboard/reviews` — a student can still write, edit and delete a review, and the course's rating still
  recomputes.
- `/instructor` — the dashboard's **Recent reviews** card still renders. Its avg-rating tile counts
  *published* courses only and may legitimately differ from the Reviews page's average for an instructor with
  an unpublished reviewed course (research F3) — that is expected, not a bug.
