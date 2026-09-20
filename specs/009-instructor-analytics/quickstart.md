# Quickstart: Verifying Instructor Analytics

**Feature**: `009-instructor-analytics` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/instructor-analytics.md](./contracts/instructor-analytics.md)

## Prerequisites

```bash
cd backend && env\Scripts\activate && python manage.py runserver
```

```bash
cd front-end && npm install && npm run dev
```

(`npm install` picks up the new `recharts` dependency.)

- Two instructor accounts (**A** and **B**). A owns at least two courses, one of them with 3–4 sections, a quiz
  on at least two sections, and at least one lecture-only section.
- At least four student accounts enrolled in A's courses (free courses are fine), plus one enrollment in B's
  course.
- Progress set up by learning as each student in `/dashboard/learn/...`, or through the Django admin
  (`LectureProgress`, `QuizAttempt`). To test periods, edit an `Enrollment.enrolled_at` in the admin or the
  shell to 45 days and 120 days ago.

## 1. Automated backend tests

```bash
cd backend && python manage.py test apps.course.tests_analytics
```

Use the module label, not `apps.course` (no `__init__.py` under `backend/apps/`). Re-run
`apps.course.tests_dashboard` and `apps.course.tests_publishing` to confirm nothing shared regressed.

## 2. Frontend gates

```bash
cd front-end && npx tsc --noEmit
```

```bash
cd front-end && npm run lint
```

## 3. Manual walkthrough (browser)

### A. One course (US1)
1. As A, open a course → **Analytics** tab. The URL has no `?days`, "Last 30 days" is selected, and you see
   three tiles, the enrollments line chart and the section drop-off chart.
2. Completion shows "`p% · n of d`". Check `n`/`d` against the students who finished every lecture **and**
   passed every quiz.
3. Have one student finish all lectures but fail the last quiz. They are **not** in completed, and they appear
   on that quiz's section bar.
4. A student who failed a quiz twice then passed counts once, as passed, in "Quiz pass rate".
5. Hover and tab-focus a line point and a drop-off bar. The exact value, date and full section title appear.

### B. Periods and the address (US2)
1. Select "Last 90 days". The URL becomes `?days=90`, and every tile and both charts change together, with a
   skeleton in between and never a mix of values.
2. The 45-day-old enrollment appears at 90 days and not at 30. The 120-day-old one appears only in "All time".
   The all-time line chart starts at the first enrollment's month.
3. Refresh: still 90 days. Open the link in a new tab: still 90 days.
4. Open `?days=7`: shows 30 days, no error.
5. With "All time" selected, open another course's Analytics tab from its workspace. It starts at 30 days.

### C. All courses (US3)
1. Sidebar → **Analytics**. Three tiles, enrollments chart, and **course drop-off** chart, lowest completion
   first.
2. A student enrolled in two of A's courses counts once in "Active students".
3. Click a course bar while on 90 days. The course's Analytics tab opens with `?days=90`.
4. A course with nobody enrolled in the period has no bar.

### D. Empty states
1. A course with no enrollments: tiles and charts say "No data yet" (All time) / "No data in this period",
   never "0%".
2. A course with no quizzes: "No quizzes". Quizzes but no attempts: "No attempts".
3. A new instructor with no courses → sidebar Analytics: empty state with a create-course link.

### E. Access (US4)
1. As A, request `GET /courses/instructor/courses/{B's course id}/analytics/`: 404, same as a nonexistent id.
2. As a student: 403 on both endpoints. Logged out: 401.
3. A's aggregate contains nothing from B's course.
4. Inspect a response: no student names, emails, avatars or user ids.

### F. Layout
1. At a 375px-wide viewport, both pages stack to one column with no horizontal scroll, and the bar labels
   truncate.
2. An instructor with many courses: the course drop-off chart grows taller, and labels stay readable.
