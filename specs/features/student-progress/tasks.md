# Student Progress Tracking - Tasks

## Status: BACKEND COMPLETE / FRONTEND MISSING

---

## Backend Tasks

### Models
- [x] LectureProgress model
  - [x] user (FK → StudentProfile)
  - [x] lecture (FK → Lecture)
  - [x] is_completed (Boolean)
  - [x] completed_at (DateTime)
  - [x] Unique together: (user, lecture)
- [x] QuizAttempt model
  - [x] user (FK → StudentProfile)
  - [x] quiz (FK → Quiz)
  - [x] score (Decimal)
  - [x] passed (Boolean)
  - [x] attempted_at (DateTime)
- [x] QuizAttemptAnswer model
  - [x] attempt (FK → QuizAttempt)
  - [x] question (FK → Question)
  - [x] selected_choice (FK → Choice)
  - [x] is_correct (Boolean)
- [x] Database migrations
- [x] Model constraints

### Dashboard APIs
- [x] StudentDashboardOverviewView
  - [x] GET endpoint
  - [x] Authentication required
  - [x] Calculate stats (completed, in-progress, time spent)
  - [x] Return courses with progress
  - [x] Handle no enrollments (204 response)
- [x] StudentDashboardCourses
  - [x] GET endpoint
  - [x] Return enrolled courses list
  - [x] Calculate progress per course

### Learning APIs
- [x] EnrolledCourseDetailView
  - [x] GET /learn/course/{id}/
  - [x] Return course with sections
  - [x] Calculate section progress
  - [x] Check enrollment
  - [x] Locking status per section
- [x] EnrolledSectionDetailView
  - [x] GET /learn/section/{id}/
  - [x] Return section with lectures/quiz
  - [x] Check section access
  - [x] Lecture completion status
- [x] MarkLectureCompleteView
  - [x] POST /learn/lecture/markcomplete/
  - [x] Mark lecture complete
  - [x] Check enrollment
  - [x] Check lecture unlock
  - [x] Idempotent (safe to call multiple times)
- [x] SubmitQuizView
  - [x] POST /learn/quiz/makeattempt/
  - [x] Validate all questions answered
  - [x] Calculate score
  - [x] Check pass threshold (50%)
  - [x] Create QuizAttempt + Answers
  - [x] Prevent retake if passed
  - [x] Return detailed results
- [x] QuizEnrolledStudentView
  - [x] GET /learn/quiz/{id}/
  - [x] Return quiz questions
  - [x] Hide correct answers until passed
  - [x] Show previous answers if passed

### Utilities
- [x] get_student_sorted_courses
- [x] get_section_progress
- [x] is_section_unlocked
- [x] is_lecture_unlocked
- [x] is_quiz_unlocked

### Serializers
- [x] StudentDashboardOverviewSerializer
- [x] CourseOverviewSerializer
- [x] EnrolledCourseSerializer
- [x] SectionProgressSerializer
- [x] LectureCompleteResponseSerializer
- [x] QuizSubmitSerializer
- [x] QuizSubmitResponseSerializer
- [x] QuizDataSerializer

### Security
- [x] Authentication on all endpoints
- [x] Enrollment verification
- [x] Section/quiz access control
- [x] Sequential unlocking enforcement

---

## Frontend Tasks

### Dashboard Pages (Not Implemented)
- [ ] /dashboard page
  - [ ] Stats cards (completed, in-progress, time spent)
  - [ ] Enrolled courses list
  - [ ] Course progress bars
  - [ ] Continue learning CTAs
- [ ] /dashboard/courses page
  - [ ] All enrolled courses
  - [ ] Sort/filter enrolled courses
- [ ] /dashboard/course/{id} page
  - [ ] Course curriculum
  - [ ] Section accordion
  - [ ] Lecture list
  - [ ] Quiz access
  - [ ] Progress indicators

### Video Player (Not Implemented)
- [ ] Video player component
  - [ ] Cloudinary video playback
  - [ ] Play/pause controls
  - [ ] Progress bar
  - [ ] Duration display
  - [ ] Fullscreen toggle
- [ ] Lecture completion button
  - [ ] Mark complete action
  - [ ] Auto-complete on video end
- [ ] Next/prev lecture navigation

### Quiz UI (Not Implemented)
- [ ] Quiz component
  - [ ] Question display
  - [ ] Multiple choice options
  - [ ] Submit button
  - [ ] Progress indicator
- [ ] Quiz results component
  - [ ] Score display
  - [ ] Pass/fail status
  - [ ] Correct/incorrect answers
  - [ ] Retry button (if failed)
- [ ] Quiz lock message
  - [ ] "Complete all lectures first"

### Hooks (Not Implemented)
- [ ] useDashboardOverview
- [ ] useEnrolledCourses
- [ ] useCourseProgress
- [ ] useLectureComplete
- [ ] useQuizData
- [ ] useQuizSubmit

### API Layer (Not Implemented)
- [ ] progressAPI.getDashboardOverview
- [ ] progressAPI.getEnrolledCourses
- [ ] progressAPI.getCourseProgress
- [ ] progressAPI.getSectionDetail
- [ ] progressAPI.markLectureComplete
- [ ] progressAPI.getQuiz
- [ ] progressAPI.submitQuiz

---

## Integration Tasks

### Backend Integration
- [x] LectureProgress → Lecture
- [x] QuizAttempt → Quiz
- [x] QuizAttemptAnswer → Question/Choice
- [x] Enrollment check on all endpoints

### Frontend Integration (Not Implemented)
- [ ] Dashboard navigation
- [ ] Course access from dashboard
- [ ] Video player integration
- [ ] Quiz flow integration
- [ ] Progress persistence

---

## Testing Tasks

### Backend Tests
- [ ] Unit test: Progress calculation
- [ ] Unit test: Section unlocking
- [ ] Unit test: Quiz scoring
- [ ] Integration test: Mark lecture complete
- [ ] Integration test: Quiz submission
- [ ] Integration test: Sequential locking

### Frontend Tests (Not Applicable - Not Implemented)
- [ ] Video player tests
- [ ] Quiz form tests
- [ ] Progress calculation tests

---

## Known Issues

### Backend
- [ ] No video watch progress tracking
- [ ] No resume position tracking
- [ ] No time spent analytics
- [ ] Quiz pass threshold hardcoded (should be per-quiz)

### Missing Features
- [ ] Certificate generation
- [ ] Student notes
- [ ] Lecture bookmarks
- [ ] Course discussion/Q&A
- [ ] Offline content download
- [ ] Learning analytics

---

## Documentation Tasks
- [x] API endpoint documentation
- [x] Data flow documentation
- [ ] Frontend integration guide (pending implementation)
