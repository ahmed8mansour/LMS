# Feature Specification: Instructor Course Management — My Courses, Create, Edit & Course Workspace

**Feature Branch**: `004-instructor-course-management`
**Created**: 2026-08-20
**Status**: Draft
**Input**: User description: "read planning/instructor-experience-discovery.md — the 004 spec for the instructor experience: course management UI (list / create / edit) on the existing instructor course API, with wireframes provided."

## Overview

Spec 003 gave instructors a home: role-aware routing and an instructor shell whose sidebar lists the
full planned navigation, with every destination behind it still a placeholder. This feature makes the
**first destination real** — **My Courses** — turning the empty shell into a working authoring surface
where an instructor can create, browse, edit, and remove the courses they own.

Concretely, this feature makes four things true for an instructor inside their shell:

1. **They can see every course they own** in one place — drafts and published alike — each labelled with
   its status, and can filter the list to just drafts or just published.
2. **They can create a new course** by filling a validated form (title, description, price, category,
   level, language, learning goals) and saving it as a draft, then continuing straight into building it.
3. **They can edit a course's presentation** — its metadata and thumbnail — with changes persisting and
   ownership enforced so they can only ever touch their own courses.
4. **They have a per-course home** — the course workspace overview — that summarises the course and is
   the stable root the later authoring tabs (curriculum, analytics, students, reviews) slot into.

The entire **backend already exists**: the ownership-scoped `InstructorCourseViewSet` supports full CRUD
on `/courses/instructor/courses/`, filtered to the caller's own courses and auto-binding ownership on
create. This feature is therefore **predominantly frontend** — a new instructor-courses feature module
(pages, forms, hooks, API client, validation) composed from the existing component library and the
patterns the student side already established.

This feature is deliberately **scoped to course-level management**. It does **not** build the curriculum
(sections/lectures/quizzes — spec 005), video upload (spec 006), or the publish action and its readiness
gate (spec 007). Courses created here are drafts and stay drafts; the workspace overview shows status
read-only and hosts the not-yet-built tabs as placeholders, exactly as 003 did for the sidebar.

## Clarifications

### Session 2026-08-20

- Q: When an instructor deletes a course that already has enrolled students, what should happen? → A:
  Allow the deletion but require an explicit confirmation that names the consequence (the course and its
  content are permanently removed and enrolled students immediately lose access; the delete cannot be
  undone). If the course has zero enrollments, a lighter confirmation is sufficient. Deletion remains
  owner-only and irreversible (existing cascade behaviour); no soft-delete is introduced here.
- Q: The "Publish" control appears on the Course Overview wireframe — is publishing in scope for 004? →
  A: No. The publish/unpublish action and its readiness validation are delivered by spec 007. In 004 the
  overview shows the course's current status (Draft / Published) read-only; any publish affordance shown
  is a placeholder that routes to the 007 experience when it lands. Courses are created as drafts.
- Q: Does creating a course require setting a thumbnail before it can be saved as a draft? → A: No. A
  draft can be saved with core metadata (title, description, price, category, level); thumbnail, language,
  and learning goals are optional at draft time and can be added later via Edit. A missing thumbnail is
  surfaced later as a publish-readiness item (spec 007), not a create-time blocker.
- Q: How should the My Courses list handle filtering, search, and scale? → A: Client-side. The instructor's
  full owned-course list is fetched once and status filtering and title search are applied in the client;
  the list is not paginated and no server-side filter/search is added (an instructor's own catalogue is
  small and bounded). This preserves the "no new backend endpoint" assumption.
- Q: Is Edit a dedicated page or an inline mode on the Overview? → A: A dedicated edit route (e.g.
  `/instructor/courses/[id]/edit`) that reuses the same form component as Create. The Overview tab stays
  read-only and links to that route to edit; edit is deep-linkable and separate from the summary.
- Q: How are learning goals entered and stored? → A: A repeatable list of short text-input rows the
  instructor can add and remove, submitted as an array of strings (one goal per item) matching the
  course's list field, with per-item validation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse my courses (Priority: P1)

An instructor opens **My Courses** from the sidebar and sees a grid of every course they own — both
drafts and published — each shown with a thumbnail, title, and a status badge (Draft or Published), plus
quick actions to edit or manage it. They can filter the grid to All, Published, or Draft, and search by
title. When they own no courses yet, they see a focused empty state inviting them to create their first
course. An instructor only ever sees their own courses, never another instructor's.

**Why this priority**: This is the entry point to the whole course-management surface and the first real
page behind the instructor shell. Even on its own — with create/edit still to come — it turns the
placeholder into a genuine (if read-only) view of the instructor's catalogue and is independently
demonstrable. It is the minimum viable slice of "manage my courses".

**Independent Test**: Sign in as an instructor who owns several courses in mixed states and confirm the
grid lists exactly those courses with correct status badges; apply each filter and the search and confirm
the grid narrows correctly; sign in as an instructor with no courses and confirm the empty state.

**Acceptance Scenarios**:

1. **Given** an instructor who owns courses in draft and published states, **When** they open My Courses,
   **Then** every course they own is listed, each with its correct status badge, and no course belonging
   to another instructor appears.
2. **Given** the My Courses list, **When** the instructor selects the Draft (or Published) filter,
   **Then** only courses in that state are shown; selecting All restores the full list.
3. **Given** the My Courses list, **When** the instructor types a query into search, **Then** the grid
   narrows to courses whose title matches.
4. **Given** an instructor who owns no courses, **When** they open My Courses, **Then** a clear empty
   state is shown with a single primary call to action to create their first course.
5. **Given** the list is loading or fails to load, **When** the page renders, **Then** a loading skeleton
   (respectively a retry-able error state) is shown rather than a blank or broken page.

---

### User Story 2 - Create a course (Priority: P1)

An instructor chooses **New course** and is taken to a create form. They fill in the course's title,
description, price, category, level, language, and learning goals. The form validates their input and
shows clear inline errors for anything invalid. On save, the course is created as a **draft** owned by
them, and they are taken straight into that course's workspace so they can begin building it.

**Why this priority**: Creating a course is the core productive action of the whole instructor
experience — without it there is nothing to edit, structure, or publish. It pairs with Story 1 as the
authoring MVP's foundation and must ship in the first slice.

**Independent Test**: As an instructor, open the create form, submit it empty and confirm validation
blocks the save with field-level messages; submit it with valid data and confirm a new draft course
appears (owned by that instructor) and the app lands on that course's workspace.

**Acceptance Scenarios**:

1. **Given** an instructor on the create-course form, **When** they submit valid required data, **Then**
   a new course is created with a draft (unpublished) status, owned by them, and they are routed to that
   course's workspace.
2. **Given** the create-course form, **When** the instructor submits with missing or invalid fields (e.g.
   empty title, non-numeric or negative price, category/level outside the allowed set), **Then** the save
   is blocked and specific inline errors identify each invalid field.
3. **Given** a draft is being created, **When** the instructor has not provided a thumbnail, language, or
   learning goals, **Then** the draft still saves (these are optional at draft time) and can be completed
   later via Edit.
4. **Given** a save request is in flight, **When** the instructor waits, **Then** the submit control
   reflects the pending state and cannot be double-submitted; a server-side failure surfaces a clear,
   non-technical error and preserves the entered values.

---

### User Story 3 - Edit a course's metadata and thumbnail (Priority: P1)

From My Courses or the course workspace, an instructor opens **Edit** for a course they own and changes
its metadata (title, description, price, category, level, language, learning goals) and/or replaces its
thumbnail image. Saving persists the changes. The instructor can only ever edit their own courses;
attempting to edit another instructor's course is rejected.

**Why this priority**: Courses are rarely right on the first save; editing metadata and setting the
thumbnail is essential to preparing a course for publication and is a constant part of the authoring
loop. It completes the create/read/update trio that makes the surface genuinely useful.

**Independent Test**: As an instructor, edit an owned course's title, price, and thumbnail, save, and
confirm the changes persist on reload; attempt (by direct URL/ID) to edit a course owned by another
instructor and confirm access is refused with no data exposed.

**Acceptance Scenarios**:

1. **Given** a course the instructor owns, **When** they change its metadata and save, **Then** the
   changes persist and are reflected in My Courses and the workspace.
2. **Given** the edit form, **When** the instructor uploads a replacement thumbnail image, **Then** the
   new thumbnail is stored and shown wherever the course appears.
3. **Given** invalid input on the edit form, **When** the instructor tries to save, **Then** the save is
   blocked with inline field errors, consistent with the create form.
4. **Given** a course owned by a different instructor, **When** the instructor attempts to open or submit
   an edit for it (including via a guessed ID or deep link), **Then** the request is refused and no
   course data is shown or changed.

---

### User Story 4 - Course workspace overview (Priority: P2)

Opening a course (via Manage) takes the instructor to the **course workspace** — a per-course area with a
persistent tab bar (Overview, Curriculum, Analytics, Students, Reviews) and the course title as a
breadcrumb root. The **Overview** tab summarises the course: thumbnail, title, status, and its
key metadata, with entry points to edit it. Tabs whose features are delivered by later specs render a
clear placeholder rather than an error, so the workspace is coherent from day one.

**Why this priority**: The workspace is the stable home that every later authoring feature (curriculum,
video, publishing, analytics, students, reviews) attaches to, so establishing it now de-risks and
accelerates those specs. But the create/read/update stories already deliver standalone value, so it ranks
just below them — mirroring how 003 shipped the shell around placeholder destinations.

**Independent Test**: Open an owned course and confirm the workspace shows the tab bar with Overview
active and the course's summary; select each other tab and confirm a placeholder (not a crash) appears;
confirm opening a non-owned course's workspace by ID is refused.

**Acceptance Scenarios**:

1. **Given** an instructor opening a course they own, **When** the workspace loads, **Then** the Overview
   tab is shown with the course's thumbnail, title, current status (Draft/Published, read-only), and key
   metadata, plus a way to edit the course.
2. **Given** the course workspace, **When** the instructor selects a tab whose feature is not yet built
   (Curriculum, Analytics, Students, Reviews), **Then** a clear placeholder/"coming soon" state is shown
   rather than an error or blank page.
3. **Given** the workspace tab bar, **When** any tab is active, **Then** it is visually marked active and
   the course title is shown as a persistent breadcrumb root.
4. **Given** a course the instructor does not own, **When** they attempt to open its workspace by URL/ID,
   **Then** access is refused and no course data is shown.

---

### User Story 5 - Delete a course (Priority: P2)

An instructor removes a course they no longer want. Because deletion is permanent and cascades to all the
course's content — and, if students are enrolled, revokes their access — the instructor is asked to
confirm before it happens. When the course has enrolled students, the confirmation explicitly names that
consequence; for a course with no enrollments a lighter confirmation is enough. Only the owner can delete
a course.

**Why this priority**: Deletion rounds out lifecycle management and is important for keeping a catalogue
tidy, but it is used far less often than browsing, creating, and editing, and carries risk — so it ships
after the core CRUD with strong guard-rails rather than in the first slice.

**Independent Test**: As an instructor, delete a course with no enrollments and confirm it disappears
after a confirmation; attempt to delete a course with enrolled students and confirm the confirmation
names the loss-of-access consequence before proceeding; confirm a non-owner cannot delete a course.

**Acceptance Scenarios**:

1. **Given** a course the instructor owns with no enrollments, **When** they choose delete and confirm,
   **Then** the course is permanently removed and disappears from My Courses.
2. **Given** a course the instructor owns that has enrolled students, **When** they choose delete,
   **Then** a confirmation explicitly warns that the course and its content will be permanently removed
   and enrolled students will immediately lose access, and the deletion proceeds only on explicit
   confirmation.
3. **Given** any delete confirmation, **When** the instructor cancels, **Then** nothing is changed.
4. **Given** a course owned by a different instructor, **When** a delete is attempted via a guessed ID,
   **Then** the request is refused and no course is deleted.

---

### Edge Cases

- **Not-owner access by ID.** Any attempt to view, edit, or delete a course the instructor does not own —
  including via a deep link or guessed ID — must be refused with no course data exposed, governed by the
  backend ownership scoping (defense in depth), and surfaced in the UI as a clear not-found/forbidden
  state rather than a crash.
- **Instructor without an instructor profile.** A staff account that reaches these pages but lacks an
  instructor profile must be handled gracefully (a clear message / safe redirect), never a crash or
  server error, consistent with 003's FR-008.
- **Empty catalogue.** An instructor with zero courses sees a dedicated empty state with a single primary
  "create your first course" call to action, not an empty grid.
- **Invalid price.** Price must be a non-negative monetary value within the field's supported range;
  values that are negative, non-numeric, or exceed the allowed magnitude are rejected inline. A price of
  zero is permitted (a free course).
- **Category / level outside the allowed set.** Only the platform's defined categories and levels are
  selectable; a value outside the allowed set is rejected.
- **Thumbnail upload issues.** A too-large or non-image thumbnail is rejected with a clear message; the
  rest of the form's entered values are preserved.
- **Concurrent edits.** If the same course is edited from two places, the last successful save wins; the
  feature does not introduce optimistic-locking or versioning (consistent with the no-versioning stance
  in the discovery document).
- **Network / server failure on any action.** Create, edit, and delete failures surface a clear,
  non-technical error and leave the instructor's data and the course's state intact and retry-able.
- **Draft visibility.** A draft course must never appear in any student-facing or public list; it is
  visible only to its owning instructor (and admin), consistent with existing draft-visibility rules.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a My Courses view that lists every course owned by the signed-in
  instructor, including both draft and published courses, and MUST NOT include any course owned by
  another instructor.
- **FR-002**: Each course in the My Courses list MUST display its thumbnail, title, and a status badge
  distinguishing Draft from Published, along with quick actions to edit and to open (manage) the course.
- **FR-003**: The My Courses view MUST let the instructor filter the list by status (All / Published /
  Draft) and search the list by course title. Filtering and search MUST be performed client-side over the
  instructor's full owned-course list (fetched once); the list is not paginated and no server-side
  filter/search is added.
- **FR-004**: When the instructor owns no courses, the My Courses view MUST show a dedicated empty state
  with a single primary action to create the first course, rather than an empty grid.
- **FR-005**: The system MUST provide a create-course form capturing title, description, price, category,
  level, language, and learning goals, and MUST create the course as a **draft** (unpublished) owned by
  the signed-in instructor. Learning goals MUST be entered as a repeatable list of short text-input rows
  (add/remove) submitted as an array of strings — one goal per item.
- **FR-006**: The create-course form MUST validate input before submission and present clear inline,
  field-level error messages; required fields are title, description, price, category, and level, while
  thumbnail, language, and learning goals are optional at draft creation.
- **FR-007**: On successful course creation, the system MUST route the instructor to that course's
  workspace so they can continue building it.
- **FR-008**: The system MUST provide an edit-course experience — on a dedicated edit route reusing the
  create form component — that updates a course's metadata (title, description, price, category, level,
  language, learning goals) and allows replacing its thumbnail image, persisting changes for the owning
  instructor only. The Overview tab MUST remain read-only and link to this route to edit.
- **FR-009**: The edit-course experience MUST apply the same validation rules and inline error
  presentation as the create form.
- **FR-010**: The system MUST enforce that an instructor can only view, edit, and delete courses they
  own; any attempt to act on another instructor's course (including by deep link or guessed ID) MUST be
  refused with no course data exposed, with the backend ownership scoping as the authoritative gate.
- **FR-011**: The system MUST provide a per-course workspace with a persistent tab bar (Overview,
  Curriculum, Analytics, Students, Reviews) and the course title as a breadcrumb root; the Overview tab
  MUST summarise the course (thumbnail, title, read-only status, key metadata) and provide access to edit
  it.
- **FR-012**: Workspace tabs whose features are delivered by later specs (Curriculum, Analytics,
  Students, Reviews) MUST render a clear placeholder state rather than an error or blank page.
- **FR-013**: The workspace Overview MUST display the course's publish status as **read-only**; the
  publish/unpublish action and its readiness validation are out of scope for this feature (delivered by a
  later spec) and any publish affordance shown MUST be a placeholder.
- **FR-014**: The system MUST allow an instructor to delete a course they own, and MUST require an
  explicit confirmation before deleting; when the course has enrolled students the confirmation MUST
  explicitly state that the course and its content will be permanently removed and enrolled students will
  immediately lose access.
- **FR-015**: Deleting a course MUST be permanent (consistent with the existing cascade behaviour) and
  MUST remove the course from the My Courses list; the feature MUST NOT introduce soft-delete, archive,
  or undo.
- **FR-016**: Every list, create, edit, workspace, and delete surface MUST present appropriate loading,
  empty, and retry-able error states rather than blank or broken pages.
- **FR-017**: The feature MUST reuse the existing instructor course API and its ownership scoping, the
  instructor shell and routing from spec 003, and the shared component library and design tokens; it MUST
  NOT introduce a new course data model or alter the student-facing course experience.
- **FR-018**: Draft courses created or edited here MUST remain invisible to students and the public,
  appearing only to the owning instructor (and admin).

### Key Entities *(include if feature involves data)*

- **Course (existing)**: The unit an instructor authors and manages. Key attributes surfaced here:
  title, description, thumbnail, price, category, level, language, learning goals, and publish status
  (draft/published, read-only in this feature). Owned by exactly one instructor; ownership determines who
  may view, edit, or delete it. No new fields are added by this feature.
- **Instructor profile (existing)**: The record that owns an instructor's courses and scopes every
  course action to that instructor. Its presence is required for these pages to function; its absence is
  handled gracefully.
- **Enrollment (existing, referenced)**: Whether a course has enrolled students determines which delete
  confirmation is shown; enrollment data is read only to inform that warning, not modified by this
  feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the courses shown in My Courses belong to the signed-in instructor; a course owned
  by another instructor appears 0 times, including under filtering and search.
- **SC-002**: An instructor can create a new draft course from an empty state and reach its workspace in
  under 2 minutes, with the new course owned by them and marked as a draft.
- **SC-003**: 100% of create and edit submissions with invalid input are blocked client-side with
  field-level error messages, and 0 invalid courses are persisted.
- **SC-004**: 100% of attempts by an instructor to view, edit, or delete a course they do not own are
  refused with no course data exposed, verified independently of frontend routing.
- **SC-005**: Metadata and thumbnail edits persist and are reflected across My Courses and the workspace
  in 100% of successful saves, confirmed on reload.
- **SC-006**: 100% of course deletions require an explicit confirmation before removal, and 100% of
  deletions of a course with enrolled students present a confirmation that names the loss-of-access
  consequence; accidental one-click deletions occur 0 times.
- **SC-007**: Every course-management surface (list, create, edit, workspace, delete) shows a defined
  loading, empty, or error state as appropriate in 100% of those conditions, with 0 blank or crashed
  pages.
- **SC-008**: 0 draft courses created or edited through this feature appear in any student-facing or
  public listing.

## Assumptions

- **Backend is ready and reused as-is.** The ownership-scoped instructor course endpoints already support
  full CRUD (list/retrieve/create/update/partial-update/delete), filter to the caller's own courses, and
  bind ownership on create. This feature adds **no new backend course model or endpoint**; any minor
  serializer accommodation (if needed) must not change the student-facing course shape.
- **Publishing is a later spec.** Courses are created and remain drafts here; the publish/unpublish
  action and its readiness gate are delivered by spec 007. The Overview shows status read-only, and any
  publish affordance is a placeholder that will route to the 007 experience.
- **Curriculum and video are later specs.** Building sections/lectures/quizzes (spec 005) and uploading
  lecture video (spec 006) are out of scope; the workspace hosts them as placeholder tabs, mirroring how
  003 handled sidebar destinations.
- **Field set follows the existing course model.** Allowed categories and levels are the platform's
  existing defined sets; price is a non-negative monetary value within the model's supported range (zero
  allowed for free courses); learning goals are an optional list. Exact validation limits follow the
  existing model constraints.
- **Foundation from 003 is in place.** Role-aware routing, the instructor shell/sidebar, and the graceful
  "instructor without profile" handling from spec 003 are assumed present; this feature fills the My
  Courses destination and the course workspace within that shell.
- **Reuse over rebuild.** The instructor-courses UI is a new feature module built from the existing
  component library, design tokens, forms/validation approach, data-fetching, and error-handling patterns
  the student side already established; no new global state or infrastructure is introduced.
- **Deletion semantics.** Deletion is irreversible and cascades to course content per the existing model
  behaviour; no soft-delete, archive, duplicate, or undo is introduced (those are noted as future work in
  the discovery roadmap).

## Dependencies

- **Spec 003 (instructor foundation)** — role-aware routing and the instructor shell/sidebar this
  feature's pages render inside, plus the graceful no-instructor-profile handling.
- **The existing instructor course API** — the ownership-scoped CRUD endpoints and their authorization,
  which provide the defense-in-depth ownership guarantee this feature relies on.
- **The existing direct-to-Cloudinary image-upload flow** (the signed-upload path used today for profile
  pictures), reused for course thumbnail upload/replace so images go straight to the media host rather than
  through the application server.
- **The shared component library, design tokens, data-fetching, and validation conventions** established
  by the student experience.
- **Enrollment data (read-only)** — consulted only to decide which delete confirmation to present.

## Out of Scope

- **Publishing**: the publish/unpublish action and publish-readiness validation (spec 007). Status is
  read-only here.
- **Curriculum building**: sections, lectures, quizzes, and their ordering (spec 005).
- **Video upload and processing** (spec 006).
- **Course analytics, student roster, and reviews feed** inside the workspace — these tabs are
  placeholders here and delivered by specs 008–012.
- **Instructor public-profile editing** (spec 011) and **earnings** (spec 013).
- **Soft-delete, archive, duplicate, versioning, and bulk operations** on courses (future/hardening
  work).
- **Any change to the student-facing course discovery, detail, enrollment, or player experience.**
