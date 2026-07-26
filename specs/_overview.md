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

| Component      | Technology                                               |
| -------------- | -------------------------------------------------------- |
| Framework      | Django 6.0 + Django REST Framework                       |
| Database       | PostgreSQL                                               |
| Authentication | JWT via HttpOnly cookies (djangorestframework-simplejwt) |
| OAuth          | Google OAuth via django-allauth                          |
| Media Storage  | Cloudinary                                               |
| Video Hosting  | Cloudinary (adaptive HLS via `sp_auto` streaming profile)|
| Payments       | Stripe (PaymentIntent API), swappable via PaymentGateway |
| Email          | SendGrid via django-anymail                              |

### Frontend (Next.js)

| Component        | Technology                                |
| ---------------- | ----------------------------------------- |
| Framework        | Next.js 16 (App Router)                   |
| UI Library       | React 19                                  |
| Language         | TypeScript (strict mode)                  |
| Styling          | Tailwind CSS v4                           |
| State Management | TanStack Query (server), Zustand (client) |
| UI Components    | shadcn/ui (Radix primitives)              |
| Forms            | React Hook Form + Zod validation          |
| HTTP Client      | Axios with interceptors                   |
| Video Player     | Vidstack + hls.js (adaptive HLS)          |

---

## Core Entities & Relationships

```
CustomUser (email as USERNAME_FIELD)
├── StudentProfile ──> Enrollment ──> Course
├── InstructorProfile ──> Course [creates]
└── AdminProfile

Course
├── Section (ordered)
│   ├── Lecture (ordered, video_public_id, video_status, duration)
│   └── Quiz (1 per section, questions_count)
│       ├── Question (ordered)
│       │   └── Choice (is_correct flag)
│       └── QuizAttempt (score, passed boolean)
├── Review (one per student per course, requires 100% completion)
├── Order (pending/paid/failed/refunded, payment_gateway, idempotency_key)
│   └── Transaction (gateway_reference, gateway_charge_id, receipt_url)
├── ProcessedWebhookEvent (event_id deduplication)
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

- **Email/Password Registration** with OTP verification (6-digit code, real email via SendGrid)
- **Login** with JWT stored in HttpOnly cookies
- **Google OAuth** login and registration
- **Password Management**:
  - Forget password via OTP
  - Change password (authenticated)
  - Set password for Google users (OTP flow)
  - Backend password strength validation (Django validators) on all password endpoints
- **Token Refresh** automatic via axios interceptors
- **Logout** with token blacklisting
- **Rate Limiting**: login (5/min), OTP send/verify (3/min), registration (3/min)
- **Security**: All `print()` replaced with structured logging, consistent `CookieJWTAuthentication`

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

### Enrollment & Payments (Complete)

- **Payment Flow**:
  - Create Stripe PaymentIntent (embedded `PaymentElement` — supports card, Apple Pay, Google Pay)
  - Webhook handling for payment success/failure with event deduplication (`ProcessedWebhookEvent`)
  - Automatic enrollment on successful payment
  - Payment confirmation emails with Stripe-hosted receipt links
  - **Free course enrollment** (price == 0 bypasses payment flow entirely)
  - **Payment retry** for failed/pending orders (checks PI status, creates new PI if canceled)
- **Refunds**: Admin-only endpoint with 14-day window, enrollment deactivation, refund confirmation email
- **Order/Transaction Tracking**: Full billing dashboard with receipt URLs and actual payment methods
- **Payment Gateway Abstraction** (`apps/enrollment/payments/`):
  - Strategy/DIP pattern: `PaymentGateway` ABC → `StripeGateway` adapter → `get_payment_gateway()` factory
  - `CheckoutService`, `RefundService`, fulfillment layer, `WebhookDispatcher`
  - Adding a second gateway (e.g., PayPal) = one new adapter class + one factory elif
  - No `stripe` import outside `stripe_gateway.py`
- **Stripe Integration**: Test mode ready

### Student Progress Tracking (Complete — Backend + Frontend)

- **Dashboard** (full frontend implementation):
  - Overview: completed courses, in-progress courses, total minutes spent
  - Course list with progress percentages
  - Detailed course view with section progress and lecture/quiz status
- **Video Streaming**: Cloudinary adaptive HLS with Vidstack player, access-gated per enrollment
- **Lecture Completion**: Mark lectures complete (unlocked sequentially, serializer-validated)
- **Quiz System**:
  - Submit answers and get scored (serializer-validated)
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

### 1. Certificate Generation

**Status**: Not implemented
**Hint**: Course detail page mentions "Certificate of completion"
**Missing**: Certificate generation and download functionality

### 2. Instructor Dashboard

**Status**: Not implemented
**Current**: Instructor APIs exist (course/section/lecture/quiz CRUD)
**Missing**:

- Instructor dashboard page
- Course creation/editing UI
- Student analytics view

### 3. Cart/Wishlist

**Status**: Not implemented
**Missing**: Cart state management, wishlist functionality

### 4. Real-time Features

**Status**: Not implemented
**Potential Needs**:

- Real-time notifications
- Live chat with instructors
- WebSocket for progress sync

### 5. Search Indexing

**Status**: Basic filtering works
**Potential Enhancement**: Elasticsearch/Algolia for better search performance

### 6. Instructor Upload UI

**Status**: Backend ready (upload signature endpoint exists), no frontend UI
**Missing**: Instructor lecture-authoring page with direct-to-Cloudinary chunked upload

---

## API Structure

### Authentication (`/auth/`)

| Endpoint                               | Method | Description              |
| -------------------------------------- | ------ | ------------------------ |
| `/user/register/sendOTP/`              | POST   | Start registration       |
| `/user/register/verifyOTP/`            | POST   | Complete registration    |
| `/user/login/`                         | POST   | Authenticate             |
| `/user/logout/`                        | POST   | Logout + blacklist token |
| `/user/profile/`                       | GET    | Get user data            |
| `/user/forgetpassword/sendOTP/`        | POST   | Start password reset     |
| `/user/forgetpassword/verifyOTP/`      | POST   | Verify reset OTP         |
| `/user/forgetpassword/SetNewPassword/` | POST   | Set new password         |
| `/google/user/login/`                  | POST   | Google login             |
| `/google/user/register/`               | POST   | Google registration      |
| `/token/refresh/`                      | POST   | Refresh access token     |

### Courses (`/courses/`)

| Endpoint               | Access | Description               |
| ---------------------- | ------ | ------------------------- |
| `/student/courses/`    | Read   | List/retrieve courses     |
| `/student/homepage/`   | Read   | Homepage featured courses |
| `/instructor/courses/` | CRUD   | Instructor's own courses  |
| `/admin/courses/`      | CRUD   | All courses (admin)       |

| Corresponding `/sections/`, `/lectures/`, `/quizzes/` endpoints exist for each role

| Endpoint                         | Access | Description                       |
| -------------------------------- | ------ | --------------------------------- |
| `/video/upload-signature/`       | POST   | Cloudinary upload credentials     |
| `/video/webhook/`                | POST   | Cloudinary video processing webhook|

### Enrollment (`/enrollment/`)

| Endpoint                         | Description                          |
| -------------------------------- | ------------------------------------ |
| `/create-payment-intent/`        | Create Stripe PaymentIntent          |
| `/order-details/`                | Get order details (supports retry)   |
| `/enroll-free/`                  | Free course enrollment               |
| `/webhook/<gateway>/`            | Payment webhook (gateway-routed)     |
| `/payment-webhook/`              | Stripe webhook (legacy alias)        |
| `/refund-order/`                 | Admin-only refund (14-day window)    |
| `/billing/summary/`              | Student billing summary              |
| `/billing/orders/`               | Student order history with receipts  |

### Reviews (`/reviews/`)

| Endpoint                         | Description                          |
| -------------------------------- | ------------------------------------ |
| `/course/<id>/reviews/`          | Public course reviews (paginated)    |
| `/my-review/<course_id>/`        | Student's own review (GET/POST/PATCH/DELETE) |
| `/eligibility/<course_id>/`      | Check review eligibility             |
| `/admin/remove/<review_id>/`     | Admin review removal                 |

### Progress (`/progress/`)

| Endpoint                               | Description                 |
| -------------------------------------- | --------------------------- |
| `/student/overview/`                   | Dashboard stats             |
| `/student/courses/`                    | Enrolled courses list       |
| `/student/learn/course/<id>/`          | Course detail with progress |
| `/student/learn/section/<id>/`         | Section with lectures/quiz  |
| `/student/learn/lecture/markcomplete/` | Mark lecture complete       |
| `/student/learn/quiz/makeattempt/`     | Submit quiz answers         |
| `/student/learn/quiz/<id>/`            | Get quiz questions          |

---

## File Organization

```
backend/
├── apps/
│   ├── authentication/    # User models, JWT auth, OAuth, OTP
│   ├── course/           # Course, Section, Lecture, Quiz models
│   │   └── video/        # Video provider abstraction (Cloudinary adapter)
│   ├── enrollment/       # Orders, Transactions, payments
│   │   └── payments/     # Payment gateway abstraction (Stripe adapter)
│   ├── progress/         # Progress tracking, quiz attempts
│   └── reviews/          # Course reviews & ratings
├── config/               # Settings, URLs, WSGI/ASGI

front-end/
├── src/
│   ├── app/
│   │   ├── (main)/       # Public routes (Home, Courses, Course Detail)
│   │   ├── (auth)/       # Auth routes (Login, Register, OTP, Forget Password)
│   │   └── dashboard/    # Student dashboard (overview, courses, lectures, quizzes, billing)
│   ├── components/
│   │   ├── atoms/        # Basic UI (button, input, avatar, video player)
│   │   ├── molecules/    # Composite (CourseCard, Filters)
│   │   └── organisms/    # Complex sections (Hero, NavBar, Footer)
│   ├── featuers/
│   │   ├── auth/         # Auth feature (API, hooks, components, types)
│   │   ├── courses/      # Courses feature
│   │   ├── enrollment/   # Enrollment, checkout, billing
│   │   ├── progress/     # Student progress, quiz, lecture tracking
│   │   └── reviews/      # Course reviews & ratings
│   ├── lib/              # Utilities (axios, toast, queryProvider)
│   └── store/            # Zustand stores
```

---

## Security Considerations

- **JWT in HttpOnly cookies** (not localStorage) for XSS protection
- **CORS** via `CORS_ALLOWED_ORIGINS` env var (not `CORS_ALLOW_ALL_ORIGINS`)
- **Rate limiting**: login (5/min), OTP (3/min), registration (3/min)
- **Password validation**: Django validators enforced on all password endpoints
- **Webhook verification**: Stripe signature, Cloudinary SHA1 signature
- **Role-based access control** on all viewsets
- **Refresh token rotation** enabled (`ROTATE_REFRESH_TOKENS: True`)
- **Structured logging** (no `print()` statements, no sensitive data in logs)
- **Cloudinary** for secure media storage
- **Video access gating**: streaming URLs only served to enrolled students/course owner/admins

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
- `ALLOWED_HOSTS` (comma-separated)
- `CORS_ALLOWED_ORIGINS` (comma-separated)
- `STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SENDGRID_API_KEY`, `DEFAULT_FROM_EMAIL`, `SERVER_EMAIL`
- `CLOUDINARY_*` credentials
- `CLOUDINARY_VIDEO_WEBHOOK_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET`
- `JWT_COOKIE_SETTINGS`
- `PAYMENT_GATEWAY` (default: `stripe`)
- `VIDEO_PROVIDER` (default: `cloudinary`)

**Frontend (.env.local)**:

- `NEXT_PUBLIC_DEVELOPMENT_BACKEND_URL=http://localhost:8000`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

### Reviews System (Complete)

- **Review model** with one-per-student-per-course constraint
- **Eligibility checks** (enrolled + 100% course completion)
- **Submit/edit/delete** own reviews (student dashboard)
- **Public course reviews** carousel on course detail page (paginated, newest first)
- **Course aggregate** rating/count (denormalized, recomputed on every write)
- **Instructor aggregate** rating/count (computed on read, published courses only)
- **Admin review removal** endpoint
- **"Not yet rated"** state for courses/instructors with no reviews

## Next Logical Steps

If continuing development, priority order would likely be:

1. **Instructor Dashboard** - Content creation/editing UI, student analytics
2. **Instructor Upload UI** - Frontend for direct-to-Cloudinary video uploads (backend ready)
3. **Certificate Generation** - Completion rewards
4. **Cart/Wishlist** - Shopping cart and wishlist functionality
5. **Real-time Features** - Notifications, progress sync
6. **Production Deployment** - Domain, SSL, proper CORS origins, monitoring
