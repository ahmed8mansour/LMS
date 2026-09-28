# Feature Specification: Course Completion Summary

**Feature Branch**: `013-instructor-earnings` (built alongside 013 at the owner's direction)
**Created**: 2026-09-24
**Status**: Draft (written retroactively over the implementation — see *Implementation Status*)
**Input**: User description: "now fix the completion screen problem" — the completion screen identified as
launch blocker 2 in the launch-readiness review of 2026-09-23.

## Overview

A student who finishes a course has, until now, been told nothing true about it. A completion screen existed
at `/dashboard/learn/{id}/complete`, and it was built entirely from a hardcoded constant: the same invented
course name ("Advanced UI/UX Principles"), the same invented "12/12" lectures, "18h 30m" and "92%", shown to
every student of every course, under a badge reading "Certificate coming soon" for a certificate the platform
does not issue.

It was also, in practice, **unreachable at the moment it describes**. The only route into it was the
curriculum page's primary call to action, on the branch taken when a course has *no playable lecture* — an
empty course, the opposite of a finished one. `getNextPreviousLecture` returned `next: null` at the end of a
course, so a student who completed the last lecture or passed the last quiz simply ran out of road.

This feature makes the screen real and reachable: one read-only endpoint that reports what a student actually
did on one course, a page that renders it, and three navigation paths that lead there at the moment a course
is finished.

It deliberately adds **no certificate**. The certificate remains unbuilt, and this feature removes the claim
rather than keeping a promise the platform cannot honour.

## Clarifications

### Session 2026-09-24

- Q: What makes a course "completed"? → A: **Every lecture completed and every quiz passed.** The existing
  course-level `progress` figure counts lectures only, which is the right number for a progress bar but the
  wrong rule for this screen — its own copy says "every lecture and the required quizzes". A course with no
  quizzes is completed on its lectures alone. A course with **no lectures is never completed**: there is
  nothing to have done, and an empty course must not congratulate anyone.
- Q: Which attempt does the quiz average use, given that a student may fail before passing? → A: **The best
  attempt per quiz**, averaged over the quizzes the student has actually sat. Because a passed quiz cannot be
  retaken, on a completed course the best attempt is always the passing one, so this never disagrees with what
  the student was told at the time. A failed first try never drags down a quiz they went on to pass.
- Q: What does the quiz average read when a course has no quizzes? → A: **Null, and the tile is not
  rendered.** `0%` would read as a failure rather than as the absence of a measurement, and "N/A" in a tile
  designed to celebrate is noise. The grid drops from three columns to two.
- Q: Where does "time spent" come from? → A: **The sum of `Lecture.duration` over the lectures this student
  has marked complete in this course** — the same basis as `total_mins_spent` on the dashboard overview,
  scoped to one course. It is content duration, not measured watch time; the platform tracks no playback
  position, and this figure should never be described to a student as time they were observed watching.
- Q: What happens when an unfinished student opens the URL directly? → A: **The endpoint answers normally with
  `is_completed: false`, and the page redirects them to the course curriculum.** The alternative — a 403 whose
  message the client must parse — makes the ordinary "not yet" case indistinguishable from a real access
  failure. Enrollment remains a hard boundary and still returns 403.
- Q: Does the screen do anything about the certificate? → A: **It removes the claim.** The badge now carries
  the date the course was completed, which is true, useful, and needs no new subsystem. The certificate is
  tracked as its own post-launch feature.
- Q: Where does "Leave a Review" go? → A: **`/dashboard/reviews`**, which already lists reviewable courses and
  for which this course now qualifies (eligibility is enrolment plus 100% completion). The button reads "Edit
  Your Review" when the student has already reviewed the course, so it never invites a duplicate that the
  one-review-per-student constraint would reject.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a true summary of a finished course (Priority: P1)

A student completes the last requirement of a course and arrives at a screen naming the course they actually
finished, how many of its lectures they completed, how long that content ran, and how they scored on its
quizzes.

**Why this priority**: This is the defect. The screen currently shows fabricated data to real users, which is
worse than showing nothing — it is the single most emotionally significant moment in the student journey, and
the platform currently lies at it.

**Independent Test**: Complete every lecture and quiz of a course, open the completion screen, and check every
figure against the curriculum and the quiz results.

**Acceptance Scenarios**:

1. **Given** a student has completed every lecture and passed every quiz, **When** they open the completion
   screen, **Then** it names their course and shows their own lecture count, time and quiz average
2. **Given** a course with no quizzes, **When** its completion screen renders, **Then** the quiz-average tile
   is absent and the remaining two tiles fill the row
3. **Given** two students on the same course with different progress, **When** each opens the screen, **Then**
   neither sees the other's figures

### User Story 2 - Reach the screen at the moment of completion (Priority: P1)

Finishing the last lecture, or passing the last quiz, leads to the completion screen rather than to a dead end.

**Why this priority**: A screen nobody can reach is not a feature. Fixing the data without fixing the route
would leave the fabrication replaced by an empty result — the student still never sees it.

**Independent Test**: Finish a course by its last lecture, then finish another by its last quiz, and confirm
both arrive at the completion screen.

**Acceptance Scenarios**:

1. **Given** a student completes the final lecture of a course with no remaining quizzes, **When** they press
   Next, **Then** they arrive at the completion screen
2. **Given** a student passes the quiz that was the course's last requirement, **When** the result page
   renders, **Then** its primary action reads "Finish Course" and leads to the completion screen
3. **Given** a student has already finished a course, **When** they open its curriculum, **Then** the primary
   action offers the completion summary
4. **Given** a student has *not* finished a course, **When** they open the completion URL directly, **Then**
   they are returned to the curriculum

### User Story 3 - Act on a finished course (Priority: P2)

From the completion screen a student can go and review the course, or return to their dashboard.

**Why this priority**: The review button existed but did nothing at all — it had no link and no handler. A
finished course is exactly the moment a review is worth asking for, and review eligibility opens at 100%
completion.

**Acceptance Scenarios**:

1. **Given** a student has not reviewed the course, **When** the screen renders, **Then** the primary action
   reads "Leave a Review" and leads to the reviews page
2. **Given** a student has already reviewed it, **When** the screen renders, **Then** the action reads "Edit
   Your Review"

## Requirements *(mandatory)*

### Functional

- **FR-001**: The system MUST expose one read-only endpoint returning the completion summary for one enrolled
  student on one course.
- **FR-002**: A student who is not actively enrolled MUST receive `403` with `{"error": ...}`. A deactivated
  enrolment (as left by a refund) counts as not enrolled.
- **FR-003**: `is_completed` MUST be true only when the course has at least one lecture, every lecture is
  complete for this student, and every quiz in the course has been passed by them.
- **FR-004**: `total_minutes` MUST be the sum of `Lecture.duration` over this student's completed lectures in
  this course, rounded to whole minutes, and MUST exclude lectures of other courses.
- **FR-005**: `quiz_average` MUST be the mean of the student's best score per quiz, over the quizzes of this
  course they have attempted, rounded to one decimal place; `null` when they have attempted none.
- **FR-006**: `completed_at` MUST be the later of the last lecture completion and the last passing quiz
  attempt, and MUST be `null` while the course is unfinished.
- **FR-007**: The completion page MUST redirect a student whose course is unfinished to that course's
  curriculum.
- **FR-008**: The end of the learning flow MUST lead to the completion screen: from the final lecture, from
  the result of the final quiz, and from the curriculum of an already-finished course.
- **FR-009**: The screen MUST NOT claim a certificate is available, coming, or pending.
- **FR-010**: The quiz-average tile MUST be omitted, not zeroed, when `quiz_average` is `null`.

### Out of scope

- **Certificates.** No generation, storage, link or claim. Tracked separately.
- **Measured watch time.** No playback position is recorded anywhere; `total_minutes` is content duration.
- **Per-course review deep links.** The review action goes to the reviews page, which already lists this
  course as reviewable.
- **Any write.** This feature stores nothing and changes no progress record.

## Implementation Status

Implemented on branch `013-instructor-earnings` on 2026-09-24, at the owner's direction, with this
specification written over it.

| Piece | Location |
|-------|----------|
| Completion rules | `backend/apps/progress/completion/service.py` |
| Endpoint | `CourseCompletionView` — `backend/apps/progress/views.py` |
| Route | `progress/student/learn/course/<id>/completion/` |
| Serializer | `CourseCompletionSerializer` — `backend/apps/progress/serializers.py` |
| Backend tests | `backend/apps/progress/tests_completion.py` — 21 tests, all passing |
| Page | `front-end/src/app/dashboard/learn/[id]/complete/page.tsx` |
| Component | `front-end/src/features/progress/components/student/CourseCompletion.tsx` |
| Hook / client | `useCourseCompletion.tsx`, `progressAPI.getCourseCompletion` |
| Reachability | `features/progress/utils.tsx` (`isCourseFinished`), `CourseContent.tsx`, `QuizResult.tsx` |

**No schema change and no migration**: every figure is derived from `LectureProgress`, `QuizAttempt`,
`Lecture.duration` and `Review`, all of which the platform already holds.

**Verified.** Backend tests pass, the frontend type-checks and lints clean, and the owner ran the
end-to-end browser walkthrough in [quickstart.md](./quickstart.md) on 2026-09-28 — all checks passed.
