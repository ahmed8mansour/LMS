# Feature Specification: Instructor Student Roster — Who Is Enrolled and How Far They Have Got

**Feature Branch**: `010-instructor-students`
**Created**: 2026-09-20
**Status**: Draft
**Input**: User description: "read the planning/instructor-experience-discovery.md, we've done with the 009
now it's 010's turn. This spec info: instructor can see the student names and pfp, enrolled_date, their
progress for this course; instructor can search for the students using their name; instructor can paginate
between the lists of the students. UI/UX frames:
https://claude.ai/code/artifact/46addddf-c7d7-47b8-a58c-6dc7d9fa8cc5"

## Overview

Spec 009 told the instructor how their students behave **in aggregate** — what share complete, where they get
stuck — and deliberately kept every student anonymous. It answers "how is this course doing?" but not the
question an instructor asks the moment a student emails them: **"who is actually in my course, and how far
have they got?"**

This feature adds the **student roster**: a plain, searchable, paginated list of the people enrolled in the
instructor's courses. Each row shows a student's **profile picture**, **name**, **enrolment date**, and
**progress through the course**. Nothing else — no contact details, no per-lecture breakdown, no actions.

It appears in two places:

- **Per course** — the **Students** tab of the course workspace, listing that course's students. This is the
  primary view and the one the user description describes.
- **Across all courses** — the **Students** page in the instructor sidebar, listing every enrolment across
  every course the instructor owns, with a course column. This page exists today only as a placeholder.

The roster is **read-only** and **ownership-scoped**: an instructor sees the students of their own courses and
no one else's. Everything shown is derived from data the platform already holds (enrolments and lecture
progress); this feature stores nothing new and changes nothing.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See who is enrolled in a course (Priority: P1)

An instructor opens a course's workspace and selects the **Students** tab. A table lists the students enrolled
in that course — each with their profile picture, their name, the date they enrolled, and a progress bar with
the percentage of the course they have completed. The header states how many students the course has. The most
recently enrolled students appear first.

**Why this priority**: This is the feature. It is discovery US-09 exactly, and every other story in this spec
(search, paging, the cross-course view) is a way of navigating this same list. It is independently valuable on
its own: an instructor with a small course needs nothing else.

**Independent Test**: For a course with a known set of enrolments (including refunded ones), students with and
without profile pictures, and known lecture completions, open its Students tab and confirm every row's name,
picture, enrolment date, and progress match the underlying data under FR-006 – FR-013, and that the row order
and the header count are as specified.

**Acceptance Scenarios**:

1. **Given** a course the instructor owns with active enrolments, **When** they open its Students tab,
   **Then** they see one row per enrolled student showing profile picture, name, enrolment date, and progress,
   with the Students tab marked active in the course workspace tab bar.
2. **Given** a course with 318 active enrolments, **When** the roster loads, **Then** the header states 318
   students, and that number counts students, not rows on the current page.
3. **Given** a student who has completed 7 of the course's 10 current lectures, **When** the roster loads,
   **Then** their progress reads 70% and their progress bar is filled proportionally.
4. **Given** a student whose enrolment was refunded, **When** the roster loads, **Then** they do not appear in
   the list and are not counted in the header.
5. **Given** a student with no profile picture, **When** the roster loads, **Then** their row shows a
   placeholder in place of a picture and their name is still shown in full.
6. **Given** a student whose account has no first or last name, **When** the roster loads, **Then** their row
   shows their username rather than a blank name.
7. **Given** students who enrolled on known dates, **When** the roster loads, **Then** the most recently
   enrolled student appears first and the earliest last.
8. **Given** a course nobody has enrolled in, **When** the Students tab opens, **Then** it shows a clear "no
   students yet" state rather than an empty table with headers.

---

### User Story 2 - Find a student by name (Priority: P1)

The instructor types part of a student's name into the search box above the roster. The list narrows to the
students whose name matches, across the whole course, not just the page currently on screen. Clearing the box
restores the full roster.

**Why this priority**: Named explicitly in the user description, and without it the roster is unusable for the
case that actually brings an instructor here — a specific student who has asked them a question. A course with
hundreds of students cannot be searched by paging through it.

**Independent Test**: With a course whose students include names that share a prefix, differ only in case, and
include a student with no first/last name, type fragments into the search box and confirm the matching
behaviour, the result count, the reset to the first page, and the no-matches state under FR-014 – FR-020.

**Acceptance Scenarios**:

1. **Given** a roster with a student named "Maria Gomez", **When** the instructor types "mar", **Then** that
   student is listed, and students whose names do not contain "mar" are not.
2. **Given** a matching student who is on the fourth page of the unfiltered roster, **When** the instructor
   searches for their name, **Then** they appear in the results — search covers the whole course, not the
   current page.
3. **Given** a search term typed in lower case, **When** the results load, **Then** students whose names are
   stored in any capitalisation still match.
4. **Given** a search term matching a student's surname only, **When** the results load, **Then** that student
   matches — the search looks at first name, last name, the two together, and the username shown in their row.
5. **Given** the instructor is on page 5, **When** they change the search term, **Then** the results start
   again at the first page.
6. **Given** a search term that matches nobody, **When** the results load, **Then** the roster shows a "no
   students match" state that names the term and offers a way to clear it, distinct from the "no students yet"
   state.
7. **Given** an active search, **When** the instructor clears the box, **Then** the full roster returns.
8. **Given** an active search, **When** the instructor refreshes the page or opens the same link in a new tab,
   **Then** the same search term is still applied and still shown in the box.

---

### User Story 3 - Move through the roster page by page (Priority: P1)

The roster shows a fixed number of students at a time. The instructor moves to the next or previous page, and
can always see where they are in the list and how many students there are in total.

**Why this priority**: Named explicitly in the user description, and required for the roster to work at all on
a course with hundreds of students. Without it the page either truncates silently or loads everything.

**Independent Test**: With a course whose student count spans several pages, step forward and back through the
roster and confirm page size, position indicator, control states, address handling, and out-of-range behaviour
under FR-021 – FR-025.

**Acceptance Scenarios**:

1. **Given** a course with more students than fit on one page, **When** the roster loads, **Then** it shows
   the first page, states the position within the whole list (for example "1–20 of 318"), and offers a way to
   move to the next page.
2. **Given** the first page, **When** the roster loads, **Then** the control for the previous page is
   unavailable; **given** the last page, the control for the next page is unavailable.
3. **Given** the instructor is on page 2, **When** they move to page 3, **Then** the rows change to the next
   set of students with no duplicates and no students skipped between pages.
4. **Given** the instructor is on page 3, **When** they refresh the page or share the link, **Then** page 3 is
   shown again.
5. **Given** a link whose page number is beyond the last page or is not a valid page number, **When** it is
   opened, **Then** the first page is shown without an error.
6. **Given** a course whose students all fit on one page, **When** the roster loads, **Then** the position is
   still stated and no page control invites a move that does nothing.
7. **Given** an active search, **When** the instructor pages through the results, **Then** paging applies to
   the matching students only, and the stated total is the number of matches.

---

### User Story 4 - See every student across all my courses (Priority: P2)

The instructor selects **Students** in the sidebar and sees every enrolment across every course they own, each
row naming the course alongside the student, their enrolment date, and their progress in that course. The same
search and paging work here.

**Why this priority**: The sidebar already carries a Students item that today leads to a placeholder, and the
discovery document's page inventory lists this page. It is genuinely useful — "which of my courses is this
person in?" — but it is a convenience over the per-course roster, which is where an instructor works. It can
ship after User Stories 1–3 without changing them.

**Independent Test**: For an instructor owning several courses, including a student enrolled in more than one
of them and a course with no students, open the sidebar Students page and confirm row composition, the course
column, ordering, search, paging, and the empty states under FR-026 – FR-029.

**Acceptance Scenarios**:

1. **Given** an instructor who owns three courses with students, **When** they open the sidebar Students page,
   **Then** they see the students of all three courses in one list, each row naming its course, with the
   Students navigation item marked active.
2. **Given** a student enrolled in two of the instructor's courses, **When** the page loads, **Then** they
   appear once per course, each row carrying that course's enrolment date and that course's progress.
3. **Given** enrolments across courses with known dates, **When** the page loads, **Then** the most recent
   enrolment appears first regardless of which course it belongs to.
4. **Given** the instructor searches for a name, **When** the results load, **Then** matching students are
   shown from every course they own, with the same matching rules as the per-course roster.
5. **Given** an instructor who owns courses but has no students in any of them, **When** the page loads,
   **Then** it shows a "no students yet" state.
6. **Given** an instructor who owns no courses at all, **When** the page loads, **Then** it shows a state that
   points them at creating a course rather than an empty table.

---

### User Story 5 - Nobody sees another instructor's students (Priority: P1)

Only the owning instructor can see a course's roster. Another instructor, a student, or a signed-out visitor
is refused, whether they use the interface or address a course directly.

**Why this priority**: The roster names real people and shows how they are doing. Discovery §15.4 calls reading
another instructor's students the biggest risk in this area, and unlike a wrong number a leak here cannot be
taken back.

**Independent Test**: Request a course roster as its owner, as a different instructor, as a student, and while
signed out, directly and without the interface, and confirm only the owner is served and that the refusals are
indistinguishable from each other under FR-030 – FR-035.

**Acceptance Scenarios**:

1. **Given** a course owned by another instructor, **When** an instructor requests its roster directly,
   **Then** the request is refused and no student name, picture, date, or progress is returned.
2. **Given** a course that does not exist and a course owned by someone else, **When** each is requested,
   **Then** the two refusals are indistinguishable, so the roster cannot be used to discover which courses
   exist.
3. **Given** a signed-in student, **When** they request any roster, **Then** the request is refused.
4. **Given** a signed-out visitor, **When** they open any roster address, **Then** they are sent to sign in and
   no roster data is returned.
5. **Given** an instructor whose own courses have students, **When** the sidebar Students page loads, **Then**
   it contains enrolments from their own courses only.
6. **Given** a staff account with no instructor profile, **When** it requests a roster, **Then** it is refused
   cleanly with a meaningful message rather than an unhandled error.

---

### Edge Cases

- **A course with no lectures yet.** Progress cannot be expressed as a share of nothing. Rows show a neutral
  "—" rather than 0%, so an unbuilt course is never mistaken for a course nobody is learning.
- **A student who has completed everything.** Their row reads 100%; the roster does not distinguish "finished
  the lectures" from "passed every quiz" (see Assumptions).
- **A student enrols while the instructor is paging.** The roster is a snapshot taken when each page loads; a
  student arriving between pages may be missed or seen twice. Ordering is deterministic so this is bounded to
  genuinely concurrent changes, and a refresh resolves it.
- **A refund lands while the roster is open.** The student disappears on the next load; no stale row survives a
  refresh or a page change.
- **A student deletes their account or is removed.** Their enrolment disappears from the roster with them; no
  row shows a missing or blank student.
- **A student with a very long name, or a name in a non-Latin script.** The name is shown in full or truncated
  visibly without breaking the row, and search matches it the same way as any other name.
- **A search term of only spaces, or an extremely long one.** Treated as no search and as a term that matches
  nobody respectively; neither produces an error.
- **A search term containing characters used by search syntax** (`%`, `_`, quotes). Treated as literal
  characters to match, never as syntax.
- **A profile picture that fails to load or has been removed.** The row falls back to the placeholder rather
  than a broken image.
- **A course with a single student.** Progress and counts are shown plainly; no minimum-sample hiding.
- **An instructor with thousands of students.** The header count and paging stay correct and responsive; the
  page never loads the whole roster at once.
- **The last student on the last page is removed while it is open.** Moving or refreshing lands on a valid page
  rather than an empty one presented as an error.
- **A very narrow screen.** Every column's information stays reachable without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

#### Pages & layout

- **FR-001**: The course workspace's **Students** tab MUST show the roster for that single course, inside the
  existing workspace with its tab bar and breadcrumb, the Students tab marked active.
- **FR-002**: The instructor sidebar's **Students** item MUST open a roster covering every course the
  instructor owns, with the Students navigation item marked active, replacing today's placeholder.
- **FR-003**: Both views MUST present, in order: a header carrying the view's title and the total number of
  students, with the search box beside it; the roster itself; and the paging controls beneath it.
- **FR-004**: Each roster row MUST show the student's **profile picture**, **name**, **enrolment date**, and
  **progress** — the progress expressed both as a bar and as a percentage. The per-course view MUST show
  exactly these; the cross-course view MUST additionally show the **course**.
- **FR-005**: Both views MUST remain fully usable down to a 375px-wide viewport, with no horizontal page
  scrolling and no information made unreachable; rows MAY be restructured at narrow widths as long as every
  field in FR-004 stays visible.

#### Roster content

- **FR-006**: Only **active** enrolments MUST appear. Inactive (for example refunded) enrolments MUST be
  excluded from the rows and from every count shown.
- **FR-007**: A student's **name** MUST be their first and last name together; when neither is set, their
  username MUST be shown instead. A row MUST never show a blank name.
- **FR-008**: A student's **profile picture** MUST be shown when they have one, and a neutral placeholder MUST
  be shown when they do not or when the picture cannot be loaded.
- **FR-009**: The **enrolment date** MUST be the date the student's enrolment was created, shown as a date
  (no time), interpreted in UTC so that every viewer of the same roster sees the same date.
- **FR-010**: **Progress** MUST be the share of the course's **current lectures** that the student has
  completed, shown as a whole percentage. It MUST match the progress the student sees for that course in their
  own dashboard.
- **FR-011**: When a course currently has no lectures, progress MUST be shown as a neutral "—" rather than 0%.
- **FR-012**: Rows MUST be ordered by **enrolment date, most recent first**, with a deterministic tie-break so
  that the same roster paged twice returns the same students in the same order.
- **FR-013**: The roster MUST reflect the data as it stands when it is loaded. No live updating is required;
  new enrolments and progress appear on the next load, page change, or search.

#### Search

- **FR-014**: Both views MUST offer a single search box that filters the roster by **student name**.
- **FR-015**: Matching MUST be case-insensitive and MUST match a **partial** term anywhere in the student's
  first name, last name, first and last name together, or the username shown in their row. Characters with
  special meaning in search syntax MUST be matched literally.
- **FR-016**: Search MUST apply to the **whole** roster of the view (the course, or all owned courses), not
  only to the rows currently displayed.
- **FR-017**: Results MUST update as the instructor types, settling shortly after they stop, without a full
  page reload and without requiring a separate submit action. A term consisting only of whitespace MUST be
  treated as no search.
- **FR-018**: Changing the search term MUST return the roster to its first page, and the total shown in the
  header and in the paging position MUST describe the **matching** students.
- **FR-019**: A search that matches nobody MUST show a distinct "no students match" state that repeats the term
  and offers a way to clear it, visibly different from the "no students yet" state of FR-038.
- **FR-020**: The active search term MUST be part of the view's address, so refreshing, navigating
  Back/Forward, or opening a shared link restores the same search, without a full page reload when it changes.

#### Paging

- **FR-021**: Both views MUST return a fixed number of students per page, selected on the server; a view MUST
  never load the whole roster in order to display one page.
- **FR-022**: The paging controls MUST state the position within the full result (for example "21–40 of 318")
  and MUST make the previous control unavailable on the first page and the next control unavailable on the
  last.
- **FR-023**: The current page MUST be part of the view's address, so refreshing, navigating Back/Forward, or
  opening a shared link restores the same page, without a full page reload when it changes.
- **FR-024**: A page number in the address that is missing, unrecognised, or beyond the last page MUST fall
  back to the first page without showing an error.
- **FR-025**: Paging MUST apply to the current search results when a search is active, and consecutive pages
  MUST neither repeat nor skip a student for an unchanged roster.

#### Across all courses

- **FR-026**: The cross-course view MUST list the active enrolments of **every course the instructor owns**,
  including unpublished ones, and MUST NOT include any enrolment in a course they do not own.
- **FR-027**: A student enrolled in several of the instructor's courses MUST appear **once per course**, each
  row carrying that course's enrolment date and that course's progress.
- **FR-028**: The cross-course view MUST follow the same content, ordering, search, and paging rules as the
  per-course view (FR-006 – FR-025), ordering across all courses together.
- **FR-029**: The cross-course view MUST distinguish an instructor who owns **no courses** (a state pointing
  them at creating one) from an instructor whose courses simply have **no students yet**.

#### Access & privacy

- **FR-030**: Every roster MUST require an authenticated instructor; students and signed-out visitors MUST be
  refused, and signed-out visitors MUST be sent to sign in.
- **FR-031**: Ownership MUST be enforced on the server for every roster request. A roster MUST be derived only
  from courses whose owner is the requesting instructor; a course identity supplied by the client MUST never be
  trusted without that check.
- **FR-032**: A request for the roster of a course the instructor does not own MUST be refused in a way that is
  indistinguishable from a request for a course that does not exist.
- **FR-033**: A roster MUST expose **only** the fields in FR-004. It MUST NOT expose a student's email address
  or any other contact detail, their payment, order or refund information, their quiz answers or scores, or
  which individual lectures they have completed.
- **FR-034**: A caller who passes the instructor gate but has no instructor profile MUST receive a meaningful
  refusal rather than an unhandled error.
- **FR-035**: Both views MUST be **read-only**. No control on them may change a student, an enrolment, or a
  course, and this feature MUST NOT add any way to message, remove, or otherwise act on a student.

#### States

- **FR-036**: While a roster, a search, or a page is loading, the view MUST show a placeholder that preserves
  the layout, and MUST NOT show rows from the previous course, search term, or page as if they were the new
  result.
- **FR-037**: When a roster fails to load, the view MUST show a plain message with a way to retry, MUST NOT
  show a raw technical error, and MUST leave the search box and paging controls in a state the instructor can
  recover from.
- **FR-038**: A course with no students MUST show a "no students yet" state explaining that enrolled students
  will appear there, rather than an empty table.

### Key Entities *(include if feature involves data)*

- **Roster entry (computed, not persisted)**: One student's place in one course — their display name, profile
  picture (or its absence), enrolment date, progress through that course, and, in the cross-course view, the
  course it belongs to. Derived on read; never stored.
- **Roster page (computed)**: One page of roster entries for a scope (a course, or all of an instructor's
  courses) and an optional search term, together with the total number of students matching that scope and
  term, and the position of the page within it.
- **Search term (value)**: The text the instructor is filtering names by; empty means the whole roster.
- **Enrolment (existing, referenced)**: Student, course, active status, enrolment date.
- **Student account (existing, referenced)**: First name, last name, username, profile picture.
- **Lecture progress (existing, referenced)**: Which lectures a student has completed — the basis of the
  progress percentage.
- **Course / Lecture (existing, referenced)**: Ownership, and the current set of lectures that progress is
  measured against.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can name a specific student's progress in one of their courses within 15 seconds
  of opening the course's Students tab, for a course with 500 students, using search.
- **SC-002**: Every row's name, picture, enrolment date, and progress matches the underlying data under
  FR-006 – FR-013 in 100% of verification cases, including refunded enrolments, students with no name set,
  students with no profile picture, courses with no lectures, and students enrolled in several courses.
- **SC-003**: Paging through a full roster twice returns every student exactly once each time, with 0
  duplicates and 0 omissions, for an unchanged roster.
- **SC-004**: 100% of roster requests return only the caller's own students, and 100% of requests for another
  instructor's course, or from a student or signed-out visitor, are refused — verified independently of the
  interface. Another instructor's students appear 0 times.
- **SC-005**: A roster exposes a student's email address, contact details, payment information, or individual
  lecture or quiz records 0 times.
- **SC-006**: A search term that matches a student anywhere in the roster returns that student in 100% of
  cases, regardless of which page they would otherwise be on and of the capitalisation of the term.
- **SC-007**: A roster shows 0% progress for a course with no lectures 0 times, and shows a blank name 0 times.
- **SC-008**: Both views load a page of the roster within the same responsiveness budget as the rest of the
  instructor shell, for a course with 5,000 students and for an instructor with 50 courses and 10,000
  enrolments, with or without a search term.
- **SC-009**: Both views render without horizontal scrolling or clipped content at a 375px-wide viewport, and
  every field in FR-004 remains readable there.
- **SC-010**: After a search or page change, the view shows rows from the previous search or page presented as
  the new result 0 times.

## Assumptions

- **The wireframe is the structural reference.** Layout follows the "Course Students (Roster)" screen — the
  workspace tab bar, a header with the student count and a search box, and a table of Student / Enrolled /
  Progress — and its caption, which states that a cross-course roster lives at the sidebar Students page.
  Visual styling follows the existing design tokens, not the wireframe's greyscale.
- **Both rosters are in scope.** The user description describes the per-course view ("their progress for this
  course"); the discovery document's page inventory (§9) and spec breakdown (§17, "roster APIs + pages") name
  both, and the sidebar already carries a Students item leading to a placeholder. The cross-course view is
  therefore included as User Story 4 at P2, so it can be dropped or deferred without touching Stories 1–3.
- **Progress is the student's own progress.** It is the share of the course's lectures the student has
  completed — exactly the number the student sees on their own dashboard, and exactly what the wireframe
  caption describes. It is deliberately **not** spec 009's stricter analytics definition (every lecture
  completed *and* every quiz passed), so a roster row may read 100% for a student that analytics does not count
  as having completed the course. Consistency with what the student sees is worth more here than consistency
  with the analytics page, because an instructor reads this roster to answer a student.
- **Naming a student is the point.** Spec 009 guaranteed that analytics identify no individual; this feature
  deliberately does the opposite, bounded to the instructor's own students and to the four fields in FR-004.
  That is the smallest set that answers "who is in my course and how far have they got".
- **No contact details.** The user description lists name, picture, enrolment date, and progress; email and
  anything else that would let an instructor contact a student outside the platform are excluded by FR-033
  rather than treated as an oversight.
- **A fixed page size of 20 rows** is assumed, following the existing page-number paging used elsewhere in the
  platform while suiting a denser table. The plan may tune it; letting the instructor choose it is out of
  scope.
- **Sorting is fixed.** The wireframe mentions sortable columns, but the user description asks only for search
  and paging, so rows are always newest enrolment first (FR-012). Instructor-chosen sorting is out of scope.
- **Search matches names only.** "Search for the students using their name" is taken literally: the term is
  matched against the name shown in the row and the parts it is built from, not against course titles, emails,
  or anything else.
- **Search and page live in the address**, following the decision already taken for the analytics period in
  spec 009, so a roster view can be refreshed, shared, and navigated with Back/Forward.
- **Computed on read.** At current scale the roster is derived per request from existing enrolment and lecture
  progress data; no caching, background job, denormalised counter, or new stored field is assumed. Supporting
  indexes may be added through new migrations only, never by modifying existing ones.
- **Unpublished courses count.** A draft course with students (for example one unpublished after enrolments)
  still shows its roster, and its students appear in the cross-course view.
- **No real-time layer.** A new enrolment or a student's fresh progress appears on the instructor's next load,
  page change, or search.
- **Foundation from 003–009 is in place.** The instructor shell and sidebar with its Students placeholder, the
  course workspace with its Students tab placeholder, the ownership-scoped instructor endpoints, graceful
  handling of a caller without an instructor profile, and the shared table, avatar, progress-bar, empty-state
  and error-state patterns all exist.

## Dependencies

- **Spec 003 (instructor foundation)** — the instructor shell, the sidebar's Students route and its
  placeholder, the instructor route guard, and handling of a caller without an instructor profile.
- **Spec 004 (instructor course management)** — course ownership and the course workspace whose Students tab
  this feature fills.
- **Spec 005 (curriculum builder)** — the lectures that progress is measured against.
- **Spec 008 (instructor dashboard)** — the existing person-reference pattern (display name with username
  fallback, profile picture or none) used by recent enrolments, reused here for consistency.
- **Existing enrolment and lecture progress data** — the read-only sources for every row.
- **The student experience's own course-progress definition** — the percentage a student sees for a course,
  which FR-010 must match.
- **The shared component library, design tokens, data-fetching, paging, and error-handling conventions**
  established by the student experience and reused in 003–009.

## Out of Scope

- **Contacting or messaging students**, and any instructor-initiated action on a student or their enrolment
  (removing, refunding, granting access, resetting progress).
- **A per-student detail view** — which lectures they have completed, their quiz attempts and scores, their
  last activity, or their review of the course.
- **Sorting by column, filtering by progress or date, and filtering the cross-course roster to one course.**
- **Exporting the roster** (CSV, PDF, etc.) and scheduled reports.
- **Aggregate measures** — completion rate, quiz pass rate, active students, drop-off — which belong to spec
  009 and are not repeated here.
- **Earnings, revenue, or refund information** per student (spec 013) and reviews (spec 012).
- **Notifications or alerts** about students (for example "a student has stalled").
- **Real-time updates** of the roster.
- **Any change to the student experience, to the instructor dashboard (spec 008), or to the analytics views
  (spec 009).**
