# Quickstart: Instructor Curriculum Builder — manual verification

Prerequisites: 003 (instructor shell/routing) and 004 (My Courses + course workspace) in place; signed in
as an **instructor** who owns at least one course; backend and frontend dev servers running.

## Backend setup (one-time for this feature)

```bash
# From backend/ — no migration is needed (no model changes). Just run the server.
python manage.py runserver
```

Frontend: install the new drag-and-drop dependency once, then run the dev server.

```bash
# From front-end/
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm run dev
```

## Walkthrough

1. **Open the builder.** Go to **My Courses → open a course → Curriculum** tab. A course with no sections
   shows the "Add your first section" empty state (not a blank page).
2. **Add sections.** Add “Getting started” and “Deep dive”. Each appears at the end of the list. Rename one
   inline and confirm it updates.
3. **Reorder sections.** Drag “Deep dive” above “Getting started” (or use keyboard: focus the handle, Space,
   Arrow, Space). Reload the page → the new order persists, with no duplicate/gapped numbering.
4. **Add lectures.** In a section, add “Installing Python” with duration `4:20` and “First app” `6:05`.
   Confirm each row shows a **video-status badge** (`PENDING`) and the video control is a **placeholder**
   (no upload happens here).
5. **Edit a lecture.** Open the lecture editor (`…/curriculum/lectures/[lectureId]`), change the duration to
   `5:00`, save, and confirm the row reflects `5:00`. (Behind the scenes it stored `5.00` minutes.)
6. **Reorder lectures.** Drag lectures within the section; reload → order persists. Confirm you **cannot**
   drag a lecture into a different section (out of scope).
7. **Add a quiz.** On a section with no quiz, click **+ Quiz**. The section gains a single quiz and the
   affordance becomes **Edit quiz**. Try to add a second quiz → it is not offered / is refused.
8. **Author questions & choices.** In the quiz editor (`…/quizzes/[quizId]`): add a question with text and
   three choices, mark one **Correct**. Mark a different choice correct → the previous one is unmarked
   (exactly one correct). Add a question with only one choice → it is **flagged incomplete**.
9. **Reorder questions.** Reorder questions; reload → order persists. Confirm the quiz's question count
   updates automatically as you add/delete questions (you never type the count).
10. **Guarded deletes.** Delete a lecture in a course with **no** enrollments → light confirm. Delete a
    section in a course **with** enrolled students → the confirmation names permanent removal + students
    losing access. Cancel → nothing changes.
11. **Ownership.** In a second browser/profile as a **different** instructor, hit a section/lecture/quiz/
    question/choice ID from the first instructor by URL/API → refused, no data shown.
12. **Draft stays hidden.** Confirm the course is still a draft and none of this content appears in any
    student-facing/public listing; publish status is unchanged.

## API smoke test (optional, with cookies)

```bash
# List a quiz's questions (with nested choices) — owned quiz only
curl -s --cookie "access_token=…" "http://localhost:8000/courses/instructor/questions/?quiz=17"

# Create a section (order auto-assigned to end)
curl -s -X POST --cookie "access_token=…" -H "Content-Type: application/json" \
  -d '{"course": 42, "title": "Getting started"}' \
  "http://localhost:8000/courses/instructor/sections/"

# Reorder: move section 9 to position 0 — server renumbers safely, no 500
curl -s -X PATCH --cookie "access_token=…" -H "Content-Type: application/json" \
  -d '{"order": 0}' "http://localhost:8000/courses/instructor/sections/9/"

# Second quiz on a section returns a clean 400, not a 500
curl -s -X POST --cookie "access_token=…" -H "Content-Type: application/json" \
  -d '{"section": 5, "title": "Dup"}' "http://localhost:8000/courses/instructor/quizzes/"
```

## Expected results (maps to Success Criteria)

- Reorders persist unique/gap-free on reload (SC-002); zero 500s on reorder.
- Invalid input (empty title, bad `mm:ss`) blocked with field errors (SC-003).
- Each question has ≤1 correct; <2 choices or no-correct is flagged (SC-004).
- Cross-owner access refused everywhere (SC-005).
- No section holds >1 quiz (SC-006).
- Every delete confirmed; enrolled-course deletes name loss-of-access (SC-007).
- Loading/empty/error states everywhere; no blank/crash (SC-008).
- Nothing appears student-facing; publish status unchanged (SC-009).
