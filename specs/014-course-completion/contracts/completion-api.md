# API Contract: Course Completion Summary

**Feature**: 014-course-completion | **Date**: 2026-09-24 | **Spec**: [spec.md](../spec.md)

One endpoint, one enrolled student, one course. Read-only, derived entirely from existing records.

---

## 1. Endpoint

```
GET /progress/student/learn/course/<int:course_id>/completion/
```

| | |
|---|---|
| **View** | `CourseCompletionView(APIView)` — `apps/progress/views.py` |
| **Rules** | `build_course_completion()` — `apps/progress/completion/service.py` |
| **Auth** | `CookieJWTAuthentication` (project default) |
| **Permissions** | `IsAuthenticated`, plus an active `Enrollment` checked in the view |
| **Throttle** | none — a light student read, consistent with its siblings under `progress/` |
| **Methods** | `GET` only |
| **Pagination** | none — a single object |

A sibling of `progress/student/learn/course/<id>/`, not a nested resource of it: it answers a different
question from a different set of records (durations and quiz scores, not the section tree).

---

## 2. Success — `200 OK`

The payload directly, no envelope.

```json
{
  "course": {
    "id": 7,
    "title": "Advanced UI/UX Principles",
    "thumbnail": "https://res.cloudinary.com/.../thumb.jpg"
  },
  "is_completed": true,
  "lectures_completed": 12,
  "total_lectures": 12,
  "quizzes_passed": 3,
  "total_quizzes": 3,
  "total_minutes": 1110,
  "quiz_average": 92.0,
  "completed_at": "2026-09-24T11:04:38.201Z",
  "has_reviewed": false
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `course` | object | `id`, `title`, `thumbnail` — the little the screen needs |
| `is_completed` | bool | Every lecture complete **and** every quiz passed; false for a course with no lectures |
| `lectures_completed` | int | This student's completed lectures in this course |
| `total_lectures` | int | Lectures in the course |
| `quizzes_passed` | int | Quizzes of this course this student has passed |
| `total_quizzes` | int | Quizzes in the course; `0` is normal |
| `total_minutes` | int | Sum of `Lecture.duration` over completed lectures, rounded to whole minutes |
| `quiz_average` | float \| null | Mean of the best attempt per quiz sat, 1 dp; `null` when none sat |
| `completed_at` | datetime \| null | Later of last lecture completion and last passing attempt; `null` while unfinished |
| `has_reviewed` | bool | Whether this student already has a `Review` for this course |

### Notes on the figures

- **`total_minutes` is content duration, not observed watch time.** No playback position is recorded anywhere
  in the platform. Do not label it to a student as time they were watched.
- **`quiz_average` uses the best attempt per quiz.** A passed quiz cannot be retaken, so on a completed course
  the best attempt is the passing one — the figure never contradicts what the student was shown at the time.
- **Both are scoped to this course.** Progress on other courses never leaks into either.
- **No figure can be negative**, and `quizzes_passed` never exceeds `total_quizzes`.

---

## 3. Errors

| Status | Body | When |
|--------|------|------|
| `401` | DRF default | No valid cookie |
| `403` | `{"error": "You are not enrolled in this course"}` | No `Enrollment`, or `is_active=False` (e.g. after a refund) |
| `404` | `{"error": "Student profile not found"}` | Authenticated user has no `StudentProfile` |

**An unfinished course is not an error.** It returns `200` with `is_completed: false` and the figures so far,
so the client can distinguish "not yet" from "not allowed" without parsing a message.

---

## 4. Client

| | |
|---|---|
| **Client** | `progressAPI.getCourseCompletion(courseId)` |
| **Hook** | `useCourseCompletion(courseId)` |
| **Query key** | `['dashboard', 'student', 'enrolled', 'completion', String(id)]` |
| **Stale time** | 5 minutes, matching the sibling learning reads |
| **Retry** | Not retried on `403`/`404` |

Keyed under `dashboard` deliberately: `useMakeLectureComplete` and `useSubmitQuiz` both invalidate that
prefix, so marking the last lecture complete or passing the last quiz refreshes this summary without any
extra wiring. The quiz result page relies on exactly that to know whether the attempt it just submitted
finished the course.
