# Student Progress Tracking - Data Model

This document describes all database entities owned by the Student Progress Tracking feature.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                  STUDENT PROGRESS TRACKING                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│ StudentProfile   │
│   (from Auth)    │
└────────┬─────────┘
         │
         │ One-to-Many
         │
    ┌────┴────────────────────┐
    │   LectureProgress       │
    ├─────────────────────────┤
    │ id (PK)                 │
    │ user (FK) ──────────────┼──▶ StudentProfile
    │ lecture (FK) ───────────┼──▶ Lecture
    │ is_completed            │
    │ completed_at            │
    └─────────────────────────┘

    ┌──────────────────┐
    │   QuizAttempt    │
    ├──────────────────┤
    │ id (PK)          │
    │ user (FK) ───────┼──▶ StudentProfile
    │ quiz (FK) ───────┼──▶ Quiz
    │ score            │
    │ passed           │
    │ attempted_at     │
    └────────┬─────────┘
             │
             │ One-to-Many
             │
        ┌────┴────────────────────┐
        │  QuizAttemptAnswer      │
        ├─────────────────────────┤
        │ id (PK)                 │
        │ attempt (FK) ───────────┼──▶ QuizAttempt
        │ question (FK) ──────────┼──▶ Question
        │ selected_choice (FK) ───┼──▶ Choice
        │ is_correct              │
        └─────────────────────────┘

RELATIONSHIPS WITH OTHER FEATURES:

LectureProgress ───▶ Lecture (Course Management)
QuizAttempt ────────▶ Quiz (Course Management)
QuizAttemptAnswer ──▶ Question (Course Management)
QuizAttemptAnswer ──▶ Choice (Course Management)
QuizAttemptAnswer ──▶ QuizAttempt (This Feature)
```

---

## Entities Owned by Student Progress Tracking

### 1. LectureProgress

Tracks completion status for each lecture by each student.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Auto-generated primary key |
| user | ForeignKey | FK → StudentProfile, non-null | Student who completed lecture |
| lecture | ForeignKey | FK → Lecture, non-null | Completed lecture |
| is_completed | BooleanField | default=False | Completion status |
| completed_at | DateTimeField | auto_now_add | When lecture was completed |

**Constraints:**
- Unique together: (user, lecture) - prevents duplicate completion records

**Relationships:**
- ForeignKey → StudentProfile
- ForeignKey → Lecture (from Course Management)

**Business Logic:**
- Created when student marks lecture complete
- `completed_at` set automatically on creation
- `is_completed` can be toggled (for un-complete functionality)

**Indexes:**
- `user` + `lecture`: Unique constraint
- `user` + `is_completed`: For counting completed lectures

---

### 2. QuizAttempt

Records a student's attempt at a quiz with score and pass status.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Auto-generated primary key |
| user | ForeignKey | FK → StudentProfile, non-null | Student who attempted quiz |
| quiz | ForeignKey | FK → Quiz, non-null | Attempted quiz |
| score | DecimalField | max_digits=5, decimal_places=2 | Percentage score (0-100) |
| passed | BooleanField | default=False | Whether student passed |
| attempted_at | DateTimeField | auto_now_add | When attempt was made |

**Constraints:**
- No unique constraints (allows multiple attempts)

**Relationships:**
- ForeignKey → StudentProfile
- ForeignKey → Quiz (from Course Management)
- ForeignKey (reverse) → QuizAttemptAnswer (one-to-many)

**Business Logic:**
- Created on quiz submission
- `score` calculated as: (correct answers / total questions) * 100
- `passed` determined by comparing score to QUIZ_PASS_THRESHOLD (50%)
- Multiple attempts allowed until passed
- Once passed, no more attempts allowed

**Indexes:**
- `user` + `quiz` + `passed`: For checking if user passed specific quiz
- `quiz`: For quiz statistics

---

### 3. QuizAttemptAnswer

Records each individual answer within a quiz attempt.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Auto-generated primary key |
| attempt | ForeignKey | FK → QuizAttempt, non-null, related_name='quizattemptanswer' | Parent attempt |
| question | ForeignKey | FK → Question, non-null | Question answered |
| selected_choice | ForeignKey | FK → Choice, non-null | Student's selected answer |
| is_correct | BooleanField | | Whether answer was correct |

**Constraints:**
- No unique constraints (allows multiple attempts)

**Relationships:**
- ForeignKey → QuizAttempt
- ForeignKey → Question (from Course Management)
- ForeignKey → Choice (from Course Management)

**Business Logic:**
- Created in bulk after quiz submission
- `is_correct` set by comparing `selected_choice` to the correct choice for the question
- Enables question-by-question review after attempt
- Supports analytics (which questions are frequently missed)

---

## Relationships to Other Features

### Course Management
- **LectureProgress.lecture → Lecture**: Which lecture was completed
- **QuizAttempt.quiz → Quiz**: Which quiz was attempted
- **QuizAttemptAnswer.question → Question**: Which question was answered
- **QuizAttemptAnswer.selected_choice → Choice**: Which answer was selected

### Authentication System
- **LectureProgress.user → StudentProfile**: Who completed the lecture
- **QuizAttempt.user → StudentProfile**: Who attempted the quiz

### Enrollment & Payments
- **Progress tracking requires active Enrollment**: Student must be enrolled to access progress features
- **Access control checks**: All progress endpoints verify enrollment

---

## Data Flow Examples

### Lecture Completion Flow

```
1. Student views lecture
2. Student clicks "Mark Complete"
3. Backend creates LectureProgress:
   {
       user: student_profile,
       lecture: lecture_123,
       is_completed: True,
       completed_at: "2025-04-06T14:30:00Z"
   }
4. Next lecture becomes unlocked
```

### Quiz Attempt Flow

```
1. Student completes all lectures in section
2. Quiz becomes unlocked
3. Student submits quiz with answers:
   [
       {question: 1, choice: 3},
       {question: 2, choice: 1},
       {question: 3, choice: 2}
   ]
4. Backend processes submission:
   a. Grade each answer (compare to correct choice)
   b. Calculate score: (2 correct / 3 questions) * 100 = 66.67%
   c. Determine pass: 66.67% >= 50% threshold = PASSED
5. Backend creates records:
   QuizAttempt:
   {
       user: student_profile,
       quiz: quiz_456,
       score: 66.67,
       passed: True,
       attempted_at: "2025-04-06T15:00:00Z"
   }
   
   QuizAttemptAnswers (3 records):
   [
       {attempt: attempt_id, question: 1, selected_choice: 3, is_correct: True},
       {attempt: attempt_id, question: 2, selected_choice: 1, is_correct: True},
       {attempt: attempt_id, question: 3, selected_choice: 2, is_correct: False}
   ]
6. Next section becomes unlocked
```

---

## Progress Calculations

### Course Progress Formula

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

### Section Progress

```python
def get_section_progress(user_profile, section):
    """
    Returns lecture completion status for section
    """
    lectures = Lecture.objects.filter(section=section)
    completed_ids = LectureProgress.objects.filter(
        user=user_profile,
        lecture__in=lectures,
        is_completed=True
    ).values_list('lecture_id', flat=True)
    
    return {
        'completed_lecture_ids': list(completed_ids),
        'total_lectures': lectures.count(),
        'completed_count': len(completed_ids)
    }
```

### Time Spent Calculation

```python
def calculate_time_spent(user_profile):
    """
    Sum of durations from all completed lectures
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

## TypeScript Interfaces

```typescript
// LectureProgress
interface LectureProgress {
    id: number;
    user: number;              // FK to StudentProfile
    lecture: number;           // FK to Lecture
    is_completed: boolean;
    completed_at: string;      // ISO 8601 date
}

// QuizAttempt
interface QuizAttempt {
    id: number;
    user: number;              // FK to StudentProfile
    quiz: number;              // FK to Quiz
    score: number;             // 0-100 percentage
    passed: boolean;
    attempted_at: string;      // ISO 8601 date
}

// QuizAttemptAnswer
interface QuizAttemptAnswer {
    id: number;
    attempt: number;           // FK to QuizAttempt
    question: number;          // FK to Question
    selected_choice: number;   // FK to Choice
    is_correct: boolean;
}

// Dashboard Data
interface DashboardStats {
    completed_courses: number;
    inprogress_courses: number;
    total_mins_spent: number;
}

interface DashboardCourse {
    course_id: number;
    title: string;
    thumbnail: string;
    progress: number;          // 0-100 percentage
    last_accessed: string | null;
    completed_at: string | null;
}

// Course Progress Detail
interface CourseProgress {
    course: {
        id: number;
        title: string;
        thumbnail: string;
    };
    progress: number;
    sections: SectionProgress[];
}

interface SectionProgress {
    id: number;
    title: string;
    order: number;
    is_locked: boolean;
    is_completed: boolean;
    completed_lectures: number;
    total_lectures: number;
    lectures: LectureStatus[];
    quiz: QuizStatus | null;
}

interface LectureStatus {
    id: number;
    title: string;
    duration: string;
    is_completed: boolean;
    can_complete: boolean;
}

interface QuizStatus {
    id: number;
    title: string;
    is_locked: boolean;
    is_completed: boolean;
    passed: boolean;
    score: number;
}

// Quiz Submission
interface QuizSubmission {
    quiz_id: number;
    answers: {
        question_id: number;
        choice_id: number;
    }[];
}

interface QuizResult {
    quiz_id: number;
    score: number;
    passed: boolean;
    total_questions: number;
    correct_answers: number;
    results: {
        question_id: number;
        selected_choice_id: number;
        is_correct: boolean;
    }[];
}
```

---

## Business Rules

### Lecture Completion Rules

1. **Sequential Access:** Must complete lectures in order within section
2. **Idempotent:** Can call "mark complete" multiple times safely
3. **Enrollment Required:** Must be enrolled in course
4. **Auto-Unlock:** Completing lecture unlocks next lecture

### Quiz Rules

1. **Unlock Condition:** All section lectures must be completed
2. **All Questions:** Must answer every question
3. **Pass Threshold:** 50% (configurable in settings)
4. **No Retake:** Cannot retake after passing
5. **Multiple Attempts:** Can retry until passed
6. **Answer Review:** Can see correct answers after passing

### Section Unlocking Rules

1. **First Section:** Always unlocked
2. **Subsequent Sections:** Unlocked when previous section's quiz is passed
3. **No Skip:** Cannot skip sections

---

## Indexes Summary

| Entity | Field(s) | Type | Purpose |
|--------|----------|------|---------|
| LectureProgress | (user, lecture) | Unique | Prevent duplicate completions |
| LectureProgress | user | B-tree | Find user's progress |
| LectureProgress | lecture | B-tree | Find who completed lecture |
| LectureProgress | (user, is_completed) | Composite | Count completed |
| QuizAttempt | (user, quiz, passed) | Composite | Check if passed |
| QuizAttempt | quiz | B-tree | Quiz statistics |
| QuizAttempt | user | B-tree | User's attempt history |
| QuizAttemptAnswer | attempt | B-tree | Get answers for attempt |

### Recommended Additional Indexes

```python
class LectureProgress(models.Model):
    class Meta:
        indexes = [
            # For calculating course progress efficiently
            models.Index(fields=['user', 'lecture__section__course', 'is_completed']),
        ]

class QuizAttempt(models.Model):
    class Meta:
        indexes = [
            # For dashboard stats
            models.Index(fields=['user', 'passed', 'attempted_at']),
        ]
```

---

## Cascade Behavior

### Deletion Rules

**StudentProfile Deletion:**
```
StudentProfile.delete()
    └── CASCADE LectureProgress.delete()      [All user's progress]
    └── CASCADE QuizAttempt.delete()          [All user's attempts]
        └── CASCADE QuizAttemptAnswer.delete() [All attempt answers]
```

**Lecture Deletion:**
```
Lecture.delete()
    └── CASCADE LectureProgress.delete()      [All completions of this lecture]
```

**Quiz Deletion:**
```
Quiz.delete()
    └── CASCADE QuizAttempt.delete()          [All attempts of this quiz]
        └── CASCADE QuizAttemptAnswer.delete() [All attempt answers]
```

**Question Deletion:**
```
Question.delete()
    └── PROTECT QuizAttemptAnswer             [Preserve answer history]
    # Note: Should handle gracefully, may need soft delete
```

**Choice Deletion:**
```
Choice.delete()
    └── PROTECT QuizAttemptAnswer             [Preserve answer history]
```

---

## Data Retention

### Recommended Cleanup Tasks

**Old Incomplete Progress:**
```sql
-- Delete lecture progress records for unenrolled users
DELETE FROM progress_lectureprogress
WHERE user_id NOT IN (
    SELECT student_profile_id FROM enrollment_enrollment WHERE is_active = true
);
```

**Quiz Attempts Retention:**
```sql
-- Keep only last 3 attempts per quiz per user
DELETE FROM progress_quizattempt
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id, quiz_id ORDER BY attempted_at DESC
        ) as rn
        FROM progress_quizattempt
    ) t
    WHERE rn <= 3
);
```

**Old Answers:**
```sql
-- Archive or delete answers from old attempts
DELETE FROM progress_quizattemptanswer
WHERE attempt_id IN (
    SELECT id FROM progress_quizattempt
    WHERE attempted_at < NOW() - INTERVAL '1 year'
);
```

### Retention Policy

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Completed LectureProgress | Indefinite | Achievement record |
| Passed QuizAttempts | Indefinite | Certificate proof |
| Failed QuizAttempts | 1 year | Practice analytics |
| QuizAttemptAnswers | 1 year | Answer review |
| Incomplete Progress | Enrollment duration only | Temporary state |

---

## Sample Queries

### Get User's Completed Lectures in Course
```python
completed = LectureProgress.objects.filter(
    user=user_profile,
    lecture__section__course=course,
    is_completed=True
).select_related('lecture')
```

### Get Course Progress for Dashboard
```python
from django.db.models import Count, Q

progress_data = Course.objects.filter(
    enrollment__user=user
).annotate(
    total_lectures=Count('section__lecture'),
    completed_lectures=Count(
        'section__lecture',
        filter=Q(section__lecture__lectureprogress__user=user_profile, section__lecture__lectureprogress__is_completed=True)
    )
).values('id', 'title', 'total_lectures', 'completed_lectures')
```

### Get Quiz Statistics
```python
from django.db.models import Avg

stats = QuizAttempt.objects.filter(quiz=quiz).aggregate(
    avg_score=Avg('score'),
    pass_count=Count('id', filter=Q(passed=True)),
    total_count=Count('id')
)
```

### Get Student's Quiz History
```python
attempts = QuizAttempt.objects.filter(
    user=user_profile,
    quiz=quiz
).order_by('-attempted_at')
```

---

## Integration Examples

### Check if Lecture is Completed
```python
def is_lecture_completed(user_profile, lecture):
    return LectureProgress.objects.filter(
        user=user_profile,
        lecture=lecture,
        is_completed=True
    ).exists()
```

### Mark Lecture Complete
```python
def mark_lecture_complete(user_profile, lecture):
    progress, created = LectureProgress.objects.get_or_create(
        user=user_profile,
        lecture=lecture,
        defaults={'is_completed': True}
    )
    
    if not created and not progress.is_completed:
        progress.is_completed = True
        progress.save()
    
    return progress
```

### Grade Quiz
```python
def grade_quiz_attempt(user_profile, quiz, answers):
    """
    answers: [{question_id, choice_id}, ...]
    """
    questions = Question.objects.filter(quiz=quiz).prefetch_related('choice_set')
    
    correct_count = 0
    results = []
    
    for answer in answers:
        question = questions.get(id=answer['question_id'])
        selected = question.choice_set.get(id=answer['choice_id'])
        is_correct = selected.is_correct
        
        if is_correct:
            correct_count += 1
        
        results.append({
            'question_id': question.id,
            'selected_choice_id': selected.id,
            'is_correct': is_correct
        })
    
    score = round(correct_count / len(questions) * 100, 2)
    passed = score >= settings.QUIZ_PASS_THRESHOLD
    
    # Create attempt
    attempt = QuizAttempt.objects.create(
        user=user_profile,
        quiz=quiz,
        score=score,
        passed=passed
    )
    
    # Create answers
    QuizAttemptAnswer.objects.bulk_create([
        QuizAttemptAnswer(
            attempt=attempt,
            question=r['question_id'],
            selected_choice_id=r['selected_choice_id'],
            is_correct=r['is_correct']
        ) for r in results
    ])
    
    return attempt, results
```
