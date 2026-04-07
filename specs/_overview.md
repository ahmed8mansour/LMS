# LMS Project Overview

## What This System Does

This is a **Learning Management System (LMS)** that connects students, instructors, and administrators in an online education platform. The system enables:

- **Students**: Browse courses, enroll via payment, track learning progress, watch lectures, take quizzes, and earn certificates
- **Instructors**: Create and manage courses with sections, lectures, and quizzes; track student engagement
- **Admins**: Full CRUD management of all courses, sections, lectures, and quizzes

The platform follows a sequential learning model where students must complete lectures in order and pass quizzes (50% threshold) to unlock subsequent sections.

---

## Tech Stack

### Backend (Django)
| Component | Technology |
|-----------|------------|
| Framework | Django 6.0 + Django REST Framework |
| Database | PostgreSQL |
| Authentication | JWT via HttpOnly cookies (djangorestframework-simplejwt) |
| OAuth | Google OAuth via django-allauth |
| Media Storage | Cloudinary |
| Payments | Stripe (PaymentIntent API) |

### Frontend (Next.js)
| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| State Management | TanStack Query (server), Zustand (client) |
| UI Components | shadcn/ui (Radix primitives) |
| Forms | React Hook Form + Zod validation |
| HTTP Client | Axios with interceptors |

---

## Core Entities & Relationships

```
CustomUser (email as USERNAME_FIELD)
├── StudentProfile ──> Enrollment ──> Course
├── InstructorProfile ──> Course [creates]
└── AdminProfile

Course
├── Section (ordered)
│   ├── Lecture (ordered, has video_url, duration)
│   └── Quiz (1 per section, questions_count)
│       ├── Question (ordered)
│       │   └── Choice (is_correct flag)
│       └── QuizAttempt (score, passed boolean)
├── Order (pending/paid/failed/refunded)
│   └── Transaction (Stripe payment records)
└── LectureProgress (completed_at timestamp)
```

**Key Constraints**:
- Sections have unique ordering per course
- Lectures have unique ordering per section
- Students can only take quizzes after completing all lectures in that section
- Quiz pass threshold: 50% (configurable in settings)

---

## Main Features Already Built

### Authentication System (Complete)
- **Email/Password Registration** with OTP verification (6-digit code)
- **Login** with JWT stored in HttpOnly cookies
- **Google OAuth** login and registration
- **Password Management**:
  - Forget password via OTP
  - Change password (authenticated)
  - Set password for Google users (OTP flow)
- **Token Refresh** automatic via axios interceptors
- **Logout** with token blacklisting

### Course Management (Complete)
- **Course CRUD**:
  - Admin: Full management of all courses
  - Instructor: Manage only their own courses
  - Student: Read-only with enrollment status
- **Course Structure**:
  - Sections with ordering
  - Lectures with video URLs and duration
  - One quiz per section with questions and multiple-choice answers
- **Course Metadata**: Title, description, thumbnail, price, category, level, language, rating, subscriber count

### Course Discovery (Complete)
- **Homepage**: Featured/popular courses with category filtering
- **Course Listing Page**:
  - Filters: category, level, price range, rating
  - Search by keyword
  - Sorting (popular, newest, price)
  - Cursor-based pagination
- **Course Detail Page**: Full course info, sections preview, instructor profile, enrollment CTA

### Enrollment & Payments (Backend Complete)
- **Payment Flow**:
  - Create Stripe PaymentIntent
  - Webhook handling for payment success/failure
  - Automatic enrollment on successful payment
- **Order/Transaction Tracking**: Full payment history
- **Stripe Integration**: Test mode ready

### Student Progress Tracking (Backend Complete)
- **Dashboard APIs**:
  - Overview: completed courses, in-progress courses, total minutes spent
  - Course list with progress percentages
  - Detailed course view with section progress
- **Lecture Completion**: Mark lectures complete (unlocked sequentially)
- **Quiz System**:
  - Submit answers and get scored
  - Pass/fail based on threshold
  - View correct answers after passing
  - Prevent retakes after passing

### Frontend UI Components (Complete)
- Atomic design component structure
- Course cards with skeleton loading
- Filters and search UI
- Hero and services sections
- Responsive layouts

---

## What Seems Incomplete / Missing

### 1. Student Dashboard (Frontend)
**Status**: Backend APIs exist, no frontend pages
**References**:
- Code links to `/dashboard/${course.id}` (CourseDetailPage.tsx:98)
- User avatar dropdown links to `/dashboard` and `/dashboard/profile`
- Middleware proxy.ts references `/dashboard` as protected route

**Missing Pages**:
- Dashboard home with stats overview
- Enrolled course detail with video player
- Section/quiz view
- Progress tracking UI

### 2. Payment Integration (Frontend)
**Status**: Backend complete, frontend has placeholder
**Issue**: CourseEnrollCard.tsx shows "Enroll Now" button but no Stripe integration
**Missing**:
- Payment modal/component
- Stripe Elements integration
- Payment confirmation flow
- "Add to Cart" functionality (UI shows button, no implementation)

### 3. Video Player
**Status**: Not implemented
**Needed For**: Lecture viewing in dashboard
**Model Has**: `video_url` field on lectures
**Missing**: Video player component (likely needs React Player or similar)

### 4. Certificate Generation
**Status**: Not implemented
**Hint**: Course detail page mentions "Certificate of completion"
**Missing**: Certificate generation and download functionality

### 5. Reviews System
**Status**: Partial
**Current**: Courses have `reviews_count` and `rating` fields
**Missing**:
- Review submission API
- Review display on course detail
- Average rating calculation

### 6. Instructor Dashboard
**Status**: Not implemented
**Current**: Instructor APIs exist (course/section/lecture/quiz CRUD)
**Missing**:
- Instructor dashboard page
- Course creation/editing UI
- Student analytics view

### 7. Cart/Wishlist
**Status**: Not implemented
**UI Shows**: "Add to Cart" button (CourseEnrollCard.tsx:27)
**Missing**: Cart state management, checkout flow

### 8. Real-time Features
**Status**: Not implemented
**Potential Needs**:
- Real-time notifications
- Live chat with instructors
- WebSocket for progress sync

### 9. Search Indexing
**Status**: Basic filtering works
**Potential Enhancement**: Elasticsearch/Algolia for better search performance

### 10. Email System
**Status**: Console backend (development only)
**Current**: Emails print to console
**Needed**: SMTP integration for production (SendGrid/AWS SES)

---

## API Structure

### Authentication (`/auth/`)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/user/register/sendOTP/` | POST | Start registration |
| `/user/register/verifyOTP/` | POST | Complete registration |
| `/user/login/` | POST | Authenticate |
| `/user/logout/` | POST | Logout + blacklist token |
| `/user/profile/` | GET | Get user data |
| `/user/forgetpassword/sendOTP/` | POST | Start password reset |
| `/user/forgetpassword/verifyOTP/` | POST | Verify reset OTP |
| `/user/forgetpassword/SetNewPassword/` | POST | Set new password |
| `/google/user/login/` | POST | Google login |
| `/google/user/register/` | POST | Google registration |
| `/token/refresh/` | POST | Refresh access token |

### Courses (`/courses/`)
| Endpoint | Access | Description |
|----------|--------|-------------|
| `/student/courses/` | Read | List/retrieve courses |
| `/student/homepage/` | Read | Homepage featured courses |
| `/instructor/courses/` | CRUD | Instructor's own courses |
| `/admin/courses/` | CRUD | All courses (admin) |
| Corresponding `/sections/`, `/lectures/`, `/quizzes/` endpoints exist for each role

### Enrollment (`/enrollment/`)
| Endpoint | Description |
|----------|-------------|
| `/create-payment-intent/` | Create Stripe PaymentIntent |
| `/payment-webhook/` | Stripe webhook handler |

### Progress (`/progress/`)
| Endpoint | Description |
|----------|-------------|
| `/student/overview/` | Dashboard stats |
| `/student/courses/` | Enrolled courses list |
| `/student/learn/course/<id>/` | Course detail with progress |
| `/student/learn/section/<id>/` | Section with lectures/quiz |
| `/student/learn/lecture/markcomplete/` | Mark lecture complete |
| `/student/learn/quiz/makeattempt/` | Submit quiz answers |
| `/student/learn/quiz/<id>/` | Get quiz questions |

---

## File Organization

```
backend/
├── apps/
│   ├── authentication/    # User models, JWT auth, OAuth
│   ├── course/           # Course, Section, Lecture, Quiz models
│   ├── enrollment/       # Orders, Transactions, Stripe integration
│   └── progress/         # Progress tracking, quiz attempts
├── config/               # Settings, URLs, WSGI/ASGI

front-end/
├── src/
│   ├── app/
│   │   ├── (main)/       # Public routes (Home, Courses, Course Detail)
│   │   └── (auth)/       # Auth routes (Login, Register, OTP, Forget Password)
│   ├── components/
│   │   ├── atoms/        # Basic UI (button, input, avatar)
│   │   ├── molecules/    # Composite (CourseCard, Filters)
│   │   └── organisms/    # Complex sections (Hero, NavBar, Footer)
│   ├── featuers/
│   │   ├── auth/         # Auth feature (API, hooks, components, types)
│   │   └── courses/      # Courses feature
│   ├── lib/              # Utilities (axios, toast, queryProvider)
│   └── store/            # Zustand stores, fake data
```

---

## Security Considerations

- **JWT in HttpOnly cookies** (not localStorage) for XSS protection
- **CORS** configured for localhost:3000
- **CSRF protection** on webhook endpoints
- **Role-based access control** on all viewsets
- **Stripe webhook signature** verification
- **Cloudinary** for secure media storage

---

## Development Notes

### Running Locally
1. Backend: `cd backend && env\Scripts\activate && python manage.py runserver`
2. Frontend: `cd front-end && npm run dev`
3. Stripe webhook testing requires Stripe CLI for local forwarding

### Environment Variables Needed
**Backend (.env)**:
- Database credentials (PostgreSQL)
- `SECRET_KEY`, `DEBUG`
- `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `CLOUDINARY_*` credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`
- `JWT_COOKIE_SETTINGS`

**Frontend (.env.local)**:
- `NEXT_PUBLIC_DEVELOPMENT_BACKEND_URL=http://localhost:8000`

---

## Next Logical Steps

If continuing development, priority order would likely be:

1. **Student Dashboard** - Core learning experience (video player, progress, quizzes)
2. **Stripe Frontend Integration** - Actually enable enrollments
3. **Video Player** - Essential for consuming content
4. **Instructor Dashboard** - Enable content creation
5. **Reviews System** - Social proof for courses
6. **Certificate Generation** - Completion rewards
7. **Production Deployment** - Email, proper CORS, security headers
