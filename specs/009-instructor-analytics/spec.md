# Feature Specification: Instructor Analytics — Per-Course and Aggregate Learning Insight

**Feature Branch**: `009-instructor-analytics`
**Created**: 2026-09-17
**Status**: Draft
**Input**: User description: "read the planning/instructor-experience-discovery.md, we've done with the 008 now
it's 009's turn. Per-course: instructor can see the completion rate, the quiz pass rate, the number of active
students, a line chart of enrollments over time, a bar chart of section drop-off; the instructor can choose the
period [30, 90] days or [all time]. For all instructor's courses: the same thing. Notes: section drop-off means
the last completed section + 1 — where the student is stuck. UI/UX frames:
https://claude.ai/code/artifact/46addddf-c7d7-47b8-a58c-6dc7d9fa8cc5"

## Overview

Spec 008 gave the instructor a lifetime summary of their business: how many courses, students, stars, and
dollars. It deliberately stopped short of the question an instructor asks next — **"are my students actually
learning, and where are they getting stuck?"** The data to answer it already exists (enrollments, lecture
completions, quiz attempts), but nothing turns it into insight.

This feature adds **analytics** in two places that show the same set of measures:

- **Per course** — the Analytics tab of the course workspace, for one course.
- **Across all courses** — the Analytics page in the instructor sidebar, for everything the instructor owns.

Both show, for a chosen period (**last 30 days**, **last 90 days**, or **all time**):

1. **Completion rate** — what share of students have finished the course.
2. **Quiz pass rate** — how often students who take a quiz pass it.
3. **Active students** — how many students hold an active (non-refunded) enrollment.
4. **Enrollments over time** — a line chart of new enrollments across the period.
5. **A drop-off bar chart**, which differs by view:
   - **Per course — Section drop-off**: where students are stuck. For each section, how many students have
     it as their *next* section (the section right after the last one they completed) and have not finished
     the course.
   - **All courses — Course drop-off**: which courses students fail to finish. One bar per course showing
     its drop-off rate (the share of its students who have not completed it), with the lowest-completion
     courses first.

Every measure describes the **students who enrolled within the selected period** (a cohort). Everything is
**read-only and derived from data the platform already holds**. Nothing is stored, and this feature
introduces no way to change anything.

## Clarifications

### Session 2026-09-17

- Q: Do the rates describe the students who enrolled within the period, or the learning activity within the
  period? → A: **The students who enrolled within the period (a cohort).** "Last 30 days" means: of the
  students whose enrollment date is in the last 30 days, what share completed, how their quizzes went, how
  many there are, and where they are stuck. A student who enrolled 40 days ago and is still learning appears
  under "Last 90 days" and "All time", not under "Last 30 days". Short periods naturally show lower completion
  because recent students have had less time to finish; this is accepted.
- Q: What makes a student "active"? → A: **Holding an active enrollment**, i.e. enrolled and not refunded.
  Combined with the cohort rule, Active students is the number of active enrollments whose enrollment date is
  in the period (distinct people in the aggregate view). It does not depend on recent learning activity or on
  whether the student has finished.
- Q: How is section drop-off combined across courses that have different sections? → A: **It isn't. The
  aggregate view shows course drop-off instead.** One bar per course, showing the share of that course's
  students (in the period) who have not completed it, ordered so the courses with the lowest completion come
  first. The per-course view keeps section drop-off as originally described.
- Q: What counts as "completed the course" for analytics? → A: **Every current lecture completed and every
  current quiz passed.** This is deliberately stricter than review eligibility (lectures only), so that a
  student stuck on a quiz is never counted as completed, and every student who has not completed appears in
  exactly one section drop-off bar.
- Q: How is the selected period kept? → A: **The period is part of the page's address.** It survives refresh,
  Back/Forward, and shared links, and is carried when a course drop-off bar opens a course's Analytics tab.
  Opening Analytics from the sidebar or the course workspace tab bar starts at "Last 30 days". An invalid or
  missing period in the address falls back to "Last 30 days".
- Q: How are rates based on very few students handled? → A: **No minimum sample.** Every rate is always shown
  with its underlying counts (e.g. "100% · 1 of 1"); no warning, hiding, or re-ranking for small samples.
- Q: Which time zone defines periods and chart buckets? → A: **UTC everywhere.** Period windows, days, weeks
  (starting Monday), and months are all UTC, so every viewer sees the same numbers for the same link.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how one course is performing (Priority: P1)

An instructor opens a course's workspace and selects the Analytics tab. Three tiles show the course's
completion rate, quiz pass rate, and number of active students. Below them, a line chart shows how enrollments
have moved over the period, and a bar chart shows, section by section, how many students are stuck there. The
period defaults to the last 30 days.

**Why this priority**: This is the core of the feature and discovery US-08 exactly. A single course is the
unit an instructor can actually improve, so per-course insight is independently valuable even if the
aggregate page never ships.

**Independent Test**: For one course with a known set of enrollments (including refunded ones), lecture
completions, quiz attempts, and enrollment dates, open its Analytics tab and confirm each tile and each chart
point matches the underlying data under the definitions in FR-006 – FR-016.

**Acceptance Scenarios**:

1. **Given** a course the instructor owns, **When** they open its Analytics tab, **Then** they see the
   completion rate, quiz pass rate, and active students tiles, the enrollments-over-time line chart, and the
   section drop-off bar chart, with "Last 30 days" selected.
2. **Given** a course with 10 active enrollments of which 4 students have completed every lecture and passed
   every quiz, and 1 more has completed every lecture but not passed the last quiz, **When** the analytics load
   for a period containing all 10 enrollments, **Then** the completion rate shows 40%, and the fifth student
   appears in the drop-off bar of the section whose quiz they have not passed.
3. **Given** a refunded (inactive) enrollment, **When** the analytics load, **Then** that student contributes
   to no tile and to neither chart.
4. **Given** a student who failed a section quiz twice and then passed it, **When** the analytics load,
   **Then** the quiz pass rate counts that student–quiz pair once, as passed.
5. **Given** a course whose sections are ordered 1–4, and students whose last completed sections are none,
   1, 1, and 3, **When** the analytics load, **Then** the drop-off chart shows 1 student at Section 1, 2 at
   Section 2, 0 at Section 3, and 1 at Section 4.
6. **Given** a student who has completed every section, **When** the analytics load, **Then** that student
   appears in the completion rate but in no drop-off bar.
7. **Given** a course with enrollments on known dates, **When** the analytics load, **Then** the line chart
   shows the number of new enrollments per time bucket across the whole period, including zero-value buckets.
8. **Given** a course with no enrollments, **When** the Analytics tab opens, **Then** each tile and chart
   shows a clear "no data yet" state rather than 0% or an empty axis.

---

### User Story 2 - Change the time period (Priority: P1)

The instructor switches the period between last 30 days, last 90 days, and all time. Every tile and both
charts update together to describe the selected period, and it is always clear which period is being shown.

**Why this priority**: The user description names the period selector as a requirement of both views.
Without it, recent changes to a course are hidden by its whole history.

**Independent Test**: With enrollments and learning activity spread over more than 90 days, switch through the
three periods and confirm every tile and chart changes consistently according to FR-004 – FR-005, and that no
section of the page shows a different period from the others.

**Acceptance Scenarios**:

1. **Given** the Analytics page on "Last 30 days", **When** the instructor selects "Last 90 days", **Then** all
   three tiles and both charts update to the 90-day period together, and the selected option is visibly marked.
2. **Given** enrollments older than 90 days, **When** "All time" is selected, **Then** they are included, and
   the line chart starts at the course's first enrollment.
3. **Given** a period change is loading, **When** the new data has not yet arrived, **Then** the page does not
   show a mix of values from the old and new periods.
4. **Given** a period in which nobody enrolled, **When** it is selected, **Then** the tiles and charts show
   the "no data in this period" state, not zeros presented as real rates.
6. **Given** "Last 90 days" is selected, **When** the instructor refreshes the page or opens the same link in a
   new tab, **Then** "Last 90 days" is still selected and shown.
7. **Given** a link with an unrecognised period, **When** it is opened, **Then** the view shows "Last 30 days"
   with no error.
8. **Given** "All time" is selected on one course's Analytics tab, **When** the instructor opens another
   course's workspace and selects its Analytics tab, **Then** that tab starts at "Last 30 days".
5. **Given** a student who enrolled 45 days ago and completed the course yesterday, **When** "Last 30 days" is
   selected, **Then** that student contributes to no measure; **When** "Last 90 days" is selected, **Then**
   they count as an active student and as a completion.

---

### User Story 3 - See how all my courses are performing together (Priority: P2)

From the Analytics item in the instructor sidebar, the instructor sees the same tiles and enrollments chart
computed across every course they own, with the same period selector — a single picture of how their teaching
is going overall. In place of section drop-off, a course drop-off chart shows which of their courses students
most often fail to finish, lowest completion first, so they know which course to open next.

**Why this priority**: The user description asks for "the same thing" across all courses, and it answers a
different question (overall health) from the per-course view (what to fix). It is P2 because the per-course
view already covers every course individually.

**Independent Test**: With an instructor owning several courses with known activity, open the Analytics page
and confirm each tile and chart equals the combination of the underlying data across all owned courses under
FR-017 – FR-019.

**Acceptance Scenarios**:

1. **Given** an instructor owning several courses, **When** they open the Analytics page from the sidebar,
   **Then** they see the three tiles, the enrollments-over-time chart, and the course drop-off chart, computed
   across all their courses, with "Last 30 days" selected.
2. **Given** a student enrolled in two of the instructor's courses, one completed and one not, **When** the
   aggregate analytics load, **Then** the completion rate counts two enrollments (one complete, one not), and
   the active students tile counts the student once.
3. **Given** course X with 20 students of whom 15 have not completed (75% drop-off), course Y with 10 students
   of whom 2 have not completed (20%), and course Z with 50 students of whom 25 have not completed (50%),
   **When** the course drop-off chart loads, **Then** it shows bars in the order X (75%), Z (50%), Y (20%),
   each exposing its not-completed and total student counts on hover or focus.
4. **Given** a course that nobody enrolled in during the period, **When** the course drop-off chart loads,
   **Then** that course has no bar.
5. **Given** a course drop-off bar, **When** the instructor selects it, **Then** they are taken to that
   course's Analytics tab with the same period selected.
6. **Given** an instructor with no courses, **When** they open the Analytics page, **Then** they see an empty
   state that points them to create a course.
7. **Given** a course that has been unpublished but still has active enrollments, **When** the aggregate
   analytics load, **Then** that course's students are still included.

---

### User Story 4 - Nobody sees another instructor's analytics (Priority: P1)

Every value and chart point is derived only from the signed-in instructor's own courses. No request can be
crafted to obtain analytics for another instructor's course.

**Why this priority**: Analytics expose student behaviour and enrollment volume, which discovery §15.4 names
as sensitive. It must ship with the feature.

**Independent Test**: With instructors A and B each owning courses with activity, sign in as A and confirm the
aggregate page contains none of B's data; then request analytics for one of B's courses as A, and request any
analytics as a student, an unauthenticated caller, and a staff account without an instructor profile, and
confirm each is refused or handled cleanly — verified against the backend independently of the frontend.

**Acceptance Scenarios**:

1. **Given** instructor A, **When** A requests analytics for a course owned by B, **Then** the request is
   refused in the same way as for a course that does not exist, and nothing about B's course is revealed.
2. **Given** a student account or an unauthenticated caller, **When** it requests any instructor analytics,
   **Then** the request is refused and nothing is returned.
3. **Given** a staff account with no instructor profile, **When** it opens either analytics view or requests
   its data, **Then** it receives a clear handled state, never an error page or a server error.
4. **Given** any analytics view, **When** it is shown, **Then** no individual student is identified — only
   counts and rates appear.

---

### Edge Cases

- **Course with no enrollments at all.** Every tile and chart shows "no data yet"; rates are never shown as 0%.
- **Course with enrollments but no quizzes.** Quiz pass rate shows "No quizzes" (per course) rather than 0%.
- **Course with quizzes that nobody has attempted in the period.** Quiz pass rate shows "No attempts in this
  period", not 0%.
- **A section with no lectures and no quiz** (possible in a draft). It can never be completed, so a student
  who reaches it is counted as stuck there.
- **Curriculum changed after students progressed.** Analytics are computed against the course's **current**
  sections, lectures, and quizzes. A new lecture added to a finished course makes previously finished students
  count as not completed and places them at the section containing it. A deleted section no longer appears in
  the drop-off chart.
- **Completed sections are not contiguous** (possible after curriculum edits). The stuck section is the one
  immediately after the **highest-ordered** completed section, per the user's definition.
- **Student whose last completed section is the final section, but who has not completed the course** (e.g.
  an earlier section has a newly added lecture, or a section's quiz is passed but one of its lectures is not
  completed). The student is counted as not completed and, having no "next" section, is shown at the first
  section that still has an uncompleted lecture or unpassed quiz (FR-015).
- **Student who watched every lecture but has not passed a quiz.** Not completed for analytics (FR-007), even
  though they are eligible to review the course.
- **Refunds.** A refunded enrollment is excluded from every measure, including enrollments over time.
- **Re-enrollment after refund.** Counted as the enrollment it currently is, on its current enrollment date.
- **Free courses.** Enrollments count in every measure exactly like paid ones.
- **Unpublished or draft course with active enrollments.** Still has analytics; analytics are not limited to
  published courses.
- **Draft course that never had students.** Its Analytics tab shows the "no data yet" state.
- **Deleted course.** Its data no longer exists and contributes to nothing; its analytics are not reachable.
- **Student enrolled before the period who is still learning.** Not part of that period's cohort, so they
  appear under a longer period only (FR-005). Short periods may therefore show low completion; this is
  expected.
- **Enrollment near UTC midnight.** Bucketed by its UTC date, even if the instructor's local date differs.
- **Partial first/last bucket.** A rolling 90-day window rarely starts on a Monday, and "All time" ends mid-month;
  partial weeks and months at the edges are still shown and counted only for the days inside the window.
- **Tiny cohort (e.g. one student in the period).** Rates are shown normally with their counts ("0% · 0 of
  1"); a 1-student course at 100% drop-off can rank first in course drop-off, and its counts on hover make
  the small size clear.
- **Aggregate view with a single course.** The course drop-off chart shows one bar.
- **Aggregate view where every course is fully completed.** Every bar is 0%; bars are still shown, because a
  0% drop-off is real data, not missing data.
- **Aggregate view where no course had enrollments in the period.** The course drop-off chart shows the "no
  data in this period" state.
- **Very large course or instructor.** Analytics must remain usable within the instructor shell's
  responsiveness budget (SC-008).
- **Many sections (e.g. 30).** The drop-off chart stays readable at every viewport width; section labels are
  truncated gracefully, and the full section title is available on hover or focus.
- **Analytics data unavailable.** A single page-level error with Retry replaces the tiles and charts; no zeros
  or empty charts are shown in place of data that failed to load.
- **Staff account without an instructor profile.** Handled state consistent with 003–008.

## Requirements *(mandatory)*

### Functional Requirements

#### Pages & layout

- **FR-001**: The course workspace's **Analytics** tab MUST show analytics for that single course, inside the
  existing workspace with its tab bar, the Analytics tab marked active.
- **FR-002**: The instructor sidebar's **Analytics** item MUST open an aggregate analytics page covering all
  courses the instructor owns, with the Analytics navigation item marked active.
- **FR-003**: Both views MUST present, in order: a header with the period selector; a row of three tiles
  (Completion rate, Quiz pass rate, Active students); and the **Enrollments over time** line chart beside a
  drop-off bar chart — **Section drop-off** in the per-course view, **Course drop-off** in the aggregate view. On narrow viewports these MUST stack to a single column in the
  same order with no horizontal scrolling and no clipped content.

#### Period

- **FR-004**: Both views MUST offer exactly three periods — **Last 30 days**, **Last 90 days**, and **All
  time**. The selected period MUST be visibly indicated.
- **FR-004a**: The selected period MUST be part of the view's address, so that refreshing, navigating
  Back/Forward, or opening a shared link shows the same period. Opening a view from the sidebar or the course
  workspace tab bar MUST start at **Last 30 days**. A missing or unrecognised period in the address MUST fall
  back to **Last 30 days** without an error. Changing the period MUST update the address without a full page
  reload.
- **FR-005**: Every measure MUST describe the **period cohort**: the active enrollments whose enrollment date
  falls within the selected period (for All time, every active enrollment). Completion, quiz results, and
  stuck sections of cohort students MUST be taken as they stand **now**, regardless of when that progress
  happened. Changing the period MUST update all tiles and both charts together so that they always describe
  the same cohort.

#### Measures (per course)

- **FR-006**: Only **active** enrollments in the period cohort ("counted enrollments") count toward any
  measure. Inactive (e.g. refunded) enrollments MUST be excluded everywhere.
- **FR-007**: A student has **completed the course** when they have completed every lecture currently in the
  course **and** passed every quiz currently in the course. This is intentionally stricter than review
  eligibility (lectures only); analytics MUST use this definition in every measure (completion rate, section
  drop-off, course drop-off). A course with no lectures and no quizzes cannot be completed.
- **FR-008**: **Completion rate** MUST be the number of counted enrollments whose student has completed the
  course, divided by the number of counted enrollments, shown as a whole-number percentage together with the
  underlying counts (e.g. "42% · 21 of 50 students"). With no counted enrollments, it MUST show "no data" rather
  than 0%.
- **FR-009**: **Quiz pass rate** MUST be computed over **student–quiz pairs** of counted enrollments: of the
  (student, quiz) pairs in which the student made at least one attempt, the share in which the student has passed. Retakes MUST NOT
  count as extra attempts. It MUST be shown as a whole-number percentage with the underlying counts. With no
  quizzes it MUST show "No quizzes"; with no attempts it MUST show "No attempts" rather than 0%.
- **FR-010**: **Active students** MUST be the number of counted enrollments — students holding an active
  (non-refunded) enrollment whose enrollment date is in the period — regardless of recent learning activity or
  whether they have completed the course. With none, it MUST show the "no data in this period" state.
- **FR-011**: **Enrollments over time** MUST be a line chart of the number of counted enrollments per time
  bucket across the whole selected period, with every bucket shown, including those with zero enrollments.
  Buckets MUST be **daily** for Last 30 days, **weekly** (weeks starting Monday) for Last 90 days, and
  **monthly** for All time (starting from the month of the first enrollment).
- **FR-011a**: Period windows and all buckets MUST be computed in **UTC**: "Last 30 days" and "Last 90 days"
  are rolling windows ending now in UTC, and days, weeks, and months begin at UTC midnight. The line chart MUST
  indicate that dates are in UTC. The same period and data MUST yield identical values for every viewer.
- **FR-012**: Each point of the line chart MUST expose its exact value and bucket date on hover or focus.

#### Section drop-off (per course)

- **FR-013**: **Section drop-off** MUST be a bar chart with one bar per section of the course in curriculum
  order, where each bar is the number of counted students who have **not** completed the course and whose
  **stuck section** is that section.
- **FR-014**: A student has **completed a section** when they have passed the section's quiz, if it has one,
  or otherwise completed every lecture in the section — matching the rule that unlocks the next section for
  students.
- **FR-015**: A student's **stuck section** MUST be the section immediately after the highest-ordered section
  they have completed; a student who has completed no section is stuck at the first section. A student with no
  section after their highest-ordered completed section, who has not completed the course, is stuck at the
  first section (in curriculum order) that still contains a lecture they have not completed or a quiz they
  have not passed.
- **FR-016**: Students who have completed the course MUST NOT appear in any drop-off bar. Each bar MUST show
  its section title (truncated gracefully if long) and expose its exact count, the section's full title, and
  its share of the students shown in the chart on hover or focus.

#### Aggregate (all courses)

- **FR-017**: The aggregate view MUST compute the tiles and the enrollments chart over all courses the
  instructor owns — draft, unpublished, or published — using the same period cohort rule and pooling the
  underlying counts rather than averaging per-course percentages: completion rate over all counted
  enrollments; quiz pass rate over all student–quiz pairs; enrollments over time over all counted enrollments.
- **FR-018**: In the aggregate view, **Active students** MUST count distinct people: a student with counted
  enrollments in several of the instructor's courses counts once.
- **FR-019**: In place of section drop-off, the aggregate view MUST show a **Course drop-off** bar chart with
  one bar per owned course that has at least one counted enrollment in the period. Each bar's value MUST be
  that course's **drop-off rate**: the share of its counted enrollments whose student has not completed the
  course (100% minus its completion rate under FR-008), shown as a whole-number percentage.
- **FR-019a**: Course drop-off bars MUST be ordered by drop-off rate, highest first (lowest completion first);
  ties MUST be broken by the number of not-completed students, most first, then by course title, so the order
  is deterministic. Courses with no counted enrollments in the period MUST NOT get a bar.
- **FR-019b**: Each course bar MUST show the course title (truncated gracefully if long) and expose, on hover
  or focus, the full title, the drop-off rate, and the not-completed and total counted student numbers.
  Selecting a bar MUST open that course's Analytics tab with the same period selected.
- **FR-019c**: The course drop-off chart MUST remain readable for an instructor with up to 50 courses at every
  viewport width, without horizontal scrolling.
- **FR-019d**: No minimum sample size applies to any rate, in either view. Whenever at least one student (or
  student–quiz pair) underlies a rate, the rate MUST be shown with its counts, and course drop-off ranking
  MUST follow FR-019a regardless of course size.

#### States, freshness & resilience

- **FR-020**: Each view MUST load its tiles and charts for a period as **one consistent snapshot**, with one
  layout-matching loading state; it MUST NOT flash zeros, empty charts, or a mix of periods before real data
  arrives.
- **FR-021**: Every tile and chart MUST have a defined empty state ("no data yet" / "no data in this period" /
  "No quizzes" / "No attempts"), distinct from a real zero.
- **FR-022**: When the snapshot cannot be loaded, the view MUST replace the tiles and charts with a single
  page-level error and a Retry action, and MUST NOT display zeros, empty charts, or empty states in place of
  data it failed to load. Failures MUST surface as clear, non-technical messages, never raw errors or stack
  traces.
- **FR-023**: Analytics MUST reflect current data each time a view is opened or its period changed, and MUST
  reflect the instructor's own changes made elsewhere (e.g. curriculum edits, deleting a course) on return,
  without a manual page reload. No real-time updates are required.
- **FR-024**: The aggregate view for an instructor who owns no courses MUST show an empty state with a link to
  create a course.

#### Access & integrity

- **FR-025**: Every value and chart point MUST be derived only from courses owned by the signed-in instructor.
  Ownership MUST be enforced server-side; the route guard is defense in depth only.
- **FR-026**: A request for per-course analytics of a course the caller does not own MUST be refused exactly as
  if the course did not exist.
- **FR-027**: Requests from students, unauthenticated callers, or any non-instructor MUST be refused with
  nothing returned. A caller without an instructor profile MUST receive a clear handled state, never an error.
- **FR-028**: Analytics MUST NOT identify individual students — only counts, rates, and dates appear.

#### Scope boundaries

- **FR-029**: Analytics MUST be read-only and MUST NOT create, edit, or delete anything.
- **FR-030**: This feature MUST NOT change the student experience, the instructor dashboard (spec 008), or any
  instructor surface other than the course workspace's Analytics tab and the sidebar's Analytics page.
- **FR-031**: New surfaces MUST reuse the project's existing design tokens and component library, follow the
  project's data-visualisation conventions, and be visually consistent with the instructor shell, following
  the wireframe's structure.

### Key Entities *(include if feature involves data)*

- **Analytics snapshot (computed, not persisted)**: For one scope (a single course, or all of an instructor's
  courses) and one period — completion rate with its counts, quiz pass rate with its counts, active students,
  the enrollments-over-time series, and either the section drop-off series (one course) or the course
  drop-off series (all courses). Always derived from current data; never stored.
- **Period (value)**: Last 30 days, Last 90 days, or All time — defines the enrollment cohort and the line
  chart's time-bucket size.
- **Enrollment-over-time point (computed)**: A bucket start date and the number of counted enrollments in it.
- **Section drop-off bar (computed)**: A section (identity, title, position) and the number of students stuck
  there.
- **Course drop-off bar (computed)**: A course (identity, title), its drop-off rate, and its not-completed and
  total counted student numbers.
- **Enrollment (existing, referenced)**: Student, course, active status, enrollment date.
- **Lecture progress (existing, referenced)**: Which lectures a student has completed, and when.
- **Quiz attempt (existing, referenced)**: Student, quiz, passed or not, and when.
- **Course / Section / Lecture / Quiz (existing, referenced)**: Ownership, curriculum order, and the structure
  that defines course and section completion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can state a course's completion rate, quiz pass rate, and active students within 5
  seconds of opening its Analytics tab.
- **SC-002**: An instructor can identify the section where the most students are stuck within 10 seconds of
  opening a course's Analytics tab, and the course with the lowest completion within 10 seconds of opening
  the aggregate Analytics page.
- **SC-003**: Every tile value and chart point matches the underlying data under FR-006 – FR-019 in 100% of
  verification cases, including refunds, retaken quizzes, free courses, unpublished courses, and students
  enrolled in several courses.
- **SC-004**: After a period change, the page shows values from two different periods at the same time 0
  times.
- **SC-005**: A rate is shown as 0% when there is no underlying data 0 times.
- **SC-006**: 100% of analytics requests return only the caller's own data, and 100% of requests for another
  instructor's course or from non-instructors are refused — verified independently of the frontend. Another
  instructor's data appears in analytics 0 times.
- **SC-007**: Analytics identify an individual student 0 times.
- **SC-008**: Both analytics views are usable within the same responsiveness budget as the rest of the
  instructor shell, for any period, for an instructor with up to 50 courses and 10,000 enrollments, and for a
  single course with 5,000 enrollments and 30 sections.
- **SC-009**: Both views render without horizontal scrolling or clipped content at a 375px-wide viewport.

## Assumptions

- **The wireframe is the structural reference.** Layout follows the "Course Analytics" screen (tab bar, period
  selector, three tiles, line chart beside bar chart); its caption states that the aggregate page mirrors it.
  Visual styling follows the existing design tokens, not the wireframe's greyscale.
- **Completion is stricter than review eligibility.** By clarification, "completed the course" is every
  current lecture completed and every current quiz passed. Review eligibility (lectures only) is unchanged, so
  a student may be able to review a course that analytics does not count as completed; this is accepted.
- **Section completion reuses the unlock rule.** A section counts as completed exactly when the student would
  be allowed into the next section, so the drop-off chart matches what students experience.
- **The aggregate view deviates from the wireframe.** The wireframe caption says the aggregate page "mirrors"
  the per-course one; by clarification its drop-off chart is per course (course drop-off) rather than per
  section, because sections cannot be meaningfully combined across courses.
- **Course drop-off is a rate, not a count.** Ranking by rate surfaces the courses students least often
  finish regardless of size; the counts on hover keep a 2-student course from being misread as a large problem.
- **Cohort periods favour long periods for completion.** Accepted by clarification; "All time" gives the
  settled completion picture, short periods show how recent students are doing.
- **The user's drop-off definition is taken literally.** "Last completed section + 1" is the section after the
  highest-ordered completed section; fallbacks for non-contiguous progress are in FR-015.
- **Quiz pass rate is per student–quiz pair.** Students can retake a quiz until they pass, so counting raw
  attempts would punish persistence; a pair counts once and counts as passed if any attempt passed. The pass
  mark is the platform's existing one.
- **Aggregate rates are pooled.** Pooling counts means a course with 1,000 students weighs more than one with
  5, which is what an instructor expects of "all my courses".
- **Analytics use the current curriculum.** No history of past curricula exists; measures are computed against
  what the course contains now.
- **Computed on read.** At current scale, analytics are derived per request; no caching, background job,
  denormalised counter, or new stored field is assumed. Supporting indexes may be added through new migrations
  only, never by modifying existing ones.
- **Periods are rolling windows ending now, in UTC** (by clarification; FR-011a). An enrollment near midnight
  may fall on a different calendar day than the instructor's local clock shows; this is accepted.
- **No real-time layer.** Student activity appears on the instructor's next visit, refresh, or period change.
- **Foundation from 003–008 is in place.** The instructor shell and sidebar, the course workspace and its
  Analytics tab placeholder, and graceful handling of a caller without an instructor profile all exist.

## Dependencies

- **Spec 003 (instructor foundation)** — the instructor shell, the sidebar's Analytics route and its
  placeholder, and handling of a caller without an instructor profile.
- **Spec 004 (instructor course management)** — course ownership and the course workspace whose Analytics tab
  this feature fills.
- **Spec 005 (curriculum builder)** — the sections, lectures, quizzes, and their order that define completion
  and drop-off.
- **Existing enrollment, lecture progress, and quiz attempt data** — read-only sources for every measure.
- **The existing section-unlock rule and quiz pass mark** of the student experience.
- **The shared component library, design tokens, data-visualisation conventions, data-fetching, and
  error-handling conventions** established by the student experience and reused in 003–008.

## Out of Scope

- **Student roster** and any per-student progress or identity (spec 010).
- **Earnings, revenue, or refund** analytics (spec 013); reviews and rating trends (spec 012).
- **Custom date ranges**, periods other than 30 days / 90 days / all time, and period-over-period comparison.
- **Per-lecture or per-question analytics** (e.g. which question is most often wrong, video watch time).
- **A per-course comparison table** on the aggregate page, or filtering the aggregate page to a subset of
  courses.
- **Exporting** analytics (CSV, PDF, etc.) and scheduled reports.
- **Notifications or alerts** based on analytics (e.g. "drop-off increased").
- **Real-time updates** of analytics.
- **Any change to the instructor dashboard (spec 008)** or to the student experience.
