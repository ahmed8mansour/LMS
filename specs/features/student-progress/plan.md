# Student Progress Tracking - Architecture Plan

## Architecture Overview

The Student Progress Tracking system uses a **granular progress model** where each lecture completion and quiz attempt is individually recorded. The architecture enforces sequential learning through a content locking system.

---

## Key Architectural Decisions

### 1. Granular Progress Tracking

**Decision:** Track each lecture and quiz separately rather than storing overall progress percentages.

**Rationale:**
- **Flexibility:** Can calculate progress in multiple ways
- **Audit Trail:** Know exactly what student completed when
- **Analytics:** Rich data for learning insights
- **Resumability:** Know exactly where student left off

**Implementation:**
```python
# Individual records for each completion
LectureProgress(user, lecture, is_completed, completed_at)
QuizAttempt(user, quiz, score, passed, attempted_at)
```

**Trade-off:** More database queries to calculate progress (mitigated with caching).

### 2. Sequential Unlocking System

**Decision:** Enforce sequential learning through programmatic locking.

**Rules:**
1. **Lectures:** Must complete previous lectures in section
2. **Quizzes:** Must complete all lectures in section
3. **Sections:** Must pass previous section's quiz

**Rationale:**
- **Pedagogical:** Ensures foundational knowledge
- **Motivation:** Clear progression path
- **Integrity:** Prevents quiz attempts without preparation

**Implementation:**
```python
def is_lecture_unlocked(user, lecture):
    if lecture.order == 1:
        return True
    
    previous_complete = LectureProgress.objects.filter(
        user=user,
        lecture__section=lecture.section,
        lecture__order__lt=lecture.order,
        is_completed=True
    ).count()
    
    return previous_complete == lecture.order - 1
```

### 3. Quiz Attempt Model

**Decision:** Store complete quiz answers for review and analytics.

**Structure:**
```python
QuizAttempt
├── score (calculated percentage)
├── passed (boolean)
└── QuizAttemptAnswer[]
    ├── question
    ├── selected_choice
    └── is_correct
```

**Rationale:**
- **Review:** Students can see what they got wrong
- **Analytics:** Identify weak areas
- **Integrity:** Audit trail of attempts

**Alternative Considered:** Only store score (rejected - loses valuable data)

### 4. Pass Threshold Configuration

**Decision:** Configurable pass threshold via settings.

**Current:**
```python
# settings.py
QUIZ_PASS_THRESHOLD = 50  # 50%
```

**Rationale:**
- Different courses may need different standards
- Easy to adjust globally
- Could be extended to per-quiz thresholds

### 5. Course Progress Calculation

**Decision:** Calculate progress dynamically from completed lectures.

**Formula:**
```python
progress = completed_lectures / total_lectures * 100
```

**Rationale:**
- **Real-time:** Always accurate
- **Simple:** Easy to understand
- **Consistent:** Same calculation everywhere

**Trade-off:** Database query required (cached in API response).

---

## Data Flow Architecture

### Dashboard Loading Flow

```
Student
  │-- Request Dashboard
  ▼
Backend
  │-- Get user's enrollments
  │-- For each enrollment:
  │   ├── Count total lectures
  │   ├── Count completed lectures
  │   └── Calculate progress %
  │
  │-- Calculate stats:
  │   ├── Sum completed courses (100% progress)
  │   ├── Count in-progress courses (<100%)
  │   └── Sum time from completed lectures
  │
  ▼
Return Dashboard Data
```

### Lecture Completion Flow

```
Student
  │-- Open /dashboard/learn/{course_id}/lecture/{lecture_id}
  │-- Frontend requests lecture detail
  ▼
Backend
  │-- Verify enrollment
  │-- Verify lecture is unlocked
  │-- Return lecture metadata and video_url
  ▼
Frontend
  │-- Render native HTML video player
  │-- Student clicks "Mark Complete"
  ▼
Backend
  │-- Verify enrollment
  │-- Verify lecture is unlocked
  │-- Create/update LectureProgress from lecture_id
  │
  ▼
Return Updated Status
  │-- lecture_id, is_completed, completed_at, already_completed
  │-- Frontend invalidates dashboard/course queries
```

### Quiz Submission Flow

```
Student
  │-- Opens quiz page
  │-- Current frontend displays mock quiz content only
  ▼
Backend
  │-- API exists for real submission, but frontend is not integrated yet
  │-- Verify quiz is unlocked
  │-- Validate all questions answered
  │-- Grade each answer:
  │   ├── Compare selected_choice to correct choice
  │   └── Set is_correct
  │
  │-- Calculate score:
  │   score = correct_count / total_questions * 100
  │
  │-- Determine pass:
  │   passed = score >= QUIZ_PASS_THRESHOLD
  │
  │-- Create QuizAttempt + QuizAttemptAnswers
  │
  │-- If passed:
  │   └── Unlock next section
  │
  ▼
Return Results
  │-- Score
  │-- Pass/fail
  │-- Question-by-question results
```

---

## Locking System Detail

### Locking Hierarchy

```
Course
└── Section 1 (UNLOCKED - first section)
    ├── Lecture 1.1 (UNLOCKED - first lecture)
    ├── Lecture 1.2 (LOCKED until 1.1 complete)
    ├── Lecture 1.3 (LOCKED until 1.2 complete)
    └── Quiz 1 (LOCKED until all section lectures complete)
        
└── Section 2 (LOCKED until Section 1 quiz passed)
    ├── Lecture 2.1 (LOCKED until section unlocked)
    ├── Lecture 2.2 (LOCKED until 2.1 complete)
    └── Quiz 2 (LOCKED until section lectures complete)

└── Section 3 (LOCKED until Section 2 quiz passed)
    └── ...
```

### Unlocking Events

| Event | Unlocks |
|-------|---------|
| Enroll in course | Section 1, Lecture 1.1 |
| Complete Lecture 1.1 | Lecture 1.2 |
| Complete Lecture 1.2 | Lecture 1.3 |
| Complete Lecture 1.3 | Quiz 1 |
| Pass Quiz 1 (≥50%) | Section 2, Lecture 2.1 |
| Complete Lecture 2.1 | Lecture 2.2 |
| ... | ... |

---

## API Design Patterns

### Nested Progress Response

**Course Detail:**
```json
{
  "course": { "id": 1, "title": "..." },
  "progress": 45.5,
  "sections": [
    {
      "id": 1,
      "title": "Section 1",
      "is_locked": false,
      "is_completed": true,
      "lectures": [
        {
          "id": 1,
          "title": "Lecture 1",
          "is_completed": true,
          "can_complete": true
        }
      ],
      "quiz": {
        "id": 1,
        "is_locked": false,
        "is_completed": true,
        "passed": true,
        "score": 85.0
      }
    }
  ]
}
```

### Progress Calculation Strategy

```python
# Efficient query using aggregation
total = Lecture.objects.filter(section__course=course).count()

completed = LectureProgress.objects.filter(
    user=user,
    lecture__section__course=course,
    is_completed=True
).count()

progress = (completed / total * 100) if total > 0 else 0
```

---

## Scalability Considerations

### Current Limitations

1. **Progress Calculation:** O(N) queries per course
2. **No Caching:** Progress recalculated on every request
3. **No Indexing:** Limited indexes on progress tables
4. **Response Contract Drift:** Progress endpoints currently return raw payloads instead of the project-wide `{ "data": {}, "status": 200 }` wrapper
5. ~~**Frontend Quiz Gap**~~ — **RESOLVED.** Quiz pages (`/quiz/[quizId]`, `/quiz/[quizId]/result`) are fully wired to `GET /learn/quiz/{id}/` and `POST /learn/quiz/makeattempt/`.

### Future Improvements

1. **Denormalized Progress Field:**
   ```python
   # Add to Enrollment model
   progress_percentage = DecimalField(default=0)
   
   # Update on each lecture completion
   ```

2. **Materialized Views:**
   ```sql
   -- Database-level view
   CREATE MATERIALIZED VIEW student_course_progress AS
   SELECT user_id, course_id, COUNT(*) as completed
   FROM progress_lectureprogress
   WHERE is_completed = true
   GROUP BY user_id, course_id;
   ```

3. **Caching Layer:**
   ```python
   # Cache progress for 5 minutes
   @cache_page(300)
   def get_course_progress(request, course_id):
       ...
   ```

---

## Security Architecture

### Access Control

| Resource | Check |
|----------|-------|
| Dashboard | Must be authenticated |
| Course Progress | Must be enrolled |
| Lecture Complete | Must be enrolled + lecture unlocked |
| Quiz Access | Must be enrolled + quiz unlocked |

### Validation Points

1. **Enrollment Check:**
   ```python
   enrollment = Enrollment.objects.filter(
       user=user,
       course=lecture.section.course,
       is_active=True
   ).first()
   
   if not enrollment:
       return Response({"error": "Not enrolled"}, status=403)
   ```

2. **Unlock Check:**
   ```python
   if not is_lecture_unlocked(user, lecture):
       return Response({"error": "Lecture locked"}, status=403)
   ```

3. **Quiz Retake Prevention:**
   ```python
   if QuizAttempt.objects.filter(user=user, quiz=quiz, passed=True).exists():
       return Response({"error": "Already passed"}, status=208)
   ```

---

## Files Organization

### Backend
```
apps/progress/
├── models.py
│   ├── LectureProgress
│   ├── QuizAttempt
│   └── QuizAttemptAnswer
├── views.py
│   ├── StudentDashboardOverviewView
│   ├── StudentDashboardCourses
│   ├── EnrolledCourseDetailView
│   ├── EnrolledSectionDetailView
│   ├── EnrolledLectureDetailView
│   ├── MarkLectureCompleteView
│   ├── SubmitQuizView
│   └── QuizEnrolledStudentView
├── serializers.py
│   └── [All serializers]
├── utils.py
│   ├── get_student_sorted_courses
│   ├── get_section_progress
│   ├── is_section_unlocked
│   ├── is_lecture_unlocked
│   └── is_quiz_unlocked
└── urls.py
```

### Frontend

#### Student Dashboard, Course, and Lecture Flow (IMPLEMENTED / PARTIAL)
```
featuers/progress/
├── api/
│   └── progress.api.ts            # overview, courses, course detail, lecture detail, mark complete
├── components/
│   └── student/
│       ├── dashboardoverview.tsx  # DashboardPage, StatCard, DashboardCourseCard
│       ├── DashboardCourses.tsx   # /dashboard/my-courses list and filters
│       ├── CourseContent.tsx      # /dashboard/learn/{id} overview
│       ├── LearnSideBar.tsx       # learning navigation and locks
│       ├── LectureContent.tsx     # lecture video page
│       └── MarkLectureComplete.tsx
├── hooks/
│   ├── useStudentDashboardOverview.tsx
│   ├── useStudentDashboardCourses.tsx
│   ├── useEnrolledStudentCourseOverView.tsx
│   ├── useEnrolledLectureDetail.tsx
│   └── useMakeLectureComplete.tsx
└── types/
    └── progress.types.ts          # dashboard, course, section, lecture interfaces
```

#### Quiz Flow (Not Integrated)
```
app/dashboard/learn/[id]/quiz/[quizId]/page.tsx          # mock quiz UI only
app/dashboard/learn/[id]/quiz/[quizId]/result/page.tsx   # mock quiz result UI only
featuers/progress/api/progress.api.ts                    # missing getQuiz(), submitQuiz()
featuers/progress/hooks/                                 # missing quiz query/mutation hooks
```

#### Billing Subfeature (IMPLEMENTED)

Billing is a subfeature of Student Progress, but the code lives in the `enrollment` app/feature
since that's where `Order`/`Transaction` are already owned — not under `apps/progress/` or
`featuers/progress/`.

```
apps/enrollment/                       # backend home for billing
├── models.py            # Order.created_at, Transaction.created_at (new fields, migration 0011)
├── pagination.py         # BillingPageNumberPagination (page_size=6)
├── serializers.py        # BillingSummarySerializer, StudentOrderHistorySerializer
├── views.py              # StudentBillingSummaryView, StudentOrderHistoryView
└── urls.py                # student/billing/summary/, student/orders/

featuers/enrollment/                   # frontend home for billing (no separate billing.api.ts /
                                        # billing.types.ts — added to the existing single
                                        # enrollment.api.ts / enrollment.types.ts, matching how
                                        # featuers/progress bundles multiple domains in one file)
├── api/enrollment.api.ts        # + enrollmentAPI.getBillingSummary, getBillingOrders
├── types/enrollment.types.ts    # + BillingSummary, OrderHistoryItem, OrdersPage
├── hooks/
│   ├── useBillingSummary.tsx
│   └── useStudentOrders.tsx
└── components/billing/
    ├── BillingSummary.tsx      # payment summary stat cards
    └── TransactionHistory.tsx  # order table + pagination

app/dashboard/(main)/settings/billing/page.tsx
# composes BillingSummary + TransactionHistory; the static Tax Invoice / Contact Support
# cards are hardcoded directly in the page (too small/static to extract into a component)
```

---

## Alternative Approaches Considered

### 1. Overall Progress Only
**Rejected:** Store only percentage, not individual completions
- Lose audit trail
- Can't resume specific lectures
- Less analytics capability

### 2. Self-Paced (No Locking)
**Rejected:** Allow students to access any content
- Doesn't enforce learning sequence
- Students might skip foundational content
- Quiz attempts without preparation

### 3. Video Watch Time Tracking
**Considered for future:** Track actual video watch progress
- More accurate completion
- Requires video player integration
- More complex implementation

---

## Maintenance Notes

### Regular Tasks
- Archive old quiz attempts (keep last 3 per quiz per user)
- Clean up incomplete lecture progress (older than 1 year)
- Monitor average quiz scores for content quality
- Review frequently failed quizzes

### Data Migration Considerations
- Quiz threshold changes don't affect past attempts
- Adding lectures to course reduces progress % for existing students
- Consider recalculating progress after course updates
