# Feature Specification: Instructor Dashboard — At-a-Glance Summary Landing

**Feature Branch**: `008-instructor-dashboard`
**Created**: 2026-09-15
**Status**: Draft
**Input**: User description: "read the planning/instructor-experience-discovery.md — we've done with 007, now
008's turn. For UI/UX here is the wireframe: https://claude.ai/code/artifact/46addddf-c7d7-47b8-a58c-6dc7d9fa8cc5"

## Overview

Specs 003–007 delivered the complete authoring side of the instructor experience: an instructor can create a
course, structure it, upload its videos, and publish it. But the place an instructor lands every time they
sign in — the instructor home — is still the static "getting started" placeholder that spec 003 put there
(003 FR-013). It shows the same four generic steps to a brand-new instructor and to one with six live
courses and a thousand students. It knows nothing about the instructor's business.

This feature replaces that placeholder with a real **dashboard**: the answer to "how are my courses doing,
and is there anything I need to deal with?" in a single glance, the moment the instructor signs in.

Concretely, this feature makes four things true for an instructor:

1. **They see their business in four numbers** — how many courses they have, how many students they teach,
   their average rating, and what they have earned — without opening a single course.
2. **They see what just happened** — the most recent students to enroll and the most recent reviews left,
   across all their courses, side by side.
3. **They are told what needs them** — live courses that have stopped meeting the publish bar, videos that
   failed to process, and drafts waiting to be finished or published, each linking to the exact place to act.
4. **A new instructor is guided, not shown a wall of zeros** — until they create their first course, the
   home is an onboarding checklist that lays out the path from profile to first published course.

Everything on the dashboard is **read-only and derived from data the platform already holds** — courses and
their readiness (007), enrollments, orders, and reviews. This feature introduces no new way to change
anything; every action it offers is a link into a surface an earlier spec already built.

## Clarifications

### Session 2026-09-15

- Q: What is on the dashboard, and in what arrangement? → A: As the wireframe lays out: a greeting header
  with a primary **Create course** action; a row of **four summary tiles** (Courses, Students, Avg rating,
  Earnings); **Recent enrollments** and **Recent reviews** side by side; then a **Needs attention** list.
  On narrow viewports these stack to a single column in that same order.
- Q: The wireframe shows "Unanswered review" as a needs-attention item. Is that in scope? → A: **No.**
  Reviews are read-only for instructors across the whole instructor experience (discovery §5.3, US-11) —
  there is no way to answer a review, so there is no such thing as an unanswered one. Flagging it would
  create a to-do the instructor cannot complete. Needs attention is limited to things the instructor can
  actually act on.
- Q: Are the tiles lifetime totals or for a period? → A: **Lifetime (all-time) totals.** The wireframe has
  no period selector on the dashboard; period-based trends belong to analytics (spec 009) and earnings
  (spec 013). Recent lists are simply "most recent first", not bounded by a period.
- Q: Does "Students" mean enrollments or people? → A: **Distinct people.** A student enrolled in three of the
  instructor's courses counts once. Only currently active enrollments count, so a refunded student is not
  counted. The tile also shows the total active enrollment count as secondary text (see below).
- Q: Which rating does the tile show? → A: The **same instructor rating students see** on the instructor's
  public profile — the average across reviews on the instructor's **published** courses — so the instructor
  never sees one number at home and a different one on their public page. With no reviews it shows
  "Not yet rated", never "0".
- Q: Is the dashboard live-updating? → A: **No.** It reflects current data each time it is opened, and it
  reflects the instructor's own actions elsewhere in the app (publishing, fixing a video) when they return,
  without a manual reload. A new enrollment or review by a student appears on the instructor's next visit or
  refresh; no push or real-time mechanism is introduced.
- Q: What does the Earnings tile mean? → A: **Gross sales net of refunds** — the sum of **paid** orders on
  the instructor's courses; refunded, pending, and failed orders are excluded. No platform revenue share
  exists today, so none is deducted. Spec 013 MUST reuse this definition so the dashboard tile and the
  earnings page never disagree; if a revenue share is introduced later, both change together.
- Q: When does the onboarding checklist give way to the full dashboard? → A: **As soon as the instructor
  owns at least one course.** An instructor with zero courses sees the onboarding checklist; from their first
  course onward they see the full dashboard, where a draft's remaining work is carried by the Needs attention
  list ("draft in progress" with its blocker count). Zero-valued tiles for an instructor with only drafts are
  accepted as truthful. Deleting every course returns the instructor to the onboarding checklist — which is
  still truthful, since deleting a course removes its enrollments, orders, and reviews.
- Q: Does the dashboard load as one consistent snapshot or section by section with independent failures? →
  A: **One snapshot, loaded all at once.** Tiles, recent enrollments, recent reviews, needs attention, and
  onboarding state arrive together and describe the same moment. If the snapshot cannot be loaded, a single
  page-level error with Retry replaces the whole dashboard; there is no per-section partial failure.
- Q: How are courses ordered within the same needs-attention type? → A: **By urgency.** Live course needs
  attention and Video failed: most active students first. Draft in progress: fewest remaining blockers first.
  Ready to publish: newest course first. Every remaining tie: newest course first.
- Q: Does the Students tile show a secondary enrollment count? → A: **Yes.** Distinct students is the primary
  value, with the total number of active enrollments shown beneath it as "N enrollments".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See my business at a glance (Priority: P1)

An established instructor signs in and lands on the dashboard. Four tiles tell them how many courses they
have (and how many are live), how many students they teach, their average rating, and their total earnings.
They understand the state of their business in seconds, without opening any course.

**Why this priority**: This is the core promise of the feature and the reason the instructor home exists.
Discovery US-07 asks for exactly this. It is independently valuable: even with nothing else on the page, an
instructor gains a truthful summary they cannot get anywhere in the app today.

**Independent Test**: As an instructor with a known set of courses, enrollments, reviews, and paid and
refunded orders, open the instructor home and confirm each tile's value matches the underlying data exactly
under the definitions in FR-004 – FR-008.

**Acceptance Scenarios**:

1. **Given** an instructor with published and draft courses, **When** they open the instructor home, **Then**
   the Courses tile shows their total course count and how many of those are published.
2. **Given** an instructor whose courses have active enrollments, including one student enrolled in more
   than one of their courses, **When** the dashboard loads, **Then** the Students tile counts that student
   once in its primary value and counts each of that student's enrollments in its "N enrollments" secondary
   text.
3. **Given** a student whose enrollment was refunded, **When** the dashboard loads, **Then** that student is
   not counted (unless they hold another active enrollment with this instructor) and the refunded payment is
   not counted in Earnings.
4. **Given** an instructor with reviews on published courses, **When** the dashboard loads, **Then** the Avg
   rating tile shows the same rating and review count as the instructor's public profile.
5. **Given** an instructor with courses but no reviews, **When** the dashboard loads, **Then** the Avg rating
   tile shows "Not yet rated" rather than zero.
6. **Given** an instructor whose only enrollments are in free courses, **When** the dashboard loads,
   **Then** those students are counted and Earnings shows zero.
7. **Given** an instructor who just published a course elsewhere in the app, **When** they return to the
   dashboard, **Then** the Courses tile reflects it without a manual reload.

---

### User Story 2 - Know what needs my attention (Priority: P1)

An instructor opens the dashboard and sees a short, prioritised list of things that need them: a live course
that has stopped meeting the publish bar, a lecture whose video failed to process, a draft that is ready to
publish, a draft still in progress. Each item names the course, says what the problem is, and takes them
straight to where they can fix it. When there is nothing to do, the list says so.

**Why this priority**: This is what turns the dashboard from a report into a work surface. Spec 007 explicitly
deferred the cross-course "needs attention" roll-up to this feature, and a live course that has quietly
broken for paying students is the single most costly thing an instructor can miss.

**Independent Test**: Set up one published course that fails a readiness condition, one course with a failed
video, one draft that passes readiness, and one draft that does not. Open the dashboard and confirm each
appears once, in severity order, with the correct label and a link that lands on the right place; fix one and
confirm it disappears on return.

**Acceptance Scenarios**:

1. **Given** a published course that no longer meets the publish readiness bar (spec 007), **When** the
   dashboard loads, **Then** it appears at the top of Needs attention as a live course needing attention,
   linking to that course's workspace where the specific blockers are listed.
2. **Given** a lecture whose video processing failed, **When** the dashboard loads, **Then** its course
   appears flagged for a failed video, linking to that lecture's editor (or to the course workspace when
   more than one video has failed).
3. **Given** a draft course that meets every readiness condition, **When** the dashboard loads, **Then** it
   appears as ready to publish, linking to the course workspace where it can be published.
4. **Given** a draft course that does not meet readiness, **When** the dashboard loads, **Then** it appears
   as a draft in progress with the number of remaining blockers, linking to the course workspace.
5. **Given** a course with several issues at once (e.g. published, failing readiness, with a failed video),
   **When** the dashboard loads, **Then** that course appears **once**, under its most severe issue.
6. **Given** more items than the list shows, **When** the dashboard loads, **Then** the list shows the most
   severe items first, states the total count, and offers a way to see all of the instructor's courses.
7. **Given** an instructor with courses and nothing needing attention, **When** the dashboard loads, **Then**
   the section shows an explicit "all caught up" state rather than disappearing or rendering blank.
8. **Given** an instructor who fixes a flagged item elsewhere in the app, **When** they return to the
   dashboard, **Then** the item is gone without a manual reload.
9. **Given** two live courses needing attention with 800 and 3 active students, and two drafts in progress
   with 1 and 4 blockers, **When** the dashboard loads, **Then** the 800-student course is listed before the
   3-student course, and the 1-blocker draft before the 4-blocker draft.
10. **Given** a lecture whose video is still processing, **When** the dashboard loads, **Then** it is **not**
   flagged — processing is waiting, not a problem.

---

### User Story 3 - See recent enrollments and reviews (Priority: P2)

Below the tiles, the instructor sees who has most recently enrolled in their courses and the most recent
reviews students have left, side by side, newest first. Each enrollment shows the student, the course, and
when; each review shows the rating, an excerpt, the course, and when.

**Why this priority**: Recent activity makes the numbers feel real and surfaces feedback early, but the
instructor still gets the core value from the tiles and the needs-attention list without it. The full
roster (spec 010) and full reviews feed (spec 012) remain the complete views.

**Independent Test**: Create enrollments and reviews on an instructor's courses at known times, open the
dashboard, and confirm each list shows the most recent entries in newest-first order with the correct
student/course/date and rating/excerpt/course/date, and that nothing from another instructor's courses
appears.

**Acceptance Scenarios**:

1. **Given** an instructor with enrollments across several courses, **When** the dashboard loads, **Then**
   Recent enrollments lists up to 5 of the most recent active enrollments, newest first, each showing the
   student's display name and avatar, the course title, and the enrollment date.
2. **Given** an instructor with reviews across several courses, **When** the dashboard loads, **Then** Recent
   reviews lists up to 5 of the most recent reviews, newest first, each showing the star rating, the
   reviewer's display name, a short excerpt of the review text, the course title, and the date.
3. **Given** a long review, **When** it is shown in Recent reviews, **Then** the text is truncated to an
   excerpt and the layout is not broken.
4. **Given** an instructor with courses but no enrollments yet, **When** the dashboard loads, **Then** Recent
   enrollments shows a clear "no enrollments yet" state.
5. **Given** an instructor with no reviews yet, **When** the dashboard loads, **Then** Recent reviews shows a
   clear "no reviews yet" state.
6. **Given** a refunded (inactive) enrollment, **When** the dashboard loads, **Then** it does not appear in
   Recent enrollments.
7. **Given** a recent-activity entry, **When** the instructor selects its course, **Then** they are taken to
   that course's workspace.

---

### User Story 4 - A new instructor is guided to their first published course (Priority: P2)

A brand-new instructor signs in for the first time. Instead of four tiles reading zero, the home shows an
onboarding checklist — complete your instructor profile, create a course, add curriculum, upload a video,
publish — with each step's real state shown, each linking to where it is done, and a single primary action
to create their first course. As soon as they create that first course, the full dashboard takes over and
the Needs attention list carries their draft's remaining work.

**Why this priority**: Discovery §15.2 names the "dead dashboard" of empty states as a real risk for new
instructors. It is P2 because it only matters during an instructor's first days, but for that instructor it
is the entire experience of the home page.

**Independent Test**: Sign in as a newly registered instructor with no courses and confirm the onboarding
variant is shown with no steps ticked. Complete the profile step and confirm it ticks on return to the home.
Then create a course and confirm the full dashboard replaces the checklist, with the new draft listed under
Needs attention; delete that course and confirm the checklist returns.

**Acceptance Scenarios**:

1. **Given** a newly provisioned instructor with no courses, **When** they open the instructor home, **Then**
   they see the onboarding checklist and a primary "Create your first course" action, and no summary tiles
   showing zeros.
2. **Given** the onboarding checklist, **When** it is shown, **Then** it lists the five steps (complete
   instructor profile, create a course, add curriculum, upload a video, publish) and the profile step reflects
   its real state (title and about both set).
3. **Given** an incomplete step, **When** the instructor selects it, **Then** they are taken to the place
   where that step is done (for steps that need a course, the create-course flow).
4. **Given** an instructor who completes their profile elsewhere in the app, **When** they return to the
   home, **Then** that step shows as done without a manual reload.
5. **Given** an instructor who creates their first course, **When** they open the home, **Then** the full
   dashboard is shown instead of the onboarding checklist, and the new draft appears under Needs attention.
6. **Given** an instructor who deletes their only course, **When** they open the home, **Then** the
   onboarding checklist is shown again.

---

### User Story 5 - Nobody sees another instructor's business (Priority: P1)

Every number, list entry, and flag on the dashboard is derived only from the signed-in instructor's own
courses. No other instructor's students, reviews, earnings, or course problems ever appear, and no request
can be crafted to obtain them.

**Why this priority**: The dashboard aggregates exactly the data discovery §15.4 names as most sensitive —
student identities and earnings. A leak here exposes another instructor's revenue and their students'
names. It must ship with the feature.

**Independent Test**: With instructors A and B each owning courses with enrollments, reviews, and paid
orders, sign in as A and confirm no value on the dashboard includes any of B's data; then request the
dashboard data directly as a student, as an unauthenticated caller, and as a staff account without an
instructor profile, and confirm each is refused or handled cleanly — verified against the backend
independently of the frontend.

**Acceptance Scenarios**:

1. **Given** instructors A and B with their own courses and activity, **When** A views the dashboard,
   **Then** every tile, list, and flag reflects only A's courses.
2. **Given** a student account, **When** it requests the instructor dashboard data, **Then** the request is
   refused and nothing is returned.
3. **Given** an unauthenticated caller, **When** it requests the instructor dashboard data, **Then** the
   request is refused.
4. **Given** a staff account with no instructor profile, **When** it opens the instructor home or requests
   its data, **Then** it receives a clear handled state, never an error page or a server error.
5. **Given** the recent enrollments list, **When** it is shown, **Then** it exposes only what identifies the
   student to their instructor (display name and avatar) and never contact details such as email address.

---

### Edge Cases

- **Brand-new instructor (zero courses).** Onboarding variant (US-4), never a row of zero tiles.
- **Instructor with courses but no students, reviews, or earnings.** Full dashboard (the switch-over is
  owning one course) with defined empty states per section: tiles show real zeros where zero is the truth,
  rating shows "Not yet rated", each recent list shows its own empty message.
- **Instructor deletes every course.** Returns to the onboarding variant; no enrollment, order, or review
  data is lost from view, because deleting a course removes it.
- **Courses that are all drafts.** Needs attention lists each draft (ready to publish / in progress); Students
  and Earnings are zero.
- **Previously published, now all unpublished.** Enrolled students still count (their enrollments remain
  active per 007 FR-031), their past payments still count in Earnings, and their reviews still appear in
  Recent reviews. The Avg rating tile shows "Not yet rated" if no published course has reviews, matching the
  public profile.
- **Refunds.** A refunded order is excluded from Earnings, and its now-inactive enrollment is excluded from
  Students and Recent enrollments.
- **Free courses.** Enrollments count toward Students and appear in Recent enrollments; they add nothing to
  Earnings.
- **Pending or failed payments.** Never counted in Earnings and never produce an enrollment entry.
- **A student enrolled in several of the instructor's courses.** Counted once in Students; each enrollment may
  appear separately in Recent enrollments.
- **Deleted course.** Its enrollments, orders, and reviews no longer exist, so they no longer contribute to
  any tile or list. The dashboard never shows a dangling entry for a course that is gone.
- **A student who deleted their account or has no avatar.** The entry falls back to a neutral placeholder
  name/avatar rather than breaking the list.
- **Review with empty text.** Shown with its rating and no excerpt, not with a blank or broken block.
- **Large instructor.** An instructor with many courses, thousands of students, and many reviews MUST see the
  dashboard within the same responsiveness budget as the rest of the instructor shell.
- **Dashboard data unavailable.** The page MUST show a single page-level error with Retry in place of the
  whole dashboard, and MUST NOT show zeros, "Not yet rated", or "all caught up" in place of data it failed to
  load — a false "no problems" is worse than an error.
- **Any part of the snapshot fails.** The snapshot is all-or-nothing: if any part of it (including a course's
  readiness verdict) cannot be produced, the whole snapshot fails and the page-level error is shown. The
  dashboard never renders a partial snapshot in which a course silently looks healthy because its readiness
  could not be evaluated.
- **Staff account without an instructor profile.** Handled state consistent with 003–007.
- **Very long course titles or names.** Truncated gracefully; layout never breaks at any viewport width.

## Requirements *(mandatory)*

### Functional Requirements

#### Page & layout

- **FR-001**: The instructor home MUST replace the spec 003 placeholder with the dashboard defined here,
  inside the existing instructor shell with the Dashboard navigation item marked active.
- **FR-002**: The full dashboard MUST present, in order: a greeting header addressing the instructor by name
  with a primary **Create course** action; a row of four summary tiles (Courses, Students, Avg rating,
  Earnings); **Recent enrollments** and **Recent reviews** side by side; and a **Needs attention** list.
- **FR-003**: On narrow viewports the dashboard MUST reflow to a single column preserving that order, with no
  horizontal scrolling and no clipped content.

#### Summary tiles

- **FR-004**: The **Courses** tile MUST show the total number of courses the instructor owns and how many of
  them are currently published.
- **FR-005**: The **Students** tile MUST show the number of distinct students holding at least one active
  enrollment in any of the instructor's courses. A student enrolled in several of the instructor's courses
  MUST be counted once; inactive (e.g. refunded) enrollments MUST NOT be counted. Beneath that primary value
  the tile MUST show the total number of active enrollments across the instructor's courses as secondary
  text ("N enrollments"), where each enrollment counts separately.
- **FR-006**: The **Avg rating** tile MUST show the instructor's rating and review count exactly as computed
  for their public instructor profile (reviews on published courses), and MUST show "Not yet rated" when
  there are none.
- **FR-007**: The **Earnings** tile MUST show the instructor's lifetime gross sales in the platform
  currency: the sum of **paid** orders on the instructor's courses. Refunded, pending, and failed orders MUST
  NOT be counted, and no platform share is deducted. Spec 013 MUST use the same definition.
- **FR-008**: All tile values MUST be lifetime totals derived from current data; the dashboard MUST NOT
  introduce a period selector.

#### Recent activity

- **FR-009**: **Recent enrollments** MUST list up to 5 of the most recent active enrollments across the
  instructor's courses, newest first, each with the student's display name and avatar, the course title, and
  the enrollment date.
- **FR-010**: **Recent reviews** MUST list up to 5 of the most recent reviews across the instructor's courses,
  newest first, each with the star rating, the reviewer's display name, a truncated excerpt of the text, the
  course title, and the date.
- **FR-011**: Recent-activity entries MUST link to the corresponding course's workspace. Recent reviews are
  read-only; the dashboard MUST NOT offer any action on a review.
- **FR-012**: Recent enrollments MUST NOT expose student contact details (such as email address).

#### Needs attention

- **FR-013**: **Needs attention** MUST list the instructor's courses that require action, each appearing
  **at most once** under its most severe issue, in this severity order:
  1. **Live course needs attention** — published but failing the spec 007 readiness bar;
  2. **Video failed** — at least one lecture whose video processing failed;
  3. **Ready to publish** — a draft that passes the readiness bar;
  4. **Draft in progress** — a draft that does not yet pass, with its number of remaining blockers.
- **FR-014**: Readiness in FR-013 MUST be the spec 007 readiness verdict, evaluated on current content; the
  dashboard MUST NOT define its own readiness rules or store a flag that can drift.
- **FR-015**: Each item MUST name the course, state its issue, and link directly to where the instructor can
  act: the course workspace for live-course, ready-to-publish, and draft items; the specific lecture editor
  for a single failed video (the course workspace when more than one video has failed).
- **FR-016**: A lecture whose video is still processing MUST NOT be flagged. Only failed videos are flagged.
- **FR-017**: The list MUST show at most 5 items, most severe first, MUST state the total number of items
  when more exist, and MUST offer a link to the instructor's full course list.
- **FR-017a**: Within the same type, items MUST be ordered by urgency: **Live course needs attention** and
  **Video failed** by number of active students, most first; **Draft in progress** by number of remaining
  blockers, fewest first; **Ready to publish** by course creation date, newest first. Any remaining tie MUST
  be broken by course creation date, newest first. The ordering MUST be deterministic, so the same data always
  yields the same 5 items.
- **FR-018**: When nothing needs attention, the section MUST show an explicit "all caught up" state.
- **FR-019**: Needs attention MUST NOT include review-related items; reviews are read-only and offer the
  instructor nothing to act on.

#### Onboarding variant

- **FR-020**: An instructor who owns no courses MUST see an onboarding checklist in place of the summary
  tiles, recent activity, and needs-attention sections, with a primary "Create your first course" action.
- **FR-021**: The checklist MUST contain these steps, each showing its **real, derived** completion state and
  linking to where it is done: (1) complete instructor profile — title and about both set; (2) create a
  course; (3) add curriculum; (4) upload a video; (5) publish a course. Because the checklist is only shown to
  an instructor with no courses, steps 2–5 link to the create-course flow.
- **FR-022**: The dashboard MUST show the full dashboard as soon as the instructor owns at least one course
  (draft or published), and MUST show the onboarding checklist again if they come to own none.
- **FR-023**: Checklist step states MUST be computed from current data and MUST NOT be stored or manually
  dismissible in a way that can drift from reality.
- **FR-024**: Where a step's destination is delivered by a later spec (e.g. instructor profile editing,
  spec 011), the step MUST still link to its planned destination, which renders the shell's existing
  placeholder until that spec lands.

#### Freshness, states & resilience

- **FR-025**: The dashboard MUST reflect current data each time it is opened and MUST reflect the
  instructor's own changes made elsewhere in the app (creating, publishing, unpublishing, deleting a course;
  a video becoming ready or failing) on return, without a manual page reload.
- **FR-026**: The dashboard MUST load as a **single consistent snapshot**: tiles, recent enrollments, recent
  reviews, needs attention, and onboarding state MUST all be produced together and describe the same moment.
  The dashboard MUST have one defined loading state for the whole page (a layout-matching skeleton), and
  every section MUST have a defined empty state. Loading MUST NOT flash zeros or empty messages before real
  data arrives.
- **FR-027**: When the snapshot cannot be loaded, the dashboard MUST replace the whole page body with a single
  page-level error and a Retry action, and MUST NOT display zeros, "Not yet rated", empty lists, or "all
  caught up" in place of data it failed to load.
- **FR-028**: The snapshot MUST be all-or-nothing. If any part of it — including the readiness verdict of any
  course — cannot be produced, the snapshot MUST fail as a whole rather than render partially.
- **FR-029**: Dashboard failures MUST surface as clear, non-technical messages and MUST NOT return raw errors
  or stack traces to the client.

#### Access & integrity

- **FR-030**: Every value, list entry, and flag MUST be derived only from courses owned by the signed-in
  instructor. Ownership MUST be enforced server-side; the route guard is defense in depth only.
- **FR-031**: Requests for dashboard data from students, unauthenticated callers, or any non-instructor MUST
  be refused with nothing returned.
- **FR-032**: A caller without an instructor profile MUST receive a clear handled state on the instructor
  home and on every dashboard data path, never an error.

#### Scope boundaries

- **FR-033**: The dashboard MUST be read-only. It MUST NOT create, edit, publish, unpublish, or delete
  anything itself; every action it offers MUST be a link into a surface delivered by an earlier spec.
- **FR-034**: This feature MUST NOT introduce charts, trends, period comparisons, or per-course analytics
  (spec 009), a full student roster (spec 010), a full reviews feed (spec 012), or an earnings breakdown
  (spec 013).
- **FR-035**: This feature MUST NOT change the student experience or any existing instructor surface other
  than the instructor home.
- **FR-036**: New dashboard surfaces MUST reuse the project's existing design tokens and component library
  and MUST be visually consistent with the surrounding instructor shell, following the wireframe's structure.

### Key Entities *(include if feature involves data)*

- **Dashboard summary (computed, not persisted)**: The derived snapshot for one instructor — course counts
  (total, published), distinct active students, public instructor rating and review count, lifetime
  earnings, recent enrollments, recent reviews, needs-attention items, and onboarding step states. Always
  derived from current data; never stored.
- **Needs-attention item (computed)**: One course that requires action — its identity and title, its most
  severe issue (live needs attention / video failed / ready to publish / draft in progress), supporting
  detail (e.g. number of blockers, the failed lecture), and where to act.
- **Onboarding progress (computed)**: The five step states in FR-021, derived from the instructor's profile
  and course ownership; shown only while the instructor owns no courses.
- **Course (existing, referenced)**: Ownership, title, publish status, and — via spec 007 — its readiness
  verdict.
- **Lecture (existing, referenced)**: Its video state (spec 006); failed is flagged, processing is not.
- **Enrollment (existing, referenced)**: Student, course, active status, and enrollment date — source of
  Students and Recent enrollments.
- **Order (existing, referenced)**: Course, status, amount — source of Earnings.
- **Review (existing, referenced)**: Course, reviewer, rating, text, date — source of Recent reviews and,
  via the existing instructor rating, the Avg rating tile.
- **Instructor profile (existing, referenced)**: Ownership anchor, and its title/about drive onboarding
  step 1.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can state their course count, student count, average rating, and earnings within
  5 seconds of landing on the instructor home, without navigating anywhere.
- **SC-002**: Every tile value matches the underlying data under the FR-004 – FR-008 definitions in 100% of
  verification cases, including multi-course students, refunds, free courses, and unpublished courses.
- **SC-003**: The Avg rating tile differs from the instructor's public profile rating 0 times.
- **SC-004**: 100% of published courses failing the readiness bar and 100% of courses with a failed video
  appear in Needs attention; healthy published courses and processing-only videos appear there 0 times.
- **SC-005**: From any needs-attention item, the instructor reaches the place to act in exactly one click in
  100% of cases.
- **SC-006**: A course appears more than once in Needs attention 0 times.
- **SC-007**: After an instructor changes something elsewhere in the app (publishes a course, fixes a video),
  the dashboard reflects it on return without a manual reload in 100% of cases.
- **SC-008**: An instructor with no courses sees the summary tiles 0 times; an instructor with at least one
  course sees the onboarding checklist 0 times; onboarding step states match real data in 100% of cases.
- **SC-009**: The dashboard displays a zero, "Not yet rated", empty list, or "all caught up" in place of data
  it failed to load 0 times, and renders a partial snapshot (some sections loaded, others failed) 0 times.
- **SC-010**: 100% of dashboard data requests return only the caller's own data, and 100% of requests from
  non-instructors are refused — verified independently of the frontend. Another instructor's data appears
  on a dashboard 0 times.
- **SC-011**: The dashboard is usable within the same responsiveness budget as the rest of the instructor
  shell for an instructor with up to 50 courses, 10,000 enrollments, and 2,000 reviews.
- **SC-012**: The dashboard renders without horizontal scrolling or clipped content at a 375px-wide viewport.

## Assumptions

- **The wireframe is the structural reference.** Layout follows the "Dashboard" screen of the instructor
  experience wireframes (greeting + Create course, four tiles, recent enrollments beside recent reviews,
  needs attention, onboarding variant). Visual styling follows the existing design tokens, not the
  wireframe's greyscale.
- **"Unanswered review" is dropped from the wireframe.** Reviews are read-only (discovery US-11, spec 012), so
  there is nothing to answer; Needs attention is limited to actionable items.
- **The wireframe's "Upload video" quick action is not included.** An upload needs a specific lecture, so a
  context-free shortcut would only lead to My Courses; the Create course action and the needs-attention links
  cover the real entry points.
- **Readiness is spec 007's verdict, reused.** "Live course needs attention" and "ready to publish" are
  exactly 007's readiness result; this feature adds the cross-course roll-up that 007 deferred to it.
- **Video state is spec 006's definition.** Failed is actionable (retry/replace); processing is not.
- **Rating reuses the existing instructor rating computation** (published courses only), so home and public
  profile agree. Recent reviews, by contrast, include reviews on any of the instructor's courses, since an
  instructor still wants to read feedback on a course they have since unpublished.
- **Students and earnings are derived from existing enrollment and order records** at read time. The
  existing denormalised instructor student counter counts enrollments rather than distinct people, so it is
  not assumed to satisfy FR-005.
- **Earnings are gross sales.** No platform revenue share exists in the system, so the tile is the sum of paid
  orders; spec 013 inherits this definition and adds breakdowns.
- **Single currency.** Orders are recorded in one platform currency (USD); no conversion is needed.
- **Lifetime totals, computed on read.** At current scale the summary is cheap enough to derive per visit; no
  caching, denormalisation, background job, or new stored field is assumed, and therefore no migration.
- **No real-time layer.** Activity by students appears on the instructor's next visit or refresh.
- **Foundation from 003–007 is in place.** Role-aware routing, the instructor shell and its home route, course
  management, the curriculum builder, the lecture editor, and publishing with its readiness verdict all
  exist. The destinations that this dashboard links to and that later specs deliver (instructor profile,
  roster, reviews feed, earnings) render the shell's existing placeholders until those specs land.
- **Student display identity is shareable with their instructor.** An instructor seeing the name and avatar
  of a student enrolled in their own course is expected platform behaviour; contact details are not shown.

## Dependencies

- **Spec 003 (instructor foundation)** — the instructor shell, the instructor home route whose placeholder
  this feature replaces, and graceful handling of a caller without an instructor profile.
- **Spec 004 (instructor course management)** — My Courses (the "see all" destination), the create-course
  flow (the primary action), and the course workspace (the destination for most links).
- **Spec 005 (curriculum builder)** — the curriculum that onboarding step 3 checks and links to.
- **Spec 006 (instructor video upload)** — the lecture video states the needs-attention list and onboarding
  step 4 read, and the lecture editor that failed-video items link to.
- **Spec 007 (course publishing)** — the readiness verdict that drives "live course needs attention",
  "ready to publish", and "draft in progress", and the publish state onboarding step 5 checks.
- **Existing enrollment, order, and review data** — read-only sources for Students, Earnings, and recent
  activity.
- **The existing instructor rating computation** used for the public instructor profile.
- **The shared component library, design tokens, data-fetching, and error-handling conventions** established
  by the student experience and reused in 003–007.

## Out of Scope

- **Analytics** — charts, enrollments over time, completion rates, drop-off, quiz pass rates, period
  selectors, and comparisons (spec 009).
- **Full student roster** with progress, search, and sort (spec 010).
- **Instructor profile editing** (spec 011); onboarding step 1 links to its planned destination only.
- **Full reviews feed**, filters, and rating breakdowns (spec 012); any form of replying to reviews.
- **Earnings breakdown** by course or period, refunds list, transactions, payouts, and exports (spec 013).
- **Notifications** of any kind — email, in-app, or push — for new enrollments, reviews, or course problems.
- **Real-time updates** of dashboard data.
- **Customisable or rearrangeable dashboard layouts**, hiding tiles, or dismissing needs-attention items.
- **Any action taken directly from the dashboard** (publishing, retrying a video, etc.) — all actions are
  links into existing surfaces.
- **Any change to the student experience** or to instructor surfaces other than the instructor home.
