# Feature: Student Progress Tracking

## Overview

The Student Progress Tracking system monitors student learning activities, including lecture completion and quiz performance. It provides the backend infrastructure for the student dashboard and learning analytics.

---

## Status: BACKEND COMPLETE / FRONTEND MISSING

This feature has fully functional backend APIs but no frontend dashboard implementation. The backend provides all necessary endpoints for tracking student progress.

---

## What This Feature Does

1. **Dashboard Overview**: Student statistics (completed courses, in-progress, time spent)
2. **Course Progress**: Track completion percentage per enrolled course
3. **Lecture Completion**: Mark lectures as complete (sequential unlocking)
4. **Quiz System**: Submit quiz attempts, score, pass/fail determination
5. **Section Locking**: Prevent quiz access until all lectures complete
6. **Progress Persistence**: Store completed lectures and quiz attempts

---

## Backend Endpoints

### Dashboard Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/progress/student/overview/` | GET | Yes | Dashboard stats + course list |
| `/progress/student/courses/` | GET | Yes | Enrolled courses with progress |

### Learning Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/progress/student/learn/course/{id}/` | GET | Yes | Course detail with section progress |
| `/progress/student/learn/section/{id}/` | GET | Yes | Section with lecture/quiz status |
| `/progress/student/learn/lecture/markcomplete/` | POST | Yes | Mark lecture complete |
| `/progress/student/learn/quiz/makeattempt/` | POST | Yes | Submit quiz answers |
| `/progress/student/learn/quiz/{id}/` | GET | Yes | Get quiz questions |

---

## Dashboard API

### StudentDashboardOverviewView

**Response (200):**
```json
{
  "stats": {
    "completed_courses": 3,
    "inprogress_courses": 2,
    "total_mins_spent": 1250
  },
  "courses": [
    {
      "course_id": 1,
      "title": "Python Bootcamp",
      "thumbnail": "https://...",
      "progress": 75.5,
      "last_accessed": "2025-04-05T10:30:00Z",
      "completed_at": null
    }
  ]
}
```

**Calculations:**
- `completed_courses`: Count of courses with 100% progress
- `inprogress_courses`: Count of courses with <100% progress
- `total_mins_spent`: Sum of duration from completed lectures

### StudentDashboardCourses

**Response (200):**
```json
[
  {
    "course_id": 1,
    "title": "Python Bootcamp",
    "thumbnail": "https://...",
    "progress": 75.5,
    "last_accessed": "2025-04-05T10:30:00Z"
  }
]
```

---

## Learning Flow APIs

### Course Detail with Progress

**Endpoint:** `GET /progress/student/learn/course/{course_id}/`

**Response (200):**
```json
{
  "course": {
    "id": 1,
    "title": "Python Bootcamp",
    "thumbnail": "..."
  },
  "progress": 45.5,
  "sections": [
    {
      "id": 1,
      "title": "Introduction",
      "order": 1,
      "is_locked": false,
      "is_completed": true,
      "completed_lectures": 3,
      "total_lectures": 3,
      "lectures": [
        {
          "id": 1,
          "title": "Welcome",
          "duration": "10.50",
          "is_completed": true,
          "can_complete": true
        }
      ],
      "quiz": {
        "id": 1,
        "title": "Introduction Quiz",
        "is_locked": false,
        "is_completed": true,
        "passed": true,
        "score": 85.0
      }
    }
  ]
}
```

**Locking Logic:**
- Section 1: Always unlocked
- Section N: Unlocked when section N-1 quiz passed

### Mark Lecture Complete

**Endpoint:** `POST /progress/student/learn/lecture/markcomplete/`

**Request:**
```json
{
  "lecture": 123
}
```

**Response (200):**
```json
{
  "lecture_id": 123,
  "is_completed": true,
  "completed_at": "2025-04-06T14:30:00Z",
  "already_completed": false
}
```

**Validation:**
- User must be enrolled in the course
- Lecture must be unlocked (sequential)
- Idempotent (safe to call multiple times)

### Get Quiz

**Endpoint:** `GET /progress/student/learn/quiz/{quiz_id}/`

**Response (200) - First Attempt:**
```json
{
  "id": 1,
  "title": "Introduction Quiz",
  "questions_count": 5,
  "questions": [
    {
      "id": 1,
      "text": "What is Python?",
      "order": 1,
      "choices": [
        {"id": 1, "text": "A programming language"},
        {"id": 2, "text": "A snake"},
        {"id": 3, "text": "A beverage"}
      ]
    }
  ],
  "passed": false
}
```

**Response (200) - After Passing:**
```json
{
  "id": 1,
  "title": "Introduction Quiz",
  "questions_count": 5,
  "questions": [
    {
      "id": 1,
      "text": "What is Python?",
      "choices": [
        {"id": 1, "text": "A programming language", "is_correct": true},
        {"id": 2, "text": "A snake", "is_correct": false},
        {"id": 3, "text": "A beverage", "is_correct": false}
      ]
    }
  ],
  "passed": true,
  "user_answers": {
    "1": 1,
    "2": 3
  }
}
```

**Note:** Correct answers only shown after passing.

### Submit Quiz

**Endpoint:** `POST /progress/student/learn/quiz/makeattempt/`

**Request:**
```json
{
  "quiz_id": 1,
  "answers": [
    {"question_id": 1, "choice_id": 1},
    {"question_id": 2, "choice_id": 3}
  ]
}
```

**Response (200):**
```json
{
  "quiz_id": 1,
  "score": 80.0,
  "passed": true,
  "total_questions": 5,
  "correct_answers": 4,
  "results": [
    {
      "question_id": 1,
      "selected_choice_id": 1,
      "is_correct": true
    }
  ]
}
```

**Validation:**
- All questions must be answered
- All answers must belong to correct questions
- Quiz must be unlocked (all lectures complete)
- Cannot retake after passing

**Pass Threshold:** 50% (configurable in settings.QUIZ_PASS_THRESHOLD)

---

## Data Models

### LectureProgress

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Auto-generated |
| user | FK → StudentProfile | Student |
| lecture | FK → Lecture | Completed lecture |
| is_completed | Boolean | Completion status |
| completed_at | DateTime | Completion timestamp |

**Constraints:** Unique together (user, lecture)

### QuizAttempt

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Auto-generated |
| user | FK → StudentProfile | Student |
| quiz | FK → Quiz | Attempted quiz |
| score | Decimal | Percentage score |
| passed | Boolean | Pass/fail status |
| attempted_at | DateTime | Attempt timestamp |

### QuizAttemptAnswer

| Field | Type | Description |
|-------|------|-------------|
| id | PK | Auto-generated |
| attempt | FK → QuizAttempt | Parent attempt |
| question | FK → Question | Question answered |
| selected_choice | FK → Choice | Student's answer |
| is_correct | Boolean | Grading result |

---

## Locking Logic

### Section Unlocking

```python
def is_section_unlocked(user_profile, section):
    """
    Section 1: Always unlocked
    Section N: Unlocked if previous section quiz passed
    """
    if section.order == 1:
        return True
    
    previous_section = Section.objects.get(
        course=section.course,
        order=section.order - 1
    )
    
    if not previous_section.quiz:
        return True
    
    return QuizAttempt.objects.filter(
        user=user_profile,
        quiz=previous_section.quiz,
        passed=True
    ).exists()
```

### Lecture Unlocking

```python
def is_lecture_unlocked(user_profile, lecture):
    """
    Lecture unlocked if:
    1. It's the first lecture in the section, OR
    2. All previous lectures in the section are completed
    """
    if lecture.order == 1:
        return True
    
    previous_lectures = Lecture.objects.filter(
        section=lecture.section,
        order__lt=lecture.order
    )
    
    completed_count = LectureProgress.objects.filter(
        user=user_profile,
        lecture__in=previous_lectures,
        is_completed=True
    ).count()
    
    return completed_count == previous_lectures.count()
```

### Quiz Unlocking

```python
def is_quiz_unlocked(user_profile, quiz):
    """
    Quiz unlocked if all lectures in section are completed
    """
    section_lectures = Lecture.objects.filter(section=quiz.section)
    total_lectures = section_lectures.count()
    
    completed_lectures = LectureProgress.objects.filter(
        user=user_profile,
        lecture__in=section_lectures,
        is_completed=True
    ).count()
    
    return completed_lectures == total_lectures
```

---

## Progress Calculation

### Course Progress

```python
def calculate_course_progress(user_profile, course):
    """
    Progress = completed_lectures / total_lectures * 100
    """
    total_lectures = Lecture.objects.filter(
        section__course=course
    ).count()
    
    completed_lectures = LectureProgress.objects.filter(
        user=user_profile,
        lecture__section__course=course,
        is_completed=True
    ).count()
    
    if total_lectures == 0:
        return 0
    
    return round(completed_lectures / total_lectures * 100, 1)
```

### Time Spent

```python
def calculate_time_spent(user_profile):
    """
    Sum duration of all completed lectures
    """
    completed_lectures = LectureProgress.objects.filter(
        user=user_profile,
        is_completed=True
    ).select_related('lecture')
    
    total_minutes = sum(
        float(progress.lecture.duration)
        for progress in completed_lectures
    )
    
    return total_minutes
```

---

## Edge Cases Handled

### Quiz Attempts

1. **Already Passed:**
   - Returns HTTP 208 (Already Reported)
   - Message: "You are passed with this quiz"

2. **Incomplete Answers:**
   - Returns HTTP 400
   - Lists missing questions

3. **Invalid Answers:**
   - Returns HTTP 400
   - Validates choices belong to questions

4. **Locked Quiz:**
   - Returns HTTP 403
   - Message: "Quiz is locked. Complete all lectures first."

### Lecture Completion

1. **Already Completed:**
   - Returns success
   - `already_completed: true` in response

2. **Locked Lecture:**
   - Returns HTTP 403
   - Validates sequential access

3. **Not Enrolled:**
   - Returns HTTP 403
   - Validates enrollment

---

## Known Limitations / TODOs

### Backend

1. **No Video Progress:** Only tracks lecture completion, not video watch progress
2. **No Time Tracking:** Doesn't track actual time spent watching
3. **No Resume:** Doesn't track last position in course
4. **No Analytics:** No learning analytics (time per section, etc.)

### Frontend (Missing)

1. **No Dashboard UI:** Backend exists, no frontend pages
2. **No Video Player:** No lecture viewing interface
3. **No Quiz UI:** No quiz taking interface
4. **No Progress Visualization:** No progress bars/charts

### Missing Features

1. **Certificates:** No certificate generation on completion
2. **Notes:** No student note-taking
3. **Bookmarks:** No bookmarking lectures
4. **Discussion:** No Q&A per lecture
5. **Offline Access:** No downloadable content

---

## Dependencies

### Backend
- Django ORM for progress tracking
- Decimal for score calculations

### Frontend (Required but Not Implemented)
- Video player component
- Quiz form components
- Progress visualization
- Dashboard layout
