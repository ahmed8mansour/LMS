# Feature Specification: Course Publishing & Readiness Gate

**Feature Branch**: `007-course-publishing`
**Created**: 2026-09-11
**Status**: Draft
**Input**: User description: "read planning/instructor-experience-discovery.md and especially the spec 007
the course-publish and start creating the spec for this feature"

## Overview

Specs 004, 005, and 006 gave instructors everything needed to *build* a course — create it, structure it
into sections and lectures, author quizzes, and attach real video to every lecture. None of them gave them
a way to *ship* it. Every course created through the instructor experience is a draft, and it stays a draft
forever: the publish status is displayed read-only on the Course Overview (004 FR-013), and nothing in the
instructor experience can change it. The only way a course reaches the student catalog today is an
administrator flipping a flag.

This feature closes that loop. It makes the draft → published transition a **deliberate, owner-controlled,
guarded action**, and makes the guard *legible* — an instructor should never click Publish and be told "no"
without being told exactly what to go fix.

Concretely, this feature makes five things true for an instructor:

1. **They can publish a finished course themselves** — one explicit action on a course they own moves it
   into the student catalog, where it can be discovered and bought.
2. **They always know whether a course is ready, before they try** — the workspace shows a readiness
   checklist: what passes, what is blocking, and a direct link to the exact place each blocker lives.
3. **They are never allowed to publish something broken** — a course with no content, an empty section, a
   lecture without a playable video, or a half-written quiz cannot reach students, and the refusal names
   the specific offending items rather than failing generically.
4. **They can take a course back off the catalog** — unpublishing is available at any time, with a
   confirmation that states plainly what changes and, just as importantly, what does not: enrolled
   students keep everything.
5. **They find out when a live course develops a problem** — if a published course stops meeting the bar
   (a video is removed, a section is emptied), the instructor is told prominently instead of discovering it
   through a student complaint. The platform never silently changes a live course's status on their behalf.

The publish state itself already exists as a single field on the course. What does not exist is the
*action*, the *gate*, the *explanation*, and the *guarantee that the gate cannot be bypassed* — which is
what this feature delivers, with no change to the student catalog, checkout, or learning experience beyond
courses appearing in and disappearing from the catalog as their owners intend.

## Clarifications

### Session 2026-09-11

- Q: What exactly must be true for a course to be publishable? → A: Five **blocking** conditions: a
  **thumbnail** is set; the course has **at least one section**; **every** section has **at least one
  lecture**; **every** lecture has a video in the **ready** state; and **every quiz that exists** is
  complete (at least one question, and every question complete per the 005 rule — text, at least two
  choices, exactly one marked correct). Everything else that is merely desirable — language, learning
  goals, having any quiz at all, a non-zero price — is shown as **advisory** and MUST NOT block. Rationale:
  the blocking set is exactly the conditions under which a paying student would hit something broken or
  empty; taste is not a gate.
- Q: Are quizzes required to publish? → A: **No.** A course with no quizzes anywhere is publishable — the
  sequential learning model treats a section without a quiz as complete when its lectures are done. But a
  quiz that *exists* and is incomplete **is** blocking, because a student reaching an empty or malformed
  quiz is stuck mid-course with no way forward. Optional to have; not optional to half-finish.
- Q: Is publishing part of saving the course's metadata, or its own action? → A: Its **own explicit
  action**, separate from every metadata save. Saving the edit form MUST NOT be able to publish or
  unpublish a course, by any field it carries. Rationale: publication is a business state change with
  student-visible and revenue consequences; it must never be a side effect of editing a description.
- Q: Is the readiness checklist computed or stored? → A: **Computed on demand, never stored.** A stored
  readiness flag drifts the moment a lecture's video is removed, and a stale "ready" badge is worse than no
  badge. Readiness is always derived from the course's current content.
- Q: Can the client-side checklist be trusted as the gate? → A: **No.** The checklist is guidance; the
  authoritative gate is re-evaluated **server-side at the moment of publish**, against the course's state
  at that moment. A publish request for a course that is not ready MUST be refused with the specific
  reasons, even if the client believed otherwise (stale data, a concurrent change, or a crafted request).
- Q: What happens to enrolled students when a course is unpublished? → A: **Nothing.** Active enrollments
  remain active, students keep full access to content, video, quizzes, and their progress, and their orders
  and reviews are untouched. Unpublishing removes the course from **discovery and new purchases only**.
  The confirmation MUST state both halves — what stops (catalog visibility, new enrollments) and what does
  not (existing students' access) — because instructors reasonably fear the second.
- Q: If a published course later stops meeting the bar — an instructor removes the only video from a
  lecture — does the system unpublish it automatically? → A: **Never.** Automatically taking a live course
  off the catalog silently destroys an instructor's discoverability and sales with no action on their part.
  Instead the course MUST be flagged as **needing attention** wherever the instructor sees their courses,
  naming the specific problem, leaving the decision (fix it, or unpublish it) with the owner. Editing a
  live course is allowed and its changes are live immediately — the existing no-versioning reality.
- Q: Who may publish or unpublish? → A: Only the **owning instructor** (and admins, through the existing
  admin surface). Every attempt against another instructor's course — by deep link, guessed ID, or crafted
  request — MUST be refused with nothing exposed and no change made. Ownership is enforced server-side;
  the route guard is defense in depth only.
- Q: What happens when publishing a course that is already published (or unpublishing a draft)? → A: The
  action is **idempotent** — it succeeds without changing anything and the instructor is told the course is
  already in that state. A double-click or a duplicate request MUST NOT produce an error or a confusing
  failure.
- Q: Does this feature introduce a review/approval step before a course goes live? → A: **No.** Publishing
  is immediate and self-serve, consistent with the confirmed self-serve instructor access model. Platform
  moderation of course content is a separate future concern, not a gate in this feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish a finished course (Priority: P1)

An instructor who has built a complete course — thumbnail, sections, lectures with ready videos, and any
quizzes finished — opens the course workspace, sees that everything passes, and publishes it. The course
becomes visible in the student catalog and can be enrolled in and bought. The workspace now shows it as
live.

**Why this priority**: This is the feature, and it is the last missing link in the entire supply side.
Without it, every course an instructor builds through 004–006 is permanently invisible and earns nothing —
the authoring MVP produces no business outcome at all.

**Independent Test**: As an instructor, take a course that satisfies every readiness condition, publish it
from the workspace, and confirm it appears in the student catalog and can be enrolled in — then confirm the
instructor's own views report it as published.

**Acceptance Scenarios**:

1. **Given** a course the instructor owns that meets every blocking readiness condition, **When** they open
   the course workspace, **Then** the publish control is available and the course is shown as ready to
   publish.
2. **Given** a ready draft course, **When** the instructor confirms publish, **Then** the course becomes
   published, the workspace and My Courses both report it as published without a manual page reload, and
   the instructor is told it is now live.
3. **Given** a course that has just been published, **When** a student browses or searches the catalog,
   **Then** the course appears and can be enrolled in or purchased.
4. **Given** a published course, **When** the instructor views the publish control, **Then** it offers
   unpublish rather than publish — the control always reflects the course's actual current state.
5. **Given** a published course, **When** the instructor publishes it again (double-click, duplicate
   request), **Then** nothing changes, no error is shown, and they are told it is already published.

---

### User Story 2 - See exactly why a course cannot be published yet (Priority: P1)

An instructor with a half-built course opens the workspace and sees a readiness checklist: which conditions
pass, which are blocking, and for each blocker, what and where it is — the specific empty section, the
specific lecture missing a video, the specific incomplete quiz — each a direct link to the place they can
fix it. Publish is not available until the blockers are cleared, and the reason is never a generic failure.

**Why this priority**: A gate without an explanation is the worst possible outcome — it stops the
instructor without telling them how to proceed, and a disabled button with no reason reads as a bug.
Discovery US-16 calls this out directly: blocked publishing must come with a clear explanation. The
checklist is also what makes the gate feel like guidance rather than an obstacle.

**Independent Test**: Build a course with a deliberate gap at each level in turn — no thumbnail, no
sections, an empty section, a lecture with no video, a lecture whose video is still processing, a quiz with
a malformed question — and confirm each appears as a named blocker with a working link to the offending
item, and that publish stays unavailable until all are cleared.

**Acceptance Scenarios**:

1. **Given** a draft course, **When** the instructor opens the workspace, **Then** a readiness checklist
   shows every blocking condition with its current pass/fail state.
2. **Given** a course with no thumbnail, **When** the checklist is shown, **Then** the missing thumbnail is
   listed as blocking with a link to where it is set.
3. **Given** a course with no sections, or a section with no lectures, **When** the checklist is shown,
   **Then** that is listed as blocking and names the specific empty section, linking to the curriculum.
4. **Given** a lecture with no video, a video still processing, or a failed video, **When** the checklist
   is shown, **Then** that lecture is named as blocking, its video state is stated, and the entry links to
   that lecture's editor.
5. **Given** a quiz with no questions, or a question that is incomplete, **When** the checklist is shown,
   **Then** that quiz is named as blocking and the entry links to the quiz editor.
6. **Given** a course with blocking items, **When** the instructor attempts to publish anyway, **Then** the
   publish is refused, nothing changes, and the specific reasons are stated — never a generic failure.
7. **Given** a course that passes every blocking condition but is missing something advisory (no language,
   no learning goals, no quizzes), **When** the checklist is shown, **Then** those appear as advisory
   suggestions, clearly distinguished from blockers, and publish remains available.
8. **Given** an instructor who clears the last blocking item, **When** they return to the checklist,
   **Then** it reflects the change without a manual reload and publish becomes available.

---

### User Story 3 - Take a live course back off the catalog (Priority: P1)

An instructor needs to pull a published course — it needs rework, the content is out of date, or it was
published by mistake. They unpublish it from the workspace. Before anything happens they are told exactly
what unpublishing does: the course leaves the catalog and takes no new students, while everyone already
enrolled keeps full access and their progress. Afterwards the course is a draft again and can be
republished once it is ready.

**Why this priority**: Publishing is only safe to offer if it is reversible. An instructor who cannot undo
a publish is one mistake away from a public course they are ashamed of, and the fear of that makes them
hesitate to publish at all. The reassurance about enrolled students matters as much as the action.

**Independent Test**: Publish a course, enroll a student in it, then unpublish it. Confirm the course no
longer appears in the catalog and cannot be newly enrolled in, while the enrolled student can still open
it, watch its videos, take its quizzes, and see their progress intact. Then republish and confirm it
returns to the catalog.

**Acceptance Scenarios**:

1. **Given** a published course, **When** the instructor chooses unpublish, **Then** they MUST explicitly
   confirm before anything changes.
2. **Given** the unpublish confirmation, **When** it is shown, **Then** it states that the course will be
   removed from the catalog and will accept no new enrollments, **and** that students already enrolled keep
   full access to the course and their progress.
3. **Given** a confirmed unpublish, **When** it completes, **Then** the course is a draft, is absent from
   the student catalog and search results, and cannot be newly enrolled in or purchased.
4. **Given** a course that has just been unpublished, **When** an already-enrolled student opens it,
   **Then** they retain full access to its content, videos, and quizzes, and their progress, orders, and
   reviews are unchanged.
5. **Given** an unpublished (formerly published) course, **When** the instructor publishes it again,
   **Then** the readiness gate is applied afresh and, if it passes, the course returns to the catalog.
6. **Given** a draft course, **When** an unpublish is requested, **Then** nothing changes, no error is
   shown, and the instructor is told it is already a draft.
7. **Given** an unpublish is in flight, **When** the instructor views the control, **Then** its state is
   clear and the action cannot be double-submitted into conflicting requests.

---

### User Story 4 - Find out when a live course develops a problem (Priority: P2)

An instructor edits a published course — removes a video to re-record it, deletes a section — and the
course no longer meets the bar it was published under. It stays live (the platform does not touch it), but
the instructor is told clearly, wherever they look at their courses, that this live course has a problem
and what it is, so they can fix it or pull it down themselves.

**Why this priority**: Without this, a published course can quietly become broken for paying students and
the instructor is the last to know. It is the discovery document's "needs attention" concept, and it is the
honest alternative to silently unpublishing someone's course. It is P2 rather than P1 because the course is
still live and recoverable — the damage is real but not immediate loss of the instructor's work.

**Independent Test**: Publish a ready course, then remove the video from one of its lectures. Confirm the
course is still published and still in the catalog, and that the workspace and My Courses both flag it as
needing attention, naming the lecture with the missing video.

**Acceptance Scenarios**:

1. **Given** a published course that no longer meets a blocking readiness condition, **When** the
   instructor views its workspace, **Then** it is prominently flagged as needing attention, with the
   specific failing items named and linked.
2. **Given** a published course that needs attention, **When** the instructor views My Courses, **Then**
   that course is distinguishable from healthy published courses at a glance.
3. **Given** a published course that stops meeting a readiness condition, **When** that change is made,
   **Then** the system MUST NOT change the course's publish status on its own — it remains published until
   the instructor decides otherwise.
4. **Given** a published course flagged as needing attention, **When** the instructor fixes the underlying
   items, **Then** the flag clears without a manual reload and without republishing.
5. **Given** a published course the instructor is editing, **When** they make changes, **Then** they are
   reminded that changes to a live course are immediately visible to enrolled students.

---

### User Story 5 - Nobody publishes another instructor's course (Priority: P1)

An instructor can publish and unpublish only the courses they own. Any attempt against someone else's
course — by deep link, guessed identifier, or a crafted request — is refused, exposes nothing about that
course, and leaves its status exactly as it was.

**Why this priority**: Publish state is directly student-facing and revenue-bearing. An instructor who can
unpublish a rival's course can remove it from the catalog and destroy their sales; one who can publish a
rival's unfinished draft exposes work that was never meant to be public. This is the highest-consequence
authorization surface in the instructor experience so far.

**Independent Test**: As instructor A, attempt to publish and to unpublish a course belonging to instructor
B, and to read B's readiness checklist, by identifier. Confirm every attempt is refused, no information
about B's course is returned, and B's course status is unchanged — verified against the backend
independently of the frontend.

**Acceptance Scenarios**:

1. **Given** a course owned by another instructor, **When** instructor A attempts to publish or unpublish
   it by identifier, **Then** the attempt is refused, no data about the course is exposed, and its status
   is unchanged.
2. **Given** a course owned by another instructor, **When** instructor A requests its readiness state,
   **Then** the request is refused with nothing exposed.
3. **Given** a student account, **When** it attempts to publish or unpublish any course, **Then** the
   attempt is refused.
4. **Given** a staff account with no instructor profile, **When** it attempts any publishing action,
   **Then** it is refused cleanly rather than causing an error.
5. **Given** a draft course, **When** any student-facing or public surface is consulted, **Then** the draft
   never appears in it — not in the catalog, search, homepage, or any public listing.

---

### Edge Cases

- **Publish clicked on a course that just became unready.** Between the checklist loading and the publish
  request, a video is removed or a section deleted (another tab, a concurrent action). The publish MUST be
  refused on the state at request time, with current reasons, and the checklist MUST refresh to match.
- **Publish clicked on a course that just became ready.** The cached checklist says blocked but the course
  now passes. The instructor MUST be able to reach a publishable state by refreshing the readiness view,
  and the server MUST judge on current state, not on what the client believed.
- **Lecture video still processing.** A lecture whose video is mid-transcode is **not** ready. It is a
  blocker, stated as "still processing" rather than "missing", so the instructor waits instead of
  re-uploading.
- **Lecture video failed.** A blocker, stated as failed, linking to the lecture so the instructor can retry
  or replace (spec 006's recovery actions).
- **Empty section.** A section with zero lectures blocks publish and is named specifically — a student
  reaching it has nothing to do and, under sequential progression, nothing to complete.
- **Quiz with zero questions.** Blocks publish. A quiz a student cannot pass is a wall in the middle of the
  course.
- **Quiz with an incomplete question.** A question with no text, fewer than two choices, or not exactly one
  correct choice blocks publish, consistent with the 005 completeness rule.
- **Course with no quizzes at all.** Publishable. Shown as an advisory suggestion only.
- **Free course.** A price of zero is valid and MUST NOT block publish — free enrollment is a supported
  path.
- **Missing thumbnail.** Blocks publish. A catalog entry with no image is a broken-looking product, and the
  thumbnail was deliberately deferred from create-time (004) to exactly this gate.
- **Very large course.** Readiness evaluation over a course with many sections, lectures, and quizzes MUST
  remain responsive and MUST NOT degrade into a slow page.
- **Concurrent publish and unpublish.** Two conflicting requests for the same course MUST leave it in one
  coherent state, with the outcome reported truthfully rather than the interface showing a state the server
  does not hold.
- **Deleting a published course.** Remains 004's behaviour, with its existing confirmation. This feature
  does not add a "must unpublish before deleting" rule.
- **Unpublishing a course with pending orders.** Unpublishing MUST NOT cancel, refund, or alter any
  existing order, transaction, or enrollment.
- **Instructor with no instructor profile.** Handled gracefully everywhere, consistent with 003–006 — a
  clear state, never an error page.
- **Readiness data unavailable.** If readiness cannot be determined, the interface MUST say so and offer a
  retry, and MUST NOT show a misleading "ready" state or a blank region. Publishing MUST NOT be offered on
  unknown readiness.
- **Repeated toggling.** Rapid publish/unpublish cycling MUST NOT corrupt state or produce duplicate
  student-visible side effects.

## Requirements *(mandatory)*

### Functional Requirements

#### The publish action

- **FR-001**: The system MUST let an instructor publish a course they own, making it visible in the student
  catalog and available for enrollment and purchase.
- **FR-002**: The system MUST let an instructor unpublish a course they own, removing it from the student
  catalog, search, and all public listings, and preventing new enrollments and purchases.
- **FR-003**: Publishing and unpublishing MUST be **explicit, dedicated actions**. Saving a course's
  metadata MUST NOT be able to change its publish status by any field it carries, and the publish status
  MUST NOT be writable through any metadata-editing path.
- **FR-004**: The publish control MUST always reflect the course's actual current status, offering publish
  for a draft and unpublish for a published course.
- **FR-005**: Both actions MUST be **idempotent**: publishing an already-published course, or unpublishing
  a draft, MUST succeed without changing anything and MUST tell the instructor the course is already in
  that state, rather than producing an error.
- **FR-006**: Unpublishing MUST require an explicit confirmation that states (a) the course will leave the
  catalog and accept no new enrollments, and (b) students already enrolled keep full access to the course
  and their progress.
- **FR-007**: Publishing MUST be reversible at any time, and an unpublished course MUST be republishable,
  with the readiness gate re-applied on each publish.
- **FR-008**: After either action, every instructor-facing surface that shows the course's status MUST
  reflect the new status without a manual page reload.

#### The readiness gate

- **FR-009**: The system MUST refuse to publish a course unless **all** of the following are true:
  (a) the course has a thumbnail; (b) it has at least one section; (c) every section has at least one
  lecture; (d) every lecture has a video in the **ready** state; (e) every quiz that exists has at least
  one question and every one of its questions is complete (question text, at least two choices, exactly one
  marked correct).
- **FR-010**: The absence of quizzes MUST NOT block publishing. A course with no quizzes in any section is
  publishable.
- **FR-011**: A price of zero MUST NOT block publishing.
- **FR-012**: Conditions outside FR-009 — including a missing language, an empty learning-goals list, and
  the absence of any quiz — MUST be presented as **advisory** and MUST NOT block publishing. Advisory items
  MUST be visually distinguishable from blocking items.
- **FR-013**: Readiness MUST be **computed from the course's current content on demand** and MUST NOT be
  stored as a flag that can drift from reality.
- **FR-014**: The readiness gate MUST be enforced **server-side at the moment of publish**, against the
  course's state at that moment. A refused publish MUST change nothing and MUST return the specific current
  reasons. Any client-side checklist is advisory only and MUST NOT be the gate.
- **FR-015**: A refusal MUST name the **specific offending items** — which section is empty, which lecture
  lacks a ready video and what state that video is in, which quiz or question is incomplete — and MUST NOT
  be a generic failure message.
- **FR-016**: The readiness gate MUST NOT apply to unpublishing. An instructor MUST be able to unpublish a
  course regardless of its readiness.

#### Readiness visibility

- **FR-017**: The course workspace MUST show a readiness checklist listing every blocking condition with
  its current pass/fail state, plus any advisory suggestions.
- **FR-018**: Each blocking entry MUST link directly to the place the instructor can resolve it — the edit
  form for a missing thumbnail, the curriculum for missing or empty sections, the specific lecture editor
  for a video problem, the specific quiz editor for an incomplete quiz.
- **FR-019**: The publish action MUST be unavailable while blocking items remain, and the interface MUST
  make the reason visible rather than presenting an unexplained disabled control.
- **FR-020**: When the instructor resolves a blocking item, the readiness view MUST reflect that without a
  manual page reload.
- **FR-021**: Where readiness cannot be determined, the interface MUST say so and offer a retry; it MUST
  NOT display a misleading ready state, a blank region, or an enabled publish control.
- **FR-022**: Every publishing and readiness surface MUST present defined loading, empty, blocked, and
  retry-able error states.

#### Live courses that stop qualifying

- **FR-023**: The system MUST NOT change a course's publish status on its own under any circumstances. A
  published course that stops meeting FR-009 MUST remain published until the instructor changes it.
- **FR-024**: A published course that does not meet FR-009 MUST be flagged as **needing attention** in the
  course workspace, naming and linking the specific failing items.
- **FR-025**: A published course needing attention MUST be distinguishable from healthy published courses
  in the instructor's course list.
- **FR-026**: The needs-attention flag MUST clear when the underlying items are resolved, without
  requiring the instructor to republish.
- **FR-027**: When editing a published course, the instructor MUST be reminded that changes to a live
  course are immediately visible to enrolled students.

#### Access & integrity

- **FR-028**: Only the owning instructor (and admins through the existing admin surface) may publish or
  unpublish a course, or read its readiness state. Any attempt against a course the caller does not own —
  including by deep link or guessed identifier — MUST be refused with no data exposed and no change made.
  Server-side ownership scoping is the authoritative gate; the route guard is defense in depth only.
- **FR-029**: A caller without an instructor profile MUST be refused cleanly on every publishing and
  readiness path, without causing an error.
- **FR-030**: Draft courses MUST NOT appear in any student-facing or public surface — catalog, search,
  homepage, or any public listing — and MUST NOT be enrollable or purchasable.
- **FR-031**: Unpublishing MUST NOT alter any existing enrollment, order, transaction, progress record, or
  review. Students already enrolled MUST retain full access to the course, its videos, and its quizzes,
  and MUST keep their progress.
- **FR-032**: Concurrent or repeated publish/unpublish requests for the same course MUST leave it in a
  single coherent state, and the instructor MUST be shown the status the system actually holds.
- **FR-033**: Publishing and readiness paths MUST NOT return raw errors or stack traces; failures MUST
  surface as clear, non-technical messages.

#### Scope boundaries

- **FR-034**: This feature MUST NOT change the student-facing catalog, discovery, checkout, enrollment, or
  learning experience beyond courses becoming visible or invisible as their owners publish and unpublish
  them.
- **FR-035**: This feature MUST NOT introduce a platform review or approval step before a course goes live;
  publishing is immediate and self-serve.
- **FR-036**: This feature MUST NOT introduce content versioning, drafts-of-published-courses, scheduled
  publishing, archiving, or soft-delete.
- **FR-037**: New publishing surfaces MUST reuse the project's existing design tokens and component
  library and MUST be visually consistent with the surrounding instructor experience.

### Key Entities *(include if feature involves data)*

- **Course (existing, unchanged)**: Carries the single publish status that this feature's action flips, plus
  the thumbnail and metadata the gate inspects. Ownership flows from its instructor and determines who may
  publish it. No new fields are introduced.
- **Course readiness (computed, not persisted)**: The derived verdict on whether a course may be published:
  an overall publishable/not result, the pass/fail state of each blocking condition in FR-009, the specific
  offending items behind any failure (with enough identity to link to them), and the advisory suggestions.
  Always derived from current content; never stored.
- **Section (existing, referenced)**: Inspected for existence and for holding at least one lecture. An empty
  section is a named blocker.
- **Lecture (existing, referenced)**: Inspected for its video state, as defined by spec 006 — only *ready*
  qualifies; no video, processing, and failed are all blockers, each reported with its actual state.
- **Quiz / Question / Choice (existing, referenced)**: Inspected for completeness when present — a quiz
  needs at least one question, and each question needs text, at least two choices, and exactly one correct
  choice, per the 005 rule.
- **Enrollment / Order (existing, referenced, untouched)**: What unpublishing deliberately does **not**
  affect; consulted only to describe consequences honestly in the confirmation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can take a complete course from draft to live entirely from the course
  workspace, with no administrator involvement, in under 1 minute and without a manual page reload.
- **SC-002**: A published course is discoverable and enrollable by students in 100% of successful
  publishes.
- **SC-003**: 100% of publish attempts on a course failing any blocking condition are refused, and 100% of
  refusals name the specific offending items. Courses published while failing a blocking condition: 0.
- **SC-004**: A published course containing an empty section, a lecture without a ready video, or an
  incomplete quiz occurs 0 times as a result of a publish action.
- **SC-005**: For every blocking item shown, the instructor can reach the exact place to fix it in one
  click, in 100% of cases.
- **SC-006**: 100% of unpublish actions require explicit confirmation, and 100% of those confirmations
  state both the catalog/enrollment consequence and that enrolled students keep access.
- **SC-007**: After an unpublish, already-enrolled students retain full access and their progress in 100%
  of cases; enrollments, orders, transactions, progress records, or reviews altered by an unpublish: 0.
- **SC-008**: Courses whose publish status is changed by the system rather than by their owner: 0.
- **SC-009**: A published course failing a blocking condition is flagged as needing attention in both the
  workspace and the course list in 100% of cases, and the flag clears within one refresh of the underlying
  fix.
- **SC-010**: 100% of publish, unpublish, and readiness attempts against a course the caller does not own
  are refused with no data exposed and no status change, verified independently of the frontend.
- **SC-011**: Draft courses appearing in any student-facing or public surface: 0.
- **SC-012**: Repeated or concurrent publish/unpublish requests leave the course in a state other than the
  one reported to the instructor 0 times; duplicate requests producing an error rather than an idempotent
  result: 0.
- **SC-013**: A course's readiness verdict is presented within the same responsiveness budget as the rest of
  the workspace for courses up to 20 sections and 200 lectures.
- **SC-014**: Publishing and readiness paths return a raw error or stack trace to a client 0 times.

## Assumptions

- **The publish state already exists and is reused, not redesigned.** The course's single published/draft
  flag is the state this feature drives. It is already excluded from instructor-writable metadata, already
  the filter on every student-facing course query, and already the condition on enrollment — so this
  feature adds the action and the gate, and inherits the visibility and purchase consequences for free.
- **No database change is required.** Readiness is computed, the needs-attention flag is derived, and no new
  field, timestamp, or lifecycle column is introduced — so this feature adds no migration. (Consistent with
  the project's rule: had one been needed, it would be additive only.)
- **Video readiness is spec 006's definition.** A lecture's video is ready only in the *ready* state, with
  no video, processing, and failed all distinct and all disqualifying. This feature consumes that state and
  never changes it.
- **Quiz and question completeness is spec 005's definition.** Question text, at least two choices, exactly
  one correct — reused verbatim rather than redefined, so the curriculum builder's "incomplete" badge and
  the publish gate can never disagree.
- **Foundation from 003–006 is in place.** Role-aware routing, the instructor shell, the course workspace
  and its Overview tab (which holds the placeholder publish affordance this feature replaces), the
  curriculum builder, the lecture editor, and the quiz editor all exist.
- **Unpublishing is not a refund event.** Existing purchases stand. Refunds remain the existing admin-only
  path with its own window, entirely outside this feature.
- **Editing a live course stays immediately live.** There is no versioning and none is introduced; the
  mitigation is the reminder in FR-027, not a draft-of-a-published-course mechanism.
- **Ownership remains server-enforced.** The existing instructor gate and ownership scoping are the
  authoritative check; the frontend guard is defense in depth.
- **Reuse over rebuild on the frontend.** The publish control, readiness checklist, confirmation dialog, and
  status badges are built from the existing component library, design tokens, data-fetching, and
  error-handling patterns, following the house feature-module convention.
- **Readiness is cheap enough to compute on read.** At current scale a course's content fits comfortably in
  a single evaluation; no caching, denormalization, or background job is assumed.

## Dependencies

- **Spec 004 (instructor course management)** — the course workspace and its Overview tab, where the
  read-only status badge and placeholder publish affordance live (004 FR-013); the My Courses list whose
  status badges and filters this feature's actions drive; and the thumbnail deliberately deferred from
  create-time to this gate.
- **Spec 005 (curriculum builder)** — sections, lectures, and quizzes are what the gate inspects, and the
  question-completeness rule the quiz condition reuses. Its editors are the destinations the checklist links
  to.
- **Spec 006 (instructor video upload)** — the lecture video state machine the gate's hardest condition
  reads, and the lecture editor the checklist links to for a missing, processing, or failed video.
- **Spec 003 (instructor foundation)** — role-aware routing, the instructor shell, and graceful handling of
  a caller without an instructor profile.
- **The existing course data and ownership model** — the publish flag, the instructor-ownership chain, and
  the existing instructor-scoped course access that this feature's authorization reuses.
- **The existing student discovery and enrollment behaviour** — catalog, search, homepage, and checkout
  already require a published course, which is what makes publishing and unpublishing meaningful without
  touching them.
- **Existing enrollment and progress data (read-only)** — consulted only to state unpublish consequences
  honestly and to keep the promise that enrolled students are unaffected.
- **The shared component library, design tokens, confirmation-dialog, data-fetching, and error-handling
  conventions** established by the student experience and reused in 004–006.

## Out of Scope

- **Platform review, approval, or moderation** of course content before or after it goes live.
- **Scheduled or timed publishing**, embargo dates, and staged/partial rollouts.
- **Archiving, soft-delete, or undo** of a course, and any new lifecycle state beyond draft and published.
- **Content versioning** — drafts of published courses, change review, or student-facing change notices.
  The reminder in FR-027 is the whole mitigation.
- **Publish history or an audit trail** — who published what and when.
- **Notifying students** of a new, updated, or unpublished course; no email, in-app message, or
  notification system is introduced.
- **Any change to the student experience** — catalog layout, discovery ranking, search behaviour, checkout,
  enrollment, the player, and progress are all untouched.
- **Refunds or order changes** triggered by unpublishing.
- **Changing video upload, transcoding, or recovery behaviour** (spec 006) or curriculum authoring and
  reordering behaviour (spec 005); this feature only reads the state they own.
- **Course duplication** and bulk publish/unpublish across several courses at once.
- **Pricing, discounting, or coupon logic** at publish time.
- **Instructor dashboard "needs attention" aggregation** across all courses (spec 008) — this feature
  surfaces the flag on the course workspace and the course list, and exposes the readiness verdict that a
  dashboard can later roll up.
- **Analytics on publishing** — time-to-publish, publish funnel, or catalog conversion (spec 009).
