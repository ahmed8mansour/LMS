# Feature Specification: Course Reviews and Ratings

**Feature Branch**: `001-course-reviews-ratings`
**Created**: 2026-07-09
**Status**: Draft
**Input**: User description: "i want to create a functionality to manage the reviews& rating for the courses which make it to be reflected on the instructor , this feature have a big bond with the student progress feature and course-discovery"

## Overview

Students who have completed a course can leave a star rating and a written review. Those
ratings roll up into a per-course average and review count (kept on the existing `Course`
fields), and further roll up into an aggregate reputation score for the instructor who owns
the course. The feature has two surfaces only: the **course-detail page** (`course/{id}`) and a
student **"my reviews" dashboard page**. It bonds tightly with **student-progress** (only students
who completed a course may review it).

Course-discovery is **out of scope**: those pages already read the existing `Course.rating` field
and are intentionally left untouched — this feature simply keeps that field accurate; it adds no
filtering, sorting, or other discovery changes.

## Clarifications

### Session 2026-07-09

- Q: When a student deletes their own review, or an admin removes one, is the record kept (soft-hidden) or physically deleted? → A: Physically (hard) deleted in both cases — no soft-hide/hidden state or moderation audit copy is retained.
- Q: If a student who reviewed a course is later refunded or un-enrolled, what happens to their review? → A: The review is retained and continues to count toward the course and instructor aggregates; the reviews feature is not coupled to refund/enrollment-revocation events.
- Q: Which of an instructor's courses count toward their aggregate rating — all courses, or only published ones? → A: Only published courses; reviews on unpublished/draft courses are excluded from the instructor aggregate.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enrolled student rates and reviews a course (Priority: P1)

A student who is enrolled in a course and has completed it (100% of its lectures) gives the
course a star rating (1–5) and an optional written review. On submission the course's average
rating and review count update, and the review becomes visible to other users on the course
detail page.

**Why this priority**: This is the core of the feature — without the ability to capture a
review, none of the downstream reflection (course aggregate, instructor reputation) has data to
work with. It is the minimum viable slice.

**Independent Test**: Enroll a test student, meet the eligibility condition, submit a rating
and review, and confirm the review is stored, appears on the course detail page, and the
course's average rating and review count reflect the new entry.

**Acceptance Scenarios**:

1. **Given** an eligible enrolled student who has not yet reviewed the course, **When** they
   submit a 1–5 star rating with optional text, **Then** the review is saved and the course's
   average rating and review count are recalculated to include it.
2. **Given** a student who is not enrolled in the course, **When** they attempt to submit a
   review, **Then** the system rejects the attempt with a clear message and no review is stored.
3. **Given** a student who is enrolled but has not yet completed the course, **When** they
   attempt to submit a review, **Then** the system rejects the attempt and explains that they
   must finish the course before they can review.
4. **Given** an eligible student who has already reviewed the course, **When** they attempt to
   submit a second review for the same course, **Then** the system prevents a duplicate and
   instead offers to update their existing review.

---

### User Story 2 - Anyone reads reviews and the aggregate rating on a course (Priority: P1)

A prospective student (or any visitor) opens a course detail page and sees the course's
average star rating, the total number of reviews, and a carousel of the individual reviews
with reviewer name, rating, text, and date. (No per-star distribution chart is shown.)

**Why this priority**: Reviews only create value when they are read. Displaying the aggregate
and the individual reviews is what turns captured data into an enrollment signal on the
course-detail page.

**Independent Test**: Seed a course with several reviews and open its detail page as a
non-enrolled visitor; confirm the average rating, review count, and the carousel of individual
reviews render correctly, newest first, without requiring authentication.

**Acceptance Scenarios**:

1. **Given** a course with one or more reviews, **When** any user views the course detail
   page, **Then** they see the average rating, total review count, and the list of reviews.
2. **Given** a course with no reviews yet, **When** a user views the course detail page,
   **Then** it clearly indicates the course has not been rated yet rather than showing a
   misleading "0 stars".
3. **Given** a course with many reviews, **When** a user views the reviews, **Then** reviews
   are paginated or incrementally loaded so the page stays responsive.

---

### User Story 3 - Ratings reflect on the instructor (Priority: P2)

Each instructor has an aggregate reputation derived from the ratings across all of their
published courses (for example an overall average rating and a total number of student
reviews). This aggregate is shown wherever the instructor is presented (instructor profile /
instructor card on a course).

**Why this priority**: This is the explicit "reflected on the instructor" requirement. It
depends on per-course aggregates existing first (US1/US2), so it follows them, but it is a
distinct, independently valuable slice: it gives instructors a reputation signal and gives
prospective students trust in the teacher, not just the single course.

**Independent Test**: Give an instructor two courses with known review sets, then view the
instructor's profile and confirm the displayed overall rating and total review count match
the combined figures across their courses.

**Acceptance Scenarios**:

1. **Given** an instructor with reviews across multiple courses, **When** their profile or
   instructor card is viewed, **Then** an aggregate rating and total review count across their
   courses are shown.
2. **Given** a new review is added to one of an instructor's courses, **When** the aggregate
   is next viewed, **Then** the instructor's aggregate rating and total reflect the new review.
3. **Given** an instructor whose courses have no reviews, **When** their profile is viewed,
   **Then** it indicates "not yet rated" instead of a misleading zero.

---

### User Story 4 - Student manages their own review (Priority: P2)

A student can view, edit, or delete the review they previously left on a course. Editing
updates the stored rating/text; deleting removes it. Either action recalculates the affected
course and instructor aggregates.

**Why this priority**: Reviews change as opinions change; without edit/delete, ratings become
stale and students cannot correct mistakes. Important, but the feature delivers value before
it, so it sits below capture and display.

**Independent Test**: As a student who has an existing review, change the star rating and
save, confirm the course average updates; then delete the review and confirm it disappears
and the aggregates recalculate.

**Acceptance Scenarios**:

1. **Given** a student with an existing review, **When** they edit the rating and/or text,
   **Then** the updated values replace the previous ones and course/instructor aggregates
   recalculate.
2. **Given** a student with an existing review, **When** they delete it, **Then** the review
   is removed from display and excluded from all aggregates.
3. **Given** a student, **When** they view a course they have reviewed, **Then** their own
   review is clearly identified and offers edit/delete controls that no other user sees.

---

### Edge Cases

- **Refund / un-enrollment after reviewing**: A student's review is retained if their enrollment
  is later refunded or revoked, and it continues to count toward all aggregates.
- **Course with zero reviews**: Aggregates must present a distinct "not yet rated" state, not a
  0.0 average that would unfairly rank the course last.
- **Instructor with mixed published/unpublished courses**: Only reviews on the instructor's
  published courses count toward the instructor aggregate; reviews on draft/unpublished courses
  are excluded.
- **Rating without text**: A star rating with no written comment is valid; a written comment with
  no star rating is not.
- **Very long or abusive review text**: Overly long text is bounded by a maximum length; abusive
  content can be removed (see moderation requirement).
- **Deleted course**: If a course is removed, its reviews are removed with it and no longer count
  toward the instructor aggregate.
- **Concurrent reviews**: Multiple reviews arriving close together must all be reflected in the
  average without lost updates.
- **Self-review**: An instructor must not be able to rate their own course.

## Requirements *(mandatory)*

### Functional Requirements

**Eligibility & authorship**

- **FR-001**: The system MUST allow a student to submit exactly one review per course they are
  enrolled in.
- **FR-002**: The system MUST restrict review submission to students who have **completed the
  course** (100% of the course's lectures marked complete in the student-progress feature). An
  enrolled student who has not yet completed the course is not eligible to review.
- **FR-003**: The system MUST prevent an instructor from reviewing their own course.
- **FR-004**: The system MUST prevent duplicate reviews by the same student on the same course,
  offering to update the existing review instead.

**Review content**

- **FR-005**: A review MUST include a star rating on an integer 1–5 scale.
- **FR-006**: A review MAY include optional free-text feedback up to a bounded maximum length.
- **FR-007**: The system MUST record the author, the course, the rating, the optional text, and
  the created and last-updated timestamps for every review.

**Managing reviews**

- **FR-008**: Students MUST be able to view, edit, and delete their own review.
- **FR-009**: Editing or deleting a review MUST recalculate the affected course and instructor
  aggregates.
- **FR-010**: Administrators MUST be able to remove a review that violates content policy.
  Removal permanently deletes the review (identical to a student deletion) and MUST recalculate
  aggregates the same way a student deletion does.

**Course aggregates**

- **FR-011**: The system MUST maintain, per course, an average rating and a total review count
  derived from that course's currently existing reviews.
- **FR-012**: A per-star rating **distribution** (breakdown/bar chart of how many reviews at each
  star level) is explicitly **out of scope**. The course-detail page shows the average, the review
  count, and a carousel of individual reviews — not a distribution chart. (The existing hardcoded
  distribution bars in the course-detail feedback area are removed and replaced by the carousel.)
- **FR-013**: The system MUST represent an unrated course with a distinct "not yet rated" state
  rather than a zero average.

**Instructor reflection**

- **FR-014**: The system MUST maintain, per instructor, an aggregate rating and total review
  count derived from the reviews across the instructor's **published** courses only. Reviews on
  the instructor's unpublished/draft courses are excluded from the aggregate.
- **FR-015**: The instructor aggregate MUST update whenever a review on any of the instructor's
  courses is added, edited, or removed, when a course is removed, or when a course is published or
  unpublished (since that changes which reviews are counted).

**Display**

- **FR-016**: The system MUST display a course's average rating, review count, and a carousel of
  individual reviews (reviewer identity, rating, text, date) on the course detail view, readable
  without enrollment.
- **FR-017**: The system MUST present reviews in a defined default order (newest first) and load
  them incrementally when a course has many reviews.
- **FR-018**: The system MUST display the instructor's aggregate rating and review count (from real
  review data) in the instructor section of the course-detail page, showing a "not yet rated" state
  when the instructor has no reviews.
- **FR-019**: The course-discovery pages are **out of scope**; this feature makes no filtering,
  sorting, or course-card changes. Because the existing course cards and discovery filter already
  read `Course.rating` / `reviews_count`, keeping those fields accurate (FR-011) is all that is
  required — no discovery code is touched.

### Key Entities *(include if feature involves data)*

- **Review**: One student's rating of one course. Attributes: author (student), course, star
  rating (1–5), optional text, created timestamp, updated timestamp. A student deletion or an
  admin removal permanently deletes the record (no hidden/soft-deleted state). Constraint: unique
  per (student, course).
- **Course rating aggregate**: Per-course derived values — average rating and total review count.
  Belongs to the existing Course entity (which already carries rating and review-count fields).
- **Instructor reputation aggregate**: Per-instructor derived values — overall average rating and
  total review count across the instructor's published courses. Belongs to the existing Instructor
  entity.
- **Enrollment / progress (existing, referenced)**: Determines who is eligible to review; owned by
  the student-progress / enrollment features, consumed here read-only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An eligible student can find the review control and submit a rating and review in
  under 1 minute, and their review is visible on the course page immediately after submitting.
- **SC-002**: 100% of ineligible review attempts (not enrolled, not meeting the progress
  condition, self-review, or duplicate) are rejected with a clear explanation and never create a
  stored review.
- **SC-003**: A course's displayed average rating and review count always equal the figures
  computed from its current reviews (verifiable by recomputation), including immediately after any
  add, edit, delete, or removal.
- **SC-004**: An instructor's displayed aggregate rating and total equal the combined figures
  across their published courses at all times.
- **SC-005**: A course detail page with up to at least 500 reviews loads its first page of reviews
  and its aggregate without noticeable delay to the user.
- **SC-006**: Unrated courses and unrated instructors are never shown a misleading "0 star" value;
  they always show a distinct "not yet rated" state.

## Assumptions

- **Eligibility**: Only students who have completed 100% of a course's lectures may review it
  (per FR-002). Course completion is determined from the existing student-progress data, so a
  course with no lectures, or a student mid-course, cannot yet produce a review.
- **Rating scale**: Ratings are whole numbers from 1 to 5 stars; half-star input is out of scope
  for v1 (display of a fractional *average* is still expected).
- **One review per student per course**, editable in place, rather than a history of multiple
  reviews.
- **Reuse of existing systems**: Enrollment and progress data (student-progress / enrollment
  features) are reused read-only to decide eligibility; the existing Course `rating` /
  `reviews_count` fields and Instructor profile are reused as the homes for the aggregates.
- **Instructor replies to reviews are out of scope** for v1 (a later enhancement).
- **Helpfulness voting / "was this review helpful"** is out of scope for v1.
- **Automated profanity/abuse filtering is out of scope** for v1; moderation is limited to
  administrator removal of individual reviews.
- **Retention on refund**: When an enrollment is refunded or revoked, the student's existing
  review is retained and continues to count toward aggregates; the reviews feature does not react
  to refund/revocation events.
- **Visibility**: Reviews and aggregate ratings are publicly readable (no authentication needed to
  read), consistent with course detail being public.
