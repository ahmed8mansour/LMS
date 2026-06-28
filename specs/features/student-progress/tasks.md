# Student Progress Tracking - Tasks

## Status: BACKEND IMPLEMENTED / FRONTEND PARTIALLY IMPLEMENTED

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

### Dashboard Pages

#### Student Dashboard Overview (IMPLEMENTED)
- [x] /dashboard page
  - [x] Stats cards (Total Enrolled, In Progress, Completed)
  - [x] Enrolled courses list with progress bars
  - [x] Overall progress circular indicator
  - [x] Continue Learning banner
  - [x] Learning Activity section (hours learned, lectures completed, courses completed)
  - [x] Loading skeleton states
  - [x] Empty state with "Browse Courses" CTA
  - [x] Error state with retry button

#### Enrolled Courses Page (IMPLEMENTED)
- [x] /dashboard/my-courses page
  - [x] All enrolled courses
  - [x] Filter enrolled courses by all/in-progress/completed
  - [x] Progress bars on course cards
  - [x] Loading, error, and empty states

#### Course Learning Page (IMPLEMENTED)
- [x] /dashboard/learn/{id} page
  - [x] Course curriculum data loading
  - [x] Course progress indicator
  - [x] Start/review learning CTA
  - [x] Enrollment/forbidden access handling
- [x] Learning sidebar
  - [x] Section accordion
  - [x] Lecture list
  - [x] Quiz access links when unlocked
  - [x] Locked section/lecture/quiz indicators
  - [x] Progress indicators

### Video Player / Lecture Page (PARTIALLY IMPLEMENTED)
- [x] Lecture detail page `/dashboard/learn/{id}/lecture/{lectureId}`
- [x] Native HTML video player using lecture `video_url`
  - [x] Cloudinary/video URL playback
  - [x] Browser-native play/pause controls
  - [x] Browser-native duration display
  - [x] Browser-native fullscreen support
- [x] Lecture completion button
  - [x] Mark complete action
  - [ ] Auto-complete on video end
- [x] Next/prev lecture navigation

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

### Hooks

#### Implemented
- [x] useStudentDashboardOverview
- [x] useStudentDashboardCourses
- [x] useEnrolledStudentCourseOverview
- [x] useEnrolledLectureDetail
- [x] useMakeLectureCompleted

#### Not Implemented
- [ ] useEnrolledSectionDetail
- [ ] useQuizData
- [ ] useQuizSubmit

### API Layer

#### Implemented
- [x] progressAPI.getStudentDashboardOverview
- [x] progressAPI.getStudentDashboardCourses
- [x] progressAPI.getEnrolledCourseOverview
- [x] progressAPI.getEnrolledLectureDetail
- [x] progressAPI.makeLectureCompleted

#### Not Implemented
- [ ] progressAPI.getSectionDetail
- [ ] progressAPI.getQuiz
- [ ] progressAPI.submitQuiz

---

## Integration Tasks

### Backend Integration
- [x] LectureProgress → Lecture
- [x] QuizAttempt → Quiz
- [x] QuizAttemptAnswer → Question/Choice
- [x] Enrollment check on all endpoints

### Frontend Integration (Partially Implemented)
- [x] Dashboard protected route
- [x] My Courses route
- [x] Learning route layout with sidebar
- [x] Course learning overview API integration
- [x] Lecture detail API integration
- [x] Lecture completion persistence
- [ ] Course cards/button navigation to learning route
- [ ] Quiz flow integration
- [x] Lecture progress persistence

---

## Testing Tasks

### Backend Tests
- [ ] Unit test: Progress calculation
- [ ] Unit test: Section unlocking
- [ ] Unit test: Quiz scoring
- [ ] Integration test: Mark lecture complete
- [ ] Integration test: Quiz submission
- [ ] Integration test: Sequential locking

### Frontend Tests
- [ ] Video player tests
- [ ] Lecture completion tests
- [ ] Learning sidebar tests
- [ ] Quiz form tests
- [ ] Progress calculation tests

---

## Known Issues

### Backend
- [ ] No video watch progress tracking
- [ ] No resume position tracking
- [ ] No time spent analytics
- [ ] Quiz pass threshold hardcoded (should be per-quiz)
- [ ] API responses do not yet use the project-wide `{ "data": {}, "status": 200 }` wrapper
- [ ] Missing request fields can raise raw `KeyError` in lecture/quiz write endpoints

### Frontend
- [ ] Quiz and quiz result pages use mock data
- [ ] Dashboard course-card CTA is not wired as a link to `/dashboard/learn/{id}`
- [ ] No video auto-complete on playback end

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
- [x] Frontend integration documentation for implemented dashboard/course/lecture flow
- [ ] Frontend quiz integration guide (pending implementation)
