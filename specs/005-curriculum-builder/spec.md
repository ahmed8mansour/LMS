# Feature Specification: Instructor Curriculum Builder — Sections, Lectures & Quizzes

**Feature Branch**: `005-curriculum-builder`
**Created**: 2026-08-27
**Status**: Draft
**Input**: User description: "read planning/instructor-experience-discovery.md — the 005 spec for the instructor experience: curriculum builder (sections / lectures / quizzes authoring) on the existing instructor content API, with wireframes provided."

## Overview

Spec 004 gave instructors their **My Courses** surface and a per-course workspace — but every course
created there is an empty shell. Its Curriculum tab is still a placeholder. This feature makes that tab
**real**: it lets an instructor build the actual teaching structure inside a course they own —
**sections**, the **lectures** within them, and an optional **quiz** per section with its questions and
answers.

Concretely, this feature makes four things true for an instructor inside a course workspace:

1. **They can structure the course into sections** — add a section, rename it, reorder sections by
   dragging, and delete one — with ordering that always stays consistent.
2. **They can fill each section with lectures** — add a lecture with a title and duration, edit those
   details, reorder lectures within their section, and delete a lecture. Each lecture row shows its
   current video status (so the instructor can see what still needs a video), but **uploading the video
   itself is a later spec (006)**; here the video slot is a clearly-labelled placeholder.
3. **They can author a quiz for a section** — create the section's single quiz, add and edit questions,
   add multiple-choice answers to each question, mark exactly one choice correct, reorder questions, and
   delete questions or choices.
4. **They see the whole curriculum at a glance** — an accordion of sections with their lecture and quiz
   rows, live counts, and inline status — so the shape of the course is legible as it is built.

The backend is **partly ready**: the ownership-scoped `InstructorSectionViewSet`,
`InstructorLectureViewSet`, and `InstructorQuizViewSet` already support full CRUD on
`/courses/instructor/{sections,lectures,quizzes}/`, each filtered to the caller's own courses and
enforcing ownership on create. What is **missing** is any instructor-facing way to manage **questions and
choices** (no endpoint, serializer, or model access exists for them today). This feature therefore adds a
**thin, ownership-scoped backend surface for questions and choices** (mirroring the existing instructor
viewset pattern) and makes **reordering conflict-safe by reusing the existing per-item update path within
a transaction — no new batch-reorder endpoint is introduced**, while the bulk of the work remains a new
frontend curriculum-builder feature module composed from the existing component library and the patterns
004 established.

This feature is deliberately **scoped to authoring the content structure**. It does **not** implement
**video upload/processing** (spec 006 — the lecture's video slot is a placeholder here), the **publish
action or its readiness gate** (spec 007 — building curriculum is what later makes a course publishable,
but publishing is out of scope), or any **analytics, roster, or reviews** tab. Courses remain drafts
throughout.

## Clarifications

### Session 2026-08-27

- Q: The backend has no instructor endpoints for quiz **questions** and **choices** — is adding them part
  of this spec, or is quiz authoring deferred? → A: Adding them is **in scope**. This spec introduces a
  thin, ownership-scoped backend surface for questions and choices, following the existing instructor
  section/lecture/quiz viewset pattern (queryset filtered through the owning course, ownership enforced on
  create). Quiz authoring is a first-class part of the curriculum builder, exactly as the discovery
  document (§5 US-05) and the wireframes place it.
- Q: Does this spec include the lecture **video upload** UI shown on the Lecture Editor wireframe? → A:
  No. Uploading, processing, and status polling for lecture video are delivered by spec 006. Here a
  lecture can be created and edited (title, duration) and its current video status is **displayed**
  (read-only, sourced from the existing field), but the uploader itself is a placeholder that routes to
  the 006 experience when it lands.
- Q: Can a lecture be dragged from one section into a different section, or only reordered within its own
  section? → A: **Within-section only.** Lectures are reordered strictly inside their own section;
  moving a lecture to a different section (reparenting) is out of scope for this spec and noted as future
  work. This keeps every reorder scoped to a single parent.
- Q: How does the instructor enter and see a lecture's duration? → A: As **minutes:seconds (mm:ss)** —
  e.g. `4:20` — matching the wireframe and the instructor's mental model. It is validated as a time value
  and stored in the course model's existing duration field; the instructor never enters a raw decimal.
- Q: How is reordering of sections/lectures made safe given the unique ordering constraint per parent? →
  A: Via **per-item updates to the order field, performed transactionally** so intermediate states never
  leave two items sharing a position or a gap. **No new batch-reorder endpoint is introduced** — the
  existing per-item update path is reused and sequenced/wrapped so the renumber within a single parent is
  collision-free.
- Q: The quiz record carries a question-count value — who keeps it correct as questions are added or
  removed? → A: **The system maintains it automatically (server-side).** The count is recomputed whenever
  a question is added or deleted; the instructor and the client never set it — it is effectively
  read-only to the instructor.
- Q: Can a section hold more than one quiz? → A: No. Each section has **at most one quiz** (the existing
  one-quiz-per-section relationship is preserved). The builder offers "Add quiz" only when a section has
  none, and "Edit quiz" thereafter.
- Q: Is there a minimum a question must have before it can be saved as valid? → A: A question MUST have
  question text and **at least two choices**, with **exactly one** marked correct, to be considered
  complete. Incomplete questions may exist while editing but are surfaced as needing attention, and a
  quiz's completeness is what a later publish-readiness check (spec 007) will consult.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Structure a course into sections (Priority: P1)

Inside a course they own, an instructor opens the **Curriculum** tab and builds the course's backbone.
They add a section by name, rename it, drag sections into the order they want, and delete a section they
no longer need. The curriculum always presents sections in a single, consistent order, and an
empty course invites them to add their first section.

**Why this priority**: Sections are the top-level structure everything else hangs from — without them
there is nowhere to put a lecture or a quiz. This is the minimum viable slice of "build my curriculum"
and is independently demonstrable on its own.

**Independent Test**: Open an owned course's Curriculum tab, add several sections, rename one, drag to
reorder them and confirm the new order persists on reload, delete one and confirm it is removed; open a
brand-new course and confirm the "add your first section" empty state.

**Acceptance Scenarios**:

1. **Given** a course the instructor owns with no sections, **When** they open the Curriculum tab,
   **Then** a dedicated empty state invites them to add the first section rather than showing an empty
   page.
2. **Given** the Curriculum tab, **When** the instructor adds a section with a title, **Then** it appears
   as a new section at the end of the curriculum, owned within their course.
3. **Given** existing sections, **When** the instructor drags a section to a new position, **Then** the
   sections are renumbered consistently and the new order persists on reload with no duplicate or gapped
   positions.
4. **Given** a section, **When** the instructor renames it and saves, **Then** the new title is reflected
   throughout the curriculum.
5. **Given** a section the instructor chooses to delete, **When** they confirm, **Then** the section and
   its lectures and quiz are removed and the remaining sections stay consistently ordered.
6. **Given** a course owned by a different instructor, **When** the instructor attempts to add or modify a
   section in it by guessed ID or deep link, **Then** the request is refused and no data is exposed or
   changed.

---

### User Story 2 - Add and order lectures within a section (Priority: P1)

Within a section, an instructor adds lectures — each with a title and a duration — edits those details,
drags lectures into order within their section, and deletes lectures. Each lecture row shows its current
**video status** (e.g. no video yet / processing / ready / failed) so the instructor knows what still
needs a video, but attaching the video is handled by a later feature; here the video slot is a labelled
placeholder.

**Why this priority**: Lectures are the actual teaching units students consume; a course structure with
sections but no lectures teaches nothing. Together with Story 1 this delivers the core "structure the
course" value, so it ships in the first slice.

**Independent Test**: In an owned course's section, add lectures with titles and durations, edit a
lecture's title and duration, reorder lectures within the section and confirm the order persists, delete a
lecture; confirm each row shows a video-status indication and that the video slot is a placeholder (no
upload occurs in this feature).

**Acceptance Scenarios**:

1. **Given** a section with no lectures, **When** the instructor adds a lecture with a title and duration,
   **Then** it appears at the end of that section's lecture list.
2. **Given** several lectures in a section, **When** the instructor drags one to a new position, **Then**
   the lectures are renumbered consistently within that section and the order persists on reload.
3. **Given** a lecture, **When** the instructor edits its title and/or duration and saves, **Then** the
   changes persist and are reflected in the curriculum.
4. **Given** any lecture row, **When** the curriculum renders, **Then** the lecture's current video status
   is displayed read-only, and the means to add/replace the video is presented as a placeholder that will
   be enabled by the video-upload feature.
5. **Given** a lecture the instructor deletes, **When** they confirm, **Then** it is removed and the
   section's remaining lectures stay consistently ordered.
6. **Given** invalid lecture input (e.g. empty title, or a non-positive / non-numeric duration), **When**
   the instructor tries to save, **Then** the save is blocked with a clear inline error.

---

### User Story 3 - Author a section quiz (Priority: P2)

For a section, an instructor creates its single quiz, then adds questions, gives each question two or more
multiple-choice answers, marks exactly one answer correct per question, reorders questions, and edits or
deletes questions and choices. The quiz editor makes it obvious which choice is correct and which
questions are still incomplete.

**Why this priority**: Quizzes turn passive content into assessment and are part of the authoring MVP, but
they are the heaviest slice (they need net-new backend for questions and choices) and a course is already
meaningfully structured with sections and lectures alone — so quiz authoring ranks just below the
structural stories and can ship as a self-contained follow-on within this feature.

**Independent Test**: In an owned section, add a quiz, add a question with three choices and mark one
correct, reorder questions, edit a choice's text, remove a choice, delete a question; confirm a question
with fewer than two choices or with no correct choice is flagged as incomplete; confirm a second quiz
cannot be added to the same section.

**Acceptance Scenarios**:

1. **Given** a section with no quiz, **When** the instructor adds a quiz, **Then** the section gains a
   single quiz and the "add quiz" affordance is replaced by "edit quiz"; the section cannot receive a
   second quiz.
2. **Given** a quiz, **When** the instructor adds a question with text and two or more choices and marks
   exactly one correct, **Then** the question is saved as complete and appears in the quiz.
3. **Given** a question, **When** the instructor marks a different choice correct, **Then** exactly one
   choice is correct — the previously-correct choice is no longer correct.
4. **Given** several questions, **When** the instructor reorders them, **Then** the new question order
   persists on reload.
5. **Given** a question with fewer than two choices, or with no choice marked correct, **When** the quiz
   is viewed, **Then** that question is clearly flagged as incomplete (needing attention) rather than
   silently accepted as finished.
6. **Given** a question or choice the instructor deletes, **When** they confirm, **Then** it is removed
   and the quiz's remaining questions stay consistently ordered.
7. **Given** a quiz or question owned (through its course) by a different instructor, **When** the
   instructor attempts to modify it by guessed ID, **Then** the request is refused and no data is exposed.

---

### User Story 4 - Delete content that enrolled students depend on (Priority: P2)

When an instructor deletes a section, lecture, or quiz in a course that already has enrolled students,
they are warned that the deletion is permanent, cascades to the item's contents, and immediately changes
what enrolled students can access. For a course with no enrollments, a lighter confirmation is enough. The
instructor can always cancel with nothing changed.

**Why this priority**: Guard-rails against destructive edits matter for trust, but they wrap the core
authoring actions rather than being the point of them, so they ship alongside the CRUD they protect rather
than first. This mirrors the deletion guard established for whole courses in spec 004.

**Independent Test**: Delete a lecture from a course with no enrollments and confirm a light confirmation;
delete a section from a course with enrolled students and confirm the confirmation names the
loss-of-access and cascade consequence before proceeding; cancel a deletion and confirm nothing changed.

**Acceptance Scenarios**:

1. **Given** content in a course with enrolled students, **When** the instructor chooses to delete a
   section, lecture, or quiz, **Then** a confirmation explicitly warns that the item and everything under
   it will be permanently removed and enrolled students will immediately lose access to it, and the
   deletion proceeds only on explicit confirmation.
2. **Given** content in a course with no enrollments, **When** the instructor deletes it, **Then** a
   lighter confirmation is sufficient.
3. **Given** any delete confirmation, **When** the instructor cancels, **Then** nothing is changed.

---

### Edge Cases

- **Reorder conflicts.** Because each section's position within its course, and each lecture's position
  within its section, must be unique, reordering MUST persist per-item order changes within a transaction
  so intermediate states never leave two items sharing a position or a gap in the sequence, even if two
  edits arrive close together. Lectures reorder only within their own section (no cross-section move).
- **Not-owner access by ID.** Any attempt to add, view, edit, reorder, or delete a section, lecture, quiz,
  question, or choice in a course the instructor does not own — including via deep link or guessed ID —
  MUST be refused with no data exposed, governed by backend ownership scoping (defense in depth) and
  surfaced as a clear not-found/forbidden state rather than a crash.
- **Instructor without an instructor profile.** A staff account reaching these pages without an instructor
  profile MUST be handled gracefully (clear message / safe redirect), never a crash, consistent with
  003's handling.
- **Empty states everywhere.** A course with no sections, a section with no lectures, a section with no
  quiz, and a quiz with no questions each show a focused empty state with the relevant single action,
  never a blank region.
- **Second quiz on a section.** Because a section holds at most one quiz, the "add quiz" action MUST be
  unavailable once a quiz exists; an attempt to create a second quiz for the same section MUST be refused.
- **Incomplete quiz content.** A question with no text, fewer than two choices, or without exactly one
  correct choice is allowed to exist mid-edit but MUST be surfaced as incomplete; it MUST NOT be presented
  as a finished, valid question.
- **Duration validity.** Lecture duration is entered as mm:ss and MUST resolve to a positive value within
  the supported range; malformed (non-mm:ss), zero, negative, or out-of-range values are rejected inline
  with the entered values preserved.
- **Video slot in this feature.** A lecture's video is not uploadable here; the video status is shown
  read-only and the upload control is a placeholder — no upload, replace, or retry occurs within this
  feature.
- **Network / server failure on any action.** Add, rename, reorder, edit, and delete failures on any
  curriculum item MUST surface a clear, non-technical error and leave the curriculum and the instructor's
  input intact and retry-able, with no partial or ambiguous ordering left behind.
- **Draft stays hidden.** Building curriculum never publishes anything; the course and its new content
  remain invisible to students and the public until a later publish action, and a draft's curriculum is
  visible only to its owning instructor (and admin).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide, on a course's Curriculum tab, a view of the whole curriculum as an
  ordered list of sections, each showing its lectures and its quiz (if any) with inline status, scoped
  strictly to the signed-in instructor's own course.
- **FR-002**: The system MUST let the instructor add a section (with a title), rename a section, and
  delete a section within a course they own.
- **FR-003**: The system MUST let the instructor reorder sections within a course, persisting the
  reordered positions transactionally (via the existing per-item update path, not a new batch endpoint) so
  that section positions remain unique and gap-free and the new order persists.
- **FR-004**: The system MUST let the instructor add a lecture (with a title and duration) to a section,
  edit a lecture's title and duration, and delete a lecture, within a course they own. Duration MUST be
  entered and displayed as **minutes:seconds (mm:ss)** (e.g. `4:20`) and stored in the course model's
  existing duration field.
- **FR-005**: The system MUST let the instructor reorder lectures **within their own section** (moving a
  lecture to a different section is out of scope), persisting the reordered positions transactionally (via
  the existing per-item update path, not a new batch endpoint) so that lecture positions within the
  section remain unique and gap-free and the new order persists.
- **FR-006**: Each lecture row MUST display the lecture's current video status (read-only) and MUST
  present the video-attachment affordance as a placeholder; the system MUST NOT upload, replace, process,
  or poll lecture video in this feature (that is delivered by spec 006).
- **FR-007**: The system MUST let the instructor create a **single** quiz for a section that has none, and
  MUST prevent a second quiz from being added to the same section; once a quiz exists the interface MUST
  offer editing it rather than adding another.
- **FR-008**: The system MUST let the instructor add, edit, reorder, and delete **questions** within a
  quiz, and add, edit, and delete **choices** within a question, for quizzes in courses they own.
- **FR-009**: The system MUST let the instructor mark exactly **one** choice per question as correct;
  marking a new choice correct MUST unset any previously-correct choice for that question.
- **FR-009a**: The system MUST maintain a quiz's question count automatically as questions are added or
  removed; it MUST be read-only to the instructor (never entered or submitted by the client) and MUST
  always reflect the actual number of questions in the quiz.
- **FR-010**: The system MUST treat a question as complete only when it has question text, at least two
  choices, and exactly one correct choice, and MUST clearly surface questions that do not meet this bar as
  incomplete (needing attention) without blocking mid-edit saving of partial content.
- **FR-011**: The system MUST validate curriculum input before submission and present clear inline,
  field-level errors — including required section/lecture/question/choice text and a lecture duration
  entered as mm:ss that resolves to a positive, in-range value.
- **FR-012**: The system MUST enforce that an instructor can only add, view, edit, reorder, or delete
  curriculum content within courses they own; any attempt to act on another instructor's content
  (including by deep link or guessed ID) MUST be refused with no data exposed, with backend ownership
  scoping as the authoritative gate.
- **FR-013**: The system MUST require an explicit confirmation before deleting any section, lecture, quiz,
  question, or choice; when the containing course has enrolled students, the confirmation for deleting a
  section, lecture, or quiz MUST explicitly state that the item and its contents will be permanently
  removed and enrolled students will immediately lose access.
- **FR-014**: Deletions MUST be permanent and cascade to contained content per the existing model
  behaviour; the feature MUST NOT introduce soft-delete, archive, versioning, or undo for curriculum
  content.
- **FR-015**: Every curriculum surface (whole curriculum, per-section, lecture editor, quiz editor) MUST
  present appropriate loading, empty, and retry-able error states rather than blank or broken pages,
  including focused empty states for a course with no sections, a section with no lectures, a section with
  no quiz, and a quiz with no questions.
- **FR-016**: The feature MUST reuse the existing instructor section/lecture/quiz endpoints and their
  ownership scoping, the course workspace and tab bar from spec 004, and the shared component library and
  design tokens; it MUST add only a thin, ownership-scoped backend surface for **questions and choices**,
  reusing the existing per-item update path (wrapped transactionally) for reordering rather than
  introducing a new batch-reorder endpoint, and MUST NOT alter the student-facing course, curriculum, or
  player experience.
- **FR-017**: Curriculum content created or edited here MUST remain part of a draft course and invisible
  to students and the public, appearing only to the owning instructor (and admin); building curriculum
  MUST NOT publish the course or change its publish status.
- **FR-018**: The Curriculum tab MUST reflect live structure — section, lecture, and question counts and
  per-item status — so that additions, reorderings, and deletions are visible without a manual refresh.

### Key Entities *(include if feature involves data)*

- **Section (existing)**: A top-level division of a course, holding an ordered list of lectures and at
  most one quiz. Key attributes: title and a position that is unique within its course. Belongs to exactly
  one course; ownership flows from that course.
- **Lecture (existing)**: A teaching unit within a section. Key attributes: title, duration (entered and
  shown as mm:ss, stored in the existing duration field), position (unique within its section), and a
  video status that is displayed but not changed by this feature.
- **Quiz (existing)**: The single assessment attached to a section. Holds a set of questions; a section
  has at most one quiz. Carries a question count that the system maintains automatically (read-only to the
  instructor) as questions are added or removed.
- **Question (existing model, newly manageable)**: A prompt within a quiz, with text and a position within
  the quiz, holding a set of choices. No instructor-facing management exists for it today; this feature
  adds it.
- **Choice (existing model, newly manageable)**: A possible answer to a question, with text and a
  correct/incorrect flag. Exactly one choice per question is correct. No instructor-facing management
  exists for it today; this feature adds it.
- **Course (existing, referenced)**: The ownership root; every curriculum action is scoped to a course the
  instructor owns, and the course stays a draft throughout.
- **Enrollment (existing, referenced)**: Whether the containing course has enrolled students determines
  which delete confirmation is shown; read only to inform that warning, never modified here.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can take a newly-created draft course from zero sections to a structure of at
  least two sections, each with at least two ordered lectures, entirely from the Curriculum tab in under 5
  minutes.
- **SC-002**: 100% of section and lecture reorder operations leave positions unique and gap-free, with the
  displayed order matching the persisted order on reload; duplicate or gapped orderings occur 0 times.
- **SC-003**: 100% of add/edit submissions with invalid input (empty required text, invalid duration) are
  blocked with field-level messages, and 0 invalid curriculum items are persisted.
- **SC-004**: Across all quizzes, every question has at most one correct choice, and any question with
  fewer than two choices or no correct choice is flagged incomplete in 100% of cases.
- **SC-005**: 100% of attempts by an instructor to add, view, edit, reorder, or delete curriculum content
  in a course they do not own are refused with no data exposed, verified independently of the frontend.
- **SC-006**: A section can hold no more than one quiz in 100% of cases; attempts to create a second quiz
  on a section succeed 0 times.
- **SC-007**: 100% of deletions require explicit confirmation, and 100% of deletions of a section,
  lecture, or quiz in a course with enrolled students present a confirmation naming the loss-of-access
  consequence; accidental one-click deletions occur 0 times.
- **SC-008**: Every curriculum surface shows a defined loading, empty, or error state as appropriate in
  100% of those conditions, with 0 blank or crashed pages.
- **SC-009**: 0 pieces of curriculum content created or edited through this feature appear in any
  student-facing or public listing, and building curriculum changes a course's publish status 0 times.

## Assumptions

- **Backend is partly ready; a thin surface is added.** The ownership-scoped instructor
  section/lecture/quiz endpoints already support full CRUD, filter to the caller's own courses, and
  enforce ownership on create. No equivalent exists for **questions** and **choices**, so this feature
  adds them following the same pattern (queryset filtered through the owning course, ownership enforced on
  create). Reordering reuses the existing per-item order-update path wrapped in a transaction (no new
  batch-reorder endpoint), and the quiz's question count is maintained automatically server-side. Any
  serializer work must not change the student-facing content shape.
- **Video upload is a later spec.** Lecture video upload, processing, status polling, replace, and retry
  are delivered by spec 006. Here the lecture's video status is shown read-only and the uploader is a
  placeholder that will route to the 006 experience.
- **Publishing is a later spec.** Building curriculum is a precondition for publishing but does not publish
  anything; the publish action and its readiness gate (which will consult curriculum completeness) are
  spec 007. Courses stay drafts.
- **One quiz per section, existing quiz shape.** The existing one-quiz-per-section relationship, the
  question/choice model shape, and the existing quiz pass semantics are preserved; this feature only adds
  the ability to author them.
- **Ordering constraints follow the existing model.** Sections are uniquely ordered within a course and
  lectures uniquely ordered within a section; reordering respects those constraints via transactional
  per-item updates. Lectures reorder only within their own section (no cross-section reparenting).
  Question ordering within a quiz follows the existing question position field.
- **Duration is entered as mm:ss.** Lecture duration is captured and displayed as minutes:seconds and
  resolved to the existing decimal duration field; instructors never type a raw decimal.
- **Foundation from 003 and 004 is in place.** Role-aware routing, the instructor shell, the course
  workspace and its tab bar, and graceful "instructor without profile" handling are assumed present; this
  feature fills the Curriculum tab and its editors within that workspace.
- **Reuse over rebuild.** The curriculum-builder UI is a new feature module built from the existing
  component library, design tokens, forms/validation, data-fetching, and error-handling patterns; new
  view-local UI state (e.g. builder open/reorder state) is acceptable, but no new global state framework
  or infrastructure is introduced.
- **Deletion semantics.** Deletion is irreversible and cascades per existing model behaviour; no
  soft-delete, archive, duplicate, or undo is introduced.

## Dependencies

- **Spec 004 (instructor course management)** — the course workspace, its persistent tab bar, and the
  Curriculum tab placeholder this feature replaces, plus My Courses as the entry point.
- **Spec 003 (instructor foundation)** — role-aware routing, the instructor shell/sidebar, and graceful
  no-instructor-profile handling.
- **The existing instructor section/lecture/quiz endpoints** — ownership-scoped CRUD providing the
  defense-in-depth ownership guarantee this feature relies on and extends the same pattern for
  questions/choices.
- **The existing lecture video-status field** — read to display each lecture's video state; not written by
  this feature.
- **The shared component library, design tokens, data-fetching, and validation conventions** established
  by the student experience and reused in 004.
- **Enrollment data (read-only)** — consulted only to decide which delete confirmation to present.

## Out of Scope

- **Video upload and processing** — selecting, uploading, replacing, retrying, and polling lecture video
  (spec 006). The video slot is a placeholder here.
- **Publishing** — the publish/unpublish action and publish-readiness validation (spec 007). Curriculum
  completeness is built here but never gates or triggers publishing in this feature.
- **Course metadata create/edit and the My Courses list** — delivered by spec 004; this feature operates
  inside an already-created course.
- **Course analytics, student roster, and reviews** tabs in the workspace — placeholders here, delivered
  by later specs.
- **Changing quiz-taking, scoring, or the student player** — this feature only authors quiz content; how
  students take quizzes is unchanged.
- **Moving a lecture between sections** (cross-section reparenting) and any **batch/bulk reorder
  endpoint** — reordering here is within-section only, via transactional per-item updates.
- **Soft-delete, archive, duplicate, versioning, and bulk operations** on curriculum content
  (future/hardening work).
- **Any change to the student-facing course discovery, detail, enrollment, curriculum-preview, or player
  experience.**
