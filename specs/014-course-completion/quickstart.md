# Quickstart: Course Completion Summary

**Feature**: 014-course-completion | **Spec**: [spec.md](./spec.md)

Backend tests are automated and passing (`apps.progress.tests_completion`, 21 tests). What follows is the
browser walkthrough, which needs a signed-in student account and is the owner's to run.

---

## Automated — already run

```bash
cd backend && ./env/Scripts/python.exe manage.py test apps.progress.tests_completion
```

Expected: `Ran 21 tests ... OK`.

```bash
cd front-end && npx tsc --noEmit
```

Expected: no output.

> `apps.reviews.tests` fails 12 tests on this branch for an unrelated, pre-existing reason: the file still
> passes `video_url=` to `Lecture.objects.create`, a field spec 006 removed. Not touched by this feature.

---

## Browser walkthrough

### 1. A finished course shows real figures

1. Sign in as a student enrolled in a course with **at least one quiz**.
2. Complete every lecture and pass every quiz.
3. Land on the completion screen.

**Check**: the course title is the real one. Lectures reads your real `x/y`. Time Spent matches the sum of
the course's lecture durations (compare against the curriculum's total duration). Quiz Average matches your
quiz results. The badge reads **"Completed on <date>"** — there must be **no mention of a certificate**
anywhere on the page.

### 2. Reaching it from the last lecture

1. Use a course whose **last item is a lecture** (no trailing quiz).
2. Complete that last lecture.

**Check**: the Next control leads to `/dashboard/learn/<id>/complete` instead of being absent or dead.

### 3. Reaching it from the last quiz

1. Use a course whose **last item is a quiz**.
2. Pass that quiz.

**Check**: the result page's primary button reads **"Finish Course"** with a trophy icon and leads to the
completion screen; its description says the course is complete rather than "unlocked the next section".

### 4. Reaching it from the curriculum

1. Open the curriculum of a course you have already finished.

**Check**: the fixed bottom call to action reads **"View Completion Summary"** and leads to the completion
screen.

### 5. An unfinished course cannot open it

1. Pick a course you have **not** finished.
2. Navigate directly to `/dashboard/learn/<that id>/complete`.

**Check**: you are redirected to that course's curriculum. No congratulations screen, however briefly.

### 6. A course with no quizzes

1. Use a course with lectures and **no quizzes**, and complete it.

**Check**: the screen shows **two** tiles (Lectures, Time Spent) filling the row — no empty third slot and no
"0%" quiz average. The paragraph reads "every lecture in this course", without mentioning quizzes.

### 7. The review action

1. On the completion screen of a course you have not reviewed.

**Check**: the button reads **"Leave a Review"** and opens `/dashboard/reviews`, where this course appears
under "Courses You Can Review".

2. Submit a review, then return to the completion screen.

**Check**: the button now reads **"Edit Your Review"**.

### 8. Not enrolled

1. Signed in as a student **not** enrolled in a course, open its `/complete` URL.

**Check**: the "You aren't allowed to access this course" panel with an enrol call to action — not a blank
screen and not a crash.
