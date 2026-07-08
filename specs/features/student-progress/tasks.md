# Student Progress Tracking - Tasks

## Status: BACKEND IMPLEMENTED / FRONTEND FULLY IMPLEMENTED (including Billing subfeature)

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
  - [x] QuestionDataSerializer exposes `id` field (required for frontend submission)

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

### Quiz UI (IMPLEMENTED)
- [x] Quiz component (`featuers/progress/components/student/QuizContent.tsx`)
  - [x] Question display (dynamic from API, not hardcoded)
  - [x] Multiple choice options with radio-card styling
  - [x] Submit button — disabled until all questions answered
  - [x] Loading skeleton state
  - [x] Locked/forbidden state with lock icon and message
  - [x] Error state with retry button
  - [x] Review mode — read-only view when quiz already passed, shows correct/incorrect per choice
  - [x] "Already passed" banner in review mode
  - [x] Fixed bottom submit bar (respects sidebar offset)
- [x] Quiz results component (`featuers/progress/components/student/QuizResult.tsx`)
  - [x] Score display (percentage)
  - [x] Pass/fail status with colour coding (darkmint / destructive)
  - [x] Correct answers count metric
  - [x] "Continue" button on pass → `/dashboard/learn/{id}`
  - [x] "Review Answers" button on pass → loads QuizContent in review mode
  - [x] "Retry Quiz" button on fail → returns to quiz page
  - [x] Redirect to quiz page if result cache is missing (refresh / direct URL)
- [x] Quiz lock message — "Complete all lectures in this section first" (403 state in QuizContent)

### Hooks

#### Implemented
- [x] useStudentDashboardOverview
- [x] useStudentDashboardCourses
- [x] useEnrolledStudentCourseOverview
- [x] useEnrolledLectureDetail
- [x] useMakeLectureCompleted
- [x] useQuizData (`hooks/useQuizData.tsx`) — useQuery, staleTime 5 min, no retry on 403/404, surfaces `isForbidden` + `customErrorMessage`
- [x] useSubmitQuiz (`hooks/useSubmitQuiz.tsx`) — useMutation, caches result via `setQueryData(['quiz-result'])`, invalidates `['dashboard']` on success

#### Not Implemented
- [ ] useEnrolledSectionDetail (not required by current quiz flow; section data comes from course overview)

### API Layer

#### Implemented
- [x] progressAPI.getStudentDashboardOverview
- [x] progressAPI.getStudentDashboardCourses
- [x] progressAPI.getEnrolledCourseOverview
- [x] progressAPI.getEnrolledLectureDetail
- [x] progressAPI.makeLectureCompleted
- [x] progressAPI.getQuiz — GET `progress/student/learn/quiz/{id}/`
- [x] progressAPI.submitQuiz — POST `progress/student/learn/quiz/makeattempt/`

#### Not Implemented
- [ ] progressAPI.getSectionDetail (not required; section data served via course overview endpoint)

---

## Integration Tasks

### Backend Integration
- [x] LectureProgress → Lecture
- [x] QuizAttempt → Quiz
- [x] QuizAttemptAnswer → Question/Choice
- [x] Enrollment check on all endpoints

### Frontend Integration (IMPLEMENTED)
- [x] Dashboard protected route
- [x] My Courses route
- [x] Learning route layout with sidebar
- [x] Course learning overview API integration
- [x] Lecture detail API integration
- [x] Lecture completion persistence
- [x] Quiz flow integration
  - [x] Fetch real quiz questions from backend (replaces mock data)
  - [x] Answer tracking and submission with `question_id` + `choice_id`
  - [x] Result caching via `setQueryData` and navigation to result route
  - [x] Cache invalidation of `['dashboard']` so course progress and sidebar refresh after pass
  - [x] Review mode for passed quizzes (correct/selected highlighting)
  - [x] Redirect-to-quiz fallback on result page if cache is missing
- [x] Lecture progress persistence
- [x] Course cards/button navigation to learning route
  - [x] DashboardCourseCard wrapped in `<Link>` to `/dashboard/learn/{id}`
  - [x] "Resume Learning" / "Review Course" banner button linked to `/dashboard/learn/{id}`
  - [x] "View All" button linked to `/dashboard/my-courses`

---

## Billing Tasks

Billing is a subfeature of Student Progress surfacing the student's own `Order` history
(owned by the `enrollment` app). Code lives in `apps/enrollment/` (backend) and
`featuers/enrollment/` (frontend) since that's where the payment domain already lives.

### B0 — Schema Foundation
- [x] Add `created_at` to `Order` model
- [x] Add `created_at` to `Transaction` model
- [x] New migration `0011_order_created_at_transaction_created_at_and_more` (never edited existing migrations)

### B1 — Payment Summary (Backend)
- [x] `BillingSummarySerializer` (total_spent, courses_purchased, last_payment_date)
- [x] `StudentBillingSummaryView` — `GET /enrollment/student/billing/summary/`
  - [x] Authentication (`CookieJWTAuthentication` + `IsAuthenticated`)
  - [x] Sum of `paid` orders → `total_spent`
  - [x] Count of `paid` orders → `courses_purchased`
  - [x] Latest `created_at` among `paid` orders → `last_payment_date` (null if none)

### B2 — Transaction History (Backend)
- [x] `BillingPageNumberPagination` (page_size=6)
- [x] `StudentOrderHistorySerializer` (id as `ORD-{id}`, course_name, amount, currency, status, method, date)
- [x] `StudentOrderHistoryView` — `GET /enrollment/student/orders/?page=N`
  - [x] Scoped to `user=request.user`
  - [x] Filtered to `status in (paid, refunded)`, newest first
  - [x] `select_related('course')` to avoid N+1

### B1/B2 — Frontend
- [x] `BillingSummary`/`OrderHistoryItem`/`OrdersPage` types added to the existing `enrollment.types.ts` (no separate billing types file — matches the single-types-file-per-feature convention already used by `progress.types.ts`)
- [x] `enrollmentAPI.getBillingSummary()` / `enrollmentAPI.getBillingOrders(page)` added to the existing `enrollment.api.ts` (no separate billing API file, same reasoning)
- [x] `useBillingSummary` hook (useQuery, staleTime 5 min)
- [x] `useStudentOrders(page)` hook (useQuery, staleTime 5 min, keepPreviousData)
- [x] `BillingSummary` component — 3 stat cards (Total Spent, Courses Purchased, Last Payment Date)
- [x] `TransactionHistory` component — table + numbered pagination
  - [x] Loading, error, empty ("No purchases yet" + Browse Courses CTA) states
  - [x] Disabled download button ("Receipts coming soon" — no receipt id stored)

### B3 — Extras & Wiring
- [x] Tax Invoice / Contact Support static cards hardcoded directly in `billing/page.tsx` (not extracted to a separate component — too small/static to warrant one)
- [x] `BillingSummary` and `TransactionHistory` exported from `featuers/enrollment/index.ts`
- [x] `app/dashboard/(main)/settings/billing/page.tsx` rewritten to compose real components (mock data removed)

### Not Implemented (deferred, see Known Limitations)
- [ ] Card brand/last4 in the method column (needs webhook change to capture `payment_method_details`)
- [ ] Real receipt download (needs `stripe_receipt_id` exposed to the student endpoint)

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
- [x] ~~Quiz and quiz result pages use mock data~~ — fully integrated with backend APIs
- [x] ~~Dashboard course-card CTA is not wired as a link to `/dashboard/learn/{id}`~~ — all cards and buttons now link correctly
- [x] ~~Billing page uses mock data~~ — fully integrated with `enrollment/student/billing/summary/` and `enrollment/student/orders/`
- [ ] No video auto-complete on playback end
- [ ] Quiz result page loses data on browser refresh (React Query cache is in-memory only); workaround: redirects back to quiz page gracefully
- [ ] Billing method column shows generic "Card" label — no card brand/last4 captured by the Stripe webhook
- [ ] Billing receipt download is disabled — `stripe_receipt_id` not exposed to the student endpoint

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
- [x] Frontend quiz integration documented (QuizContent, QuizResult, hooks, API layer, cache strategy)
