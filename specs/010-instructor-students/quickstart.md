# Quickstart: Verifying the Instructor Student Roster

**Feature**: `010-instructor-students` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/instructor-students.md](./contracts/instructor-students.md)

## Prerequisites

```bash
cd backend && env\Scripts\activate && python manage.py runserver
```

```bash
cd front-end && npm run dev
```

No new runtime package is installed — shadcn's table is vendored source.

**Fixture data.** The edge cases only show up with slightly awkward data, so set this up deliberately:

- Two instructor accounts, **A** and **B**.
- **A** owns at least three courses: one with lectures and ≥ 25 students (to cross a page boundary), one with
  **no lectures at all** (to see the `—` progress cell), and one with **no students**.
- **B** owns one course with students — nothing of B's may ever appear in A's roster.
- Among A's students, include: one with **no profile picture**, one with **blank first and last names** (so
  the username shows), one enrolled in **two** of A's courses, and one whose enrolment has been **refunded**
  (`is_active=False` via the admin).
- Give a few students partial progress by learning through `/dashboard/learn/...`, or by adding
  `LectureProgress` rows with `is_completed=True` in the admin.
- **For the ordering test**: set two or three enrolments to the *exact same* `enrolled_at` in the Django shell,
  straddling the 20-row page boundary.

## 1. Automated backend tests

```bash
cd backend && python manage.py test apps.course.tests_roster
```

Use the module label, not `apps.course` (there is no `__init__.py` under `backend/apps/`).

Then confirm nothing shared regressed — `person_name` was renamed in `dashboard/service.py`:

```bash
cd backend && python manage.py test apps.course.tests_dashboard apps.course.tests_analytics
```

## 2. Frontend gates

```bash
cd front-end && npx tsc --noEmit
```

```bash
cd front-end && npm run lint
```

## 3. The endpoint, without the UI

Sign in as **A** in the browser first so the cookie is set, then hit these directly. Every one of them is a
case the UI cannot easily show you.

| # | URL | Expect |
|---|-----|--------|
| 1 | `/courses/instructor/students/` | Every owned course; rows carry `course`; newest first |
| 2 | `/courses/instructor/students/?course=<A's course>` | Only that course |
| 3 | `/courses/instructor/students/?course=<B's course>` | `404` |
| 4 | `/courses/instructor/students/?course=999999` | `404` — **compare the body to #3, byte for byte** |
| 5 | `/courses/instructor/students/?course=abc` | `404`, same again — not a `500` |
| 6 | `/courses/instructor/students/?page=999` | `200`, page 1 |
| 7 | `/courses/instructor/students/?page=abc` | `200`, page 1 |
| 8 | `/courses/instructor/students/?search=%20%20` | `200`, the full roster (whitespace is not a search) |
| 9 | `?course=<the lecture-less course>` | Every row's `progress` is `null` |
| 10 | Any response | No `@` email, no order/transaction/quiz/lecture field anywhere in the body |

Then sign in as a **student** and repeat #1 → `403`. Sign out and repeat → `401`.

**The refund check**: note `count` on #2, refund one enrolment in the admin (`is_active=False`), reload.
`count` must drop by one and the row must be gone.

**The tie check**: request page 1 and page 2 of the roster with the duplicated `enrolled_at` values twice
each. The same ids must come back in the same order every time, and no id may appear on both pages. This is
the one that fails if the `-id` tiebreak is missing, and it fails intermittently — run it a few times.

## 4. Per-course roster (User Stories 1–3)

Open `/instructor/courses/<A's big course>/students`.

- [ ] The **Students** tab is marked active; the workspace tab bar and breadcrumb are intact
- [ ] The header states the total student count — matching `count`, not 20
- [ ] Each row shows picture, name, enrolment date and a progress bar with a percentage
- [ ] The student with no picture shows initials, not a broken image
- [ ] The student with no name shows their username
- [ ] The refunded student is absent
- [ ] Rows are newest-enrolment-first
- [ ] There is **no** Course column

**Search**
- [ ] Type three letters of a student's first name — the list narrows shortly after you stop typing
- [ ] Typing feels immediate (the box is not waiting on the network per keystroke)
- [ ] Search finds a student who was on page 3 before
- [ ] Type a full `"first last"` — still matches
- [ ] Type in lower case — still matches
- [ ] A term matching nobody shows a **"no students match"** state naming the term, with a clear action
- [ ] Clearing the box restores the full roster
- [ ] The "no students match" state's clear action empties **the box as well as** the URL (not just the URL)
- [ ] Search for something, then press Back — the box shows the previous term, not the current one
- [ ] The URL carries `?search=`; refresh keeps the term **and** the box's contents

**Paging**
- [ ] The position reads like `1–20 of 318`
- [ ] Previous is disabled on page 1; Next is disabled on the last page
- [ ] Moving to page 2 shows a skeleton, **not** page 1's rows greyed out — then new rows
- [ ] The URL carries `?page=`; refresh and Back/Forward keep it
- [ ] Search while on page 5 → results start at page 1, and the URL shows page 1 with no flicker of a
      second request
- [ ] Paging through a search pages the matches only

**Other courses**
- [ ] The lecture-less course shows `—` in every progress cell, never `0%`
- [ ] The empty course shows "no students yet", not an empty table with headers
- [ ] Ownership: put B's course id into the URL — you get the 403/not-found view, not a table

## 5. Cross-course roster (User Story 4)

Open `/instructor/students`.

- [ ] The sidebar **Students** item is active; the placeholder is gone
- [ ] Students from all three of A's courses appear together
- [ ] There **is** a Course column
- [ ] The student enrolled in two courses appears **twice**, with different courses and different progress
- [ ] Ordering is newest-first across courses, not grouped by course
- [ ] Search and paging behave exactly as on the per-course view
- [ ] None of **B**'s students appear

**Empty states** — create a fresh instructor account with no courses at all and open the page:
- [ ] It offers to create a course, rather than showing an empty table
- [ ] An instructor with courses but no students gets the *other* message

## 6. Responsive and theme

- [ ] At 375px both views scroll vertically only — no horizontal page scroll, nothing clipped
- [ ] Every field is still readable at 375px: picture, name, date, progress (and course, on the sidebar view)
- [ ] The table reads as part of the app — house tokens, not shadcn's default greys
- [ ] Dark mode renders correctly

## 7. Regression

- [ ] `/instructor` (008) and `/instructor/analytics` (009) still render — `person_name` was renamed
- [ ] `/dashboard` and `/dashboard/my-courses` are untouched, and the student's own course progress matches
      what the roster reports for them
- [ ] No console errors on any of the pages above
