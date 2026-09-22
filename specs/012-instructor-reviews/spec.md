# Feature Specification: Instructor Reviews — Read-Only Feed, Per-Course and Aggregate

**Feature Branch**: `012-instructor-reviews`
**Created**: 2026-09-21
**Status**: Draft
**Input**: User description: "read the planning/instructor-experience-discovery.md, now it's 012's turn.
This spec info: instructor can see avg rating, total reviews, 5-star rate, numbers of reviews this month;
instructor can see a list of reviews that have [student name and pfp, course title, rating, comment, last
update date]; instructor can filter this list by the stars [5, 4] only. This feature will be implemented for
both: per-course, and aggregate for all courses, the same as students, analytics pages. UI/UX frames:
https://claude.ai/code/artifact/46addddf-c7d7-47b8-a58c-6dc7d9fa8cc5"

## Overview

Students have been able to review courses since spec 001, and those reviews already drive a course's public
rating. The instructor who wrote the course, however, has never been able to read them from their own
workspace: the sidebar **Reviews** item and the course workspace **Reviews** tab both lead to a "coming soon"
placeholder. This is discovery US-11 and capability C9 — the last piece of the instructor's feedback loop.

This feature fills both placeholders with the **same read-only feed** in two scopes:

- **Per course** — the Reviews tab of the course workspace, for one course.
- **Across all courses** — the Reviews page in the instructor sidebar, for every course the instructor owns.

Each scope shows:

1. **A rating summary** of four figures — **average rating**, **total reviews**, **5-star rate**, and
   **reviews this month**.
2. **A list of reviews**, each showing the **student's name and profile picture**, the **course title**, the
   **star rating**, the **comment**, and the **date it was last updated**.
3. **A star filter** offering **All ratings**, **5 stars**, and **4 stars** — the only three choices.

Everything here is **read-only and derived from reviews the platform already holds**. This feature stores
nothing, changes nothing, and deliberately adds no way for an instructor to reply to, hide, report, or delete
a review.

## Clarifications

### Session 2026-09-21

- Q: What does "reviews this month" count? → A: **Reviews created since the start of the current calendar
  month, in UTC.** It is a month-to-date figure that resets at the first instant of each month, not a rolling
  30-day window. A review written in a previous month and edited this month does **not** count.
- Q: Does the star filter change the four summary figures? → A: **No.** The summary always describes every
  review in the scope; the filter only narrows the list beneath it. This keeps the instructor's reputation
  figures stable while they read through one rating band, and makes "68% 5-star" mean the same thing before
  and after the filter is used.
- Q: Do reviews on unpublished courses appear? → A: **Yes.** The scope is every course the instructor
  **owns**, published or not. A course can be unpublished after it has been reviewed, and hiding those
  reviews would make the instructor's totals disagree with the reviews they can reach per course. This is
  deliberately broader than the existing public instructor-rating figure, which counts published courses only.
- Q: Which date is shown, and what orders the list? → A: **The date the review was last updated**, and the
  list is ordered by that same date, most recently updated first. A student who edits an old review moves it
  to the top, so the shown date always explains the position.
- Q: How are summaries over very few reviews handled? → A: **No minimum sample.** A single 5-star review
  reads "5.0", "1", "100%"; nothing is hidden, warned about, or re-ranked for small samples. A scope with no
  reviews at all is a distinct state, not a set of zeroes.
- Q: Which ratings can be filtered? → A: **5 and 4 only**, plus "All ratings". Ratings of 3, 2, and 1 are
  reachable only through "All ratings" in this version. Filtering is single-select.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the reviews on one course (Priority: P1)

An instructor opens a course's workspace and selects the Reviews tab. Four tiles give them the course's
average rating, how many reviews it has, what share of them are 5-star, and how many arrived this month.
Beneath the tiles, every review is listed with the student who wrote it, their picture, the course, the stars
they gave, what they wrote, and when they last changed it.

**Why this priority**: This is the feature at its smallest useful size and discovery US-11 exactly. A single
course is the unit an instructor improves, so per-course feedback is worth shipping even if the aggregate page
never does. It also replaces a visible placeholder in a tab bar the instructor already uses.

**Independent Test**: For one course with a known set of reviews — different ratings, a review with no
comment, a student with no profile picture, and reviews written in different months — open its Reviews tab and
confirm each tile and each row matches the underlying data under FR-006 – FR-020.

**Acceptance Scenarios**:

1. **Given** a course the instructor owns, **When** they open its Reviews tab, **Then** they see the four
   summary tiles, the review list, and the star filter set to "All ratings", with the Reviews tab marked
   active inside the course workspace.
2. **Given** a course with reviews rated 5, 5, 4, and 2, **When** the Reviews tab loads, **Then** the average
   rating reads 4.0, the total reads 4, and the 5-star rate reads 50%.
3. **Given** a course with 7 reviews of which 3 were created since the start of the current month, **When**
   the tab loads, **Then** "this month" reads 3.
4. **Given** a review written last month and edited today, **When** the tab loads, **Then** it is **not**
   counted in "this month" but it **is** shown first in the list, dated today.
5. **Given** a review whose student left no comment, **When** the tab loads, **Then** its row shows the
   student, the course, the stars, and the date, with a clear indication that no comment was written, and not
   an empty gap.
6. **Given** a student with no profile picture, **When** the tab loads, **Then** their row shows a neutral
   placeholder and their name in full.
7. **Given** a course the instructor owns that has never been reviewed, **When** the tab loads, **Then** it
   shows a "no reviews yet" state rather than tiles reading 0.0 and 0%.
8. **Given** a course with more reviews than fit one page, **When** the tab loads, **Then** the first page is
   shown with paging controls stating the position within the full total.

---

### User Story 2 - Filter the list by star rating (Priority: P1)

The instructor narrows the list to 5-star reviews, then to 4-star reviews, then back to all of them. The list
changes each time; the four summary figures do not.

**Why this priority**: The user description names the filter as part of the feature, and it is what turns a
long feed into something an instructor can act on — reading the 4-star reviews is how they find out what
stopped a course being perfect. It is meaningless without User Story 1 but adds little weight to it.

**Independent Test**: For a course with reviews at every rating, select each filter option in turn and confirm
the list content, the summary's independence from it, paging behaviour, and the address, under FR-021 – FR-027.

**Acceptance Scenarios**:

1. **Given** a course with reviews rated 5, 5, 4, 3, and 1, **When** the instructor selects "5 stars",
   **Then** only the two 5-star reviews are listed, and the four summary tiles still describe all five reviews.
2. **Given** the "5 stars" filter is active, **When** the instructor selects "4 stars", **Then** only the
   4-star review is listed.
3. **Given** a filter is active, **When** the instructor selects "All ratings", **Then** every review in the
   scope is listed again.
4. **Given** the instructor is on the third page of the unfiltered list, **When** they select "5 stars",
   **Then** the list returns to its first page and the paging position describes the filtered reviews only.
5. **Given** a course whose reviews are all 5-star, **When** the instructor selects "4 stars", **Then** a
   distinct "no reviews match this filter" state is shown with a way to clear the filter, different from the
   "no reviews yet" state of Scenario 7 in User Story 1.
6. **Given** a filter and a page are selected, **When** the instructor refreshes, navigates Back, or opens the
   same link again, **Then** the same filter and page are restored.
7. **Given** any filter is active, **When** the instructor looks at the controls, **Then** exactly one of
   "All ratings", "5 stars", and "4 stars" is shown as selected, and no other rating is offered.

---

### User Story 3 - Read reviews across all courses (Priority: P2)

The instructor selects **Reviews** in the sidebar and sees the same summary and the same feed, covering every
course they own. Each row names the course it belongs to, so a single list answers "what are people saying
about me?"

**Why this priority**: The user description asks for both scopes, mirroring the analytics and students pages,
and the sidebar Reviews item currently leads to a placeholder. It is a reading convenience over the per-course
tab rather than a different capability, so it can ship after User Stories 1 and 2 without changing them.

**Independent Test**: For an instructor owning several courses — including one that is unpublished but has
reviews, and one with no reviews at all — open the sidebar Reviews page and confirm the summary covers every
course, the rows name their course, the ordering interleaves courses correctly, and the empty states are right,
under FR-028 – FR-032.

**Acceptance Scenarios**:

1. **Given** an instructor owning three reviewed courses, **When** they open the sidebar Reviews page,
   **Then** reviews from all three are listed together and each row names its course, with the Reviews
   navigation item marked active.
2. **Given** an instructor whose courses hold 10 reviews averaging 4.3 in total, **When** the page loads,
   **Then** the tiles describe all 10 reviews across all courses, not any one course.
3. **Given** reviews on different courses with known last-updated dates, **When** the page loads, **Then** the
   most recently updated review appears first regardless of which course it belongs to.
4. **Given** an unpublished course that was reviewed before it was unpublished, **When** the page loads,
   **Then** its reviews are included in the list and in the tiles.
5. **Given** the star filter is used on this page, **When** the results load, **Then** it filters reviews from
   every owned course under the same rules as User Story 2.
6. **Given** an instructor who owns courses but none has been reviewed, **When** the page loads, **Then** it
   shows a "no reviews yet" state.
7. **Given** an instructor who owns no courses at all, **When** the page loads, **Then** it shows a state that
   points them at creating a course, rather than an empty feed.

---

### User Story 4 - Nobody reads another instructor's reviews (Priority: P1)

Only the owning instructor can read a course's reviews through this feature. Another instructor, a student, or
a signed-out visitor is refused, whether they use the interface or address a course directly.

**Why this priority**: Discovery §15.4 names reading another instructor's data as the biggest risk in the
instructor read surface, and every new read endpoint has to carry the same ownership filter. The reviews
themselves are public on the course page, but this feed joins them to a named student and to an instructor's
private totals, including reviews on unpublished courses.

**Independent Test**: Request each scope as its owner, as a different instructor, as a student, and while
signed out, directly and without the interface, and confirm only the owner is served and that the refusals are
indistinguishable, under FR-033 – FR-038.

**Acceptance Scenarios**:

1. **Given** a course owned by another instructor, **When** an instructor requests its reviews directly,
   **Then** the request is refused and no review, student name, picture, or summary figure is returned.
2. **Given** a course that does not exist and a course owned by someone else, **When** each is requested,
   **Then** the two refusals are indistinguishable, so the feed cannot be used to discover which courses exist.
3. **Given** a signed-in student, **When** they request either scope, **Then** the request is refused.
4. **Given** a signed-out visitor, **When** they open either address, **Then** they are sent to sign in and no
   review data is returned.
5. **Given** an instructor whose own courses are reviewed, **When** the sidebar Reviews page loads, **Then** it
   contains reviews of their own courses only, and never a review they themselves wrote as a student on
   somebody else's course.
6. **Given** a staff account with no instructor profile, **When** it requests either scope, **Then** it is
   refused cleanly with a meaningful message rather than an unhandled error.

---

### Edge Cases

- **A review with no comment.** The comment is optional for students. The row shows the rating, student,
  course, and date with an explicit "no comment" indication, never a blank block that reads as a loading
  failure.
- **A course with exactly one review.** The tiles read that review's rating, "1", and either 100% or 0%
  5-star. No small-sample hiding or warning.
- **An instructor with courses but no reviews.** Distinct from an instructor with no courses: the first says
  reviews will appear here, the second points at creating a course. Neither shows 0.0 / 0%.
- **The filter matches nothing.** Distinct from "no reviews yet", names the filter that is active, and offers
  a way to clear it.
- **A review is edited while the feed is open.** The feed is a snapshot taken when each page loads; the edit
  appears on the next load, page change, or filter change, and moves the review to the top of the list.
- **A review is deleted while the feed is open** (by its student, or by an admin). It disappears on the next
  load; no stale row survives a refresh, and the totals move with it.
- **A student deletes their account.** Their reviews disappear with them; no row shows a missing or blank
  student.
- **The month rolls over while the page is open.** "This month" is computed when the page loads, so it drops
  to the new month's count on the next load rather than changing under the instructor.
- **A very long comment, or one in a non-Latin script.** Shown in full or truncated visibly without breaking
  the row or pushing the layout sideways.
- **A student with no first or last name set.** The row falls back to their username; it never shows a blank
  name.
- **A profile picture that fails to load or has been removed.** The row falls back to the placeholder rather
  than a broken image.
- **An average that rounds.** Shown to one decimal place; an average of exactly 4.0 reads "4.0", not "4".
- **An instructor with thousands of reviews across dozens of courses.** The totals and paging stay correct and
  responsive; no view loads the whole feed at once.
- **The last review on the last page disappears while it is open.** Moving or refreshing lands on a valid page
  rather than an empty one presented as an error.
- **A very narrow screen.** Every field of a review row stays reachable without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

#### Pages & layout

- **FR-001**: The course workspace's **Reviews** tab MUST show the reviews of that single course, inside the
  existing workspace with its tab bar and breadcrumb, the Reviews tab marked active, replacing today's
  placeholder.
- **FR-002**: The instructor sidebar's **Reviews** item MUST open a feed covering every course the instructor
  owns, with the Reviews navigation item marked active, replacing today's placeholder.
- **FR-003**: Both views MUST present, in order: a header carrying the view's title and the star filter; the
  four summary tiles; the review list; and the paging controls beneath it.
- **FR-004**: Both views MUST make clear which scope they describe — the course workspace through its existing
  breadcrumb and header, the sidebar page by stating that it covers all of the instructor's courses.
- **FR-005**: Both views MUST remain fully usable down to a 375px-wide viewport, with no horizontal page
  scrolling and no information made unreachable; tiles and rows MAY be restructured at narrow widths as long as
  every figure in FR-006 and every field in FR-014 stays visible.

#### Rating summary

- **FR-006**: Each view MUST show exactly four summary figures, labelled and in this order: **average
  rating**, **total reviews**, **5-star rate**, and **reviews this month**.
- **FR-007**: The summary MUST describe **every review in the view's scope**, and MUST NOT be affected by the
  star filter of FR-021.
- **FR-008**: **Average rating** MUST be the mean of the ratings of every review in the scope, shown to one
  decimal place.
- **FR-009**: **Total reviews** MUST be the number of reviews in the scope.
- **FR-010**: **5-star rate** MUST be the share of the scope's reviews whose rating is 5, shown as a whole
  percentage.
- **FR-011**: **Reviews this month** MUST be the number of reviews in the scope that were **created** since
  the first instant of the current calendar month, interpreted in UTC. A review created earlier and edited
  this month MUST NOT be counted.
- **FR-012**: When a scope contains no reviews, the summary MUST show a neutral indication rather than "0.0"
  and "0%", so that "no reviews yet" is never mistaken for "rated zero".
- **FR-013**: Summary figures MUST be computed from the reviews themselves at the time the view loads. They
  MUST agree with the total shown by the paging controls for the unfiltered list.

#### Review list content

- **FR-014**: Each review row MUST show the student's **profile picture**, the student's **name**, the
  **course title**, the **star rating**, the **comment**, and the **date the review was last updated**.
- **FR-015**: A student's **name** MUST be their first and last name together; when neither is set, their
  username MUST be shown instead. A row MUST never show a blank name.
- **FR-016**: A student's **profile picture** MUST be shown when they have one, and a neutral placeholder MUST
  be shown when they do not or when the picture cannot be loaded.
- **FR-017**: The **star rating** MUST be shown as stars out of five as well as being machine-readable as a
  number, so it is legible to assistive technology and not by shape alone.
- **FR-018**: When a review has **no comment**, the row MUST show an explicit indication that none was written,
  rather than empty space.
- **FR-019**: The **date** MUST be the moment the review was last updated, shown as a date (no time),
  interpreted in UTC so that every viewer of the same feed sees the same date.
- **FR-020**: Rows MUST be ordered by **last-updated date, most recent first**, with a deterministic tie-break
  so that the same feed paged twice returns the same reviews in the same order.

#### Star filter

- **FR-021**: Both views MUST offer a star filter with exactly three options — **All ratings**, **5 stars**,
  and **4 stars** — of which exactly one is selected at a time.
- **FR-022**: The filter MUST default to **All ratings** when a view is opened from the sidebar or from the
  course workspace tab bar.
- **FR-023**: Selecting **5 stars** or **4 stars** MUST restrict the list to reviews with exactly that rating;
  selecting **All ratings** MUST restore every review in the scope.
- **FR-024**: The filter MUST apply to the **whole** scope (the course, or all owned courses), not only to the
  rows currently displayed.
- **FR-025**: Changing the filter MUST return the list to its first page, and the paging position MUST describe
  the **filtered** reviews.
- **FR-026**: A filter that matches no review MUST show a distinct "no reviews match this filter" state naming
  the active filter and offering a way to clear it, visibly different from the "no reviews yet" state of
  FR-042.
- **FR-027**: The active filter MUST be part of the view's address, so refreshing, navigating Back/Forward, or
  opening a shared link restores it, without a full page reload when it changes. A filter value in the address
  that is missing or unrecognised MUST fall back to **All ratings** without showing an error.

#### Paging

- **FR-028**: Both views MUST return a fixed number of reviews per page, selected on the server; a view MUST
  never load the whole feed in order to display one page.
- **FR-029**: The paging controls MUST state the position within the full result (for example "21–40 of 213")
  and MUST make the previous control unavailable on the first page and the next control unavailable on the
  last.
- **FR-030**: The current page MUST be part of the view's address, so refreshing, navigating Back/Forward, or
  opening a shared link restores the same page, without a full page reload when it changes.
- **FR-031**: A page number in the address that is missing, unrecognised, or beyond the last page MUST fall
  back to the first page without showing an error.
- **FR-032**: Paging MUST apply to the current filter when one is active, and consecutive pages MUST neither
  repeat nor skip a review for an unchanged feed.

#### Across all courses

- **FR-033**: The cross-course view MUST cover the reviews of **every course the instructor owns**, including
  unpublished ones, and MUST NOT include a review of any course they do not own.
- **FR-034**: The cross-course view MUST follow the same summary, content, ordering, filtering, and paging
  rules as the per-course view (FR-006 – FR-032), computing the summary and ordering across all owned courses
  together.
- **FR-035**: The cross-course view MUST distinguish an instructor who owns **no courses** (a state pointing
  them at creating one) from an instructor whose courses simply have **no reviews yet**.

#### Access & privacy

- **FR-036**: Every request for either scope MUST require an authenticated instructor; students and signed-out
  visitors MUST be refused, and signed-out visitors MUST be sent to sign in.
- **FR-037**: Ownership MUST be enforced on the server for every request. A feed and its summary MUST be
  derived only from courses whose owner is the requesting instructor; a course identity supplied by the client
  MUST never be trusted without that check.
- **FR-038**: A request for the reviews of a course the instructor does not own MUST be refused in a way that
  is indistinguishable from a request for a course that does not exist.
- **FR-039**: A review row MUST expose **only** the fields in FR-014. It MUST NOT expose the student's email
  address or any other contact detail, their payment, order or refund information, their progress, or their
  quiz answers or scores.
- **FR-040**: A caller who passes the instructor gate but has no instructor profile MUST receive a meaningful
  refusal rather than an unhandled error.
- **FR-041**: Both views MUST be **read-only**. No control on them may create, edit, hide, report, respond to,
  or delete a review, and this feature MUST NOT add any way to contact the student who wrote one.

#### States

- **FR-042**: A scope with no reviews MUST show a "no reviews yet" state explaining that student reviews will
  appear there, rather than an empty list under zeroed tiles.
- **FR-043**: While a feed, a filter change, or a page change is loading, the view MUST show a placeholder that
  preserves the layout, and MUST NOT show rows or figures from the previous course, filter, or page as if they
  were the new result.
- **FR-044**: When a feed fails to load, the view MUST show a plain message with a way to retry, MUST NOT show
  a raw technical error, and MUST leave the filter and paging controls in a state the instructor can recover
  from.

### Key Entities *(include if feature involves data)*

- **Review entry (computed view of an existing review, not persisted)**: One student's review as an instructor
  reads it — the student's display name and profile picture (or its absence), the course title, the rating,
  the comment (or its absence), and the date it was last updated.
- **Rating summary (computed)**: The four figures describing a scope — average rating, total reviews, 5-star
  rate, and reviews created in the current calendar month. Derived on read; never stored.
- **Feed page (computed)**: One page of review entries for a scope (a course, or all of an instructor's
  courses) and a selected star filter, together with the total number of reviews matching that scope and
  filter, and the position of the page within it.
- **Star filter (value)**: One of "all ratings", "5", or "4"; "all ratings" means the whole scope.
- **Review (existing, referenced)**: Student, course, rating, comment, creation date, last-updated date.
- **Course (existing, referenced)**: Ownership, title, and publication state.
- **Student account (existing, referenced)**: First name, last name, username, profile picture.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can find and read the most recent 4-star review of one of their courses within 20
  seconds of opening the sidebar Reviews page, for an instructor with 10 courses and 500 reviews.
- **SC-002**: Every summary figure matches the underlying reviews under FR-008 – FR-013 in 100% of
  verification cases, including scopes with one review, scopes spanning a month boundary, scopes containing a
  review edited this month but created earlier, and scopes containing an unpublished course.
- **SC-003**: Every row's name, picture, course, rating, comment, and date matches the underlying review under
  FR-014 – FR-020 in 100% of verification cases, including reviews with no comment, students with no name set,
  and students with no profile picture.
- **SC-004**: Selecting a star filter changes the four summary figures 0 times, and returns reviews of any
  other rating 0 times.
- **SC-005**: Paging through a full feed twice returns every review exactly once each time, with 0 duplicates
  and 0 omissions, for an unchanged feed, both unfiltered and under each star filter.
- **SC-006**: 100% of requests return only reviews of the caller's own courses, and 100% of requests for
  another instructor's course, or from a student or signed-out visitor, are refused — verified independently of
  the interface. Another instructor's reviews appear 0 times.
- **SC-007**: A feed exposes a student's email address, contact details, payment information, progress, or
  quiz records 0 times.
- **SC-008**: A view shows "0.0" or "0%" for a scope with no reviews 0 times, shows a blank student name 0
  times, and shows an empty comment area with no explanation 0 times.
- **SC-009**: Refreshing, navigating Back, or reopening a shared link restores the same filter and page in 100%
  of cases; an unrecognised filter or page in the address produces an error 0 times.
- **SC-010**: Both views load a page of the feed within the same responsiveness budget as the rest of the
  instructor shell, for a course with 5,000 reviews and for an instructor with 50 courses and 20,000 reviews,
  with or without a filter.
- **SC-011**: Both views render without horizontal scrolling or clipped content at a 375px-wide viewport, and
  every figure in FR-006 and field in FR-014 remains readable there.
- **SC-012**: After a filter or page change, the view shows rows or figures from the previous filter or page
  presented as the new result 0 times.

## Assumptions

- **The wireframe is the structural reference.** Layout follows the "Reviews (read-only)" screen — a header
  carrying the title, the "Read-only · across all your courses" subtitle and the filter chips; a row of four
  tiles (Avg rating / Total reviews / 5-star / This month); and review cards each carrying an avatar, the
  student's name, the stars, the course title and date on the right, and the comment beneath. Visual styling
  follows the existing design tokens, not the wireframe's greyscale.
- **Both scopes are in scope.** The user description asks for per-course and aggregate explicitly, mirroring
  specs 009 and 010; the discovery page inventory (§9) lists both a per-course Reviews tab and a sidebar All
  Reviews page, and the course workspace tab bar already links to the former. The cross-course view is User
  Story 3 at P2 so it can be deferred without touching Stories 1, 2, and 4.
- **The course title appears in both scopes.** The user description lists it as a row field, and keeping it in
  the per-course view means one row presentation serves both scopes. It is redundant with the course workspace
  header there, and that redundancy is accepted.
- **The wireframe's "Course ▾" filter is not part of this version.** The user description names the star filter
  only. Narrowing the cross-course feed to one course is already served by that course's Reviews tab.
- **Ratings of 3, 2 and 1 have no filter chip.** They are read through "All ratings". This follows the user
  description literally; a fuller rating filter is a later change.
- **The summary is broader than the public instructor rating.** The existing published-courses-only instructor
  rating figure (used elsewhere in the product) is deliberately not reused here, because this feed covers
  unpublished courses too. The two figures may therefore differ for an instructor with an unpublished reviewed
  course, and that is expected.
- **Review eligibility is unchanged.** Students still review only courses they have completed, one review per
  course, and an instructor still cannot review their own course. This feature reads what that process
  produces and changes none of it.
- **No new review data is stored.** Both the summary and the feed are derived on read from existing reviews,
  in line with discovery §13.7 (synchronous computation is acceptable at current scale). No caching or
  denormalisation is assumed.
- **Existing platform conventions carry over.** Ownership-scoped reads, page-number paging, direct payloads
  with no envelope, the instructor shell and its sidebar, the existing star-rating display component, and the
  existing profile-picture placeholder are all reused as they stand.
- **UTC everywhere.** The current month, and every date shown, are UTC, so two instructors in different time
  zones reading the same feed see the same figures and the same dates — consistent with spec 009.

## Out of Scope

- **Replying to reviews.** The dashboard's "needs attention" list mentions an unanswered-review badge; no reply
  capability exists and none is added here. The feed is read-only.
- **Hiding, reporting, or deleting a review.** Removal stays an administrator-only capability, unchanged.
- **Contacting the student who wrote a review.** There is no messaging subsystem and this feature does not
  introduce one.
- **Filtering by course, by date, or by free text**, and sorting by anything other than last-updated date.
- **A rating distribution chart** (how many reviews at each of the five ratings). The 5-star rate is the only
  distribution figure in this version.
- **Trends over time** (reviews or average rating per period). "This month" is a single month-to-date count,
  not a series, and period selection stays with the analytics pages of spec 009.
- **Notifying an instructor when a new review arrives.**
- **Changing anything a student sees** — review submission, editing, eligibility, and the public course page
  are untouched.
