# Instructor Experience — Discovery & Architecture Planning Document

**Document type**: Architectural discovery / product planning (pre-implementation)
**Author role**: Principal Software Architect · Senior Product Manager · UX Architect
**Created**: 2026-07-29
**Status**: Draft for review
**Scope**: Design the complete Instructor Experience for the existing LMS. **No implementation.**
**Companion docs**: `specs/_overview.md`, `specs/_conventions.md`, `specs/features/course-management/spec.md`

> **Purpose.** This document is the foundation for future Spec-Kit specifications. It analyzes the
> existing production system, breaks down the completed Student Experience as a baseline, and designs
> every capability, page, workflow, permission, and architectural change required to give instructors
> a first-class experience — while reusing the current architecture wherever possible. It contains
> **no code**: only analysis, decisions, tables, trees, and prose.

> **Two decisions were confirmed with the product owner before writing** and are treated as fixed
> constraints throughout:
> 1. **Route strategy** — the instructor UI lives in a **separate top-level `app/(instructor)/` route
>    group** with its own layout + sidebar, mirroring (not sharing) the student dashboard shell.
> 2. **Access model** — keep the existing `isInstructor = is_staff` gate; the register form's
>    Instructor role provisions an `InstructorProfile` + `is_staff=True` via the existing
>    `create_instructor` manager (self-serve signup). The `is_staff`-vs-`role` semantic gap is noted
>    as a risk in §15.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Analysis](#2-current-system-analysis)
3. [Student Experience Breakdown](#3-student-experience-breakdown)
4. [Instructor Experience Vision](#4-instructor-experience-vision)
5. [User Stories](#5-user-stories)
6. [Capabilities](#6-capabilities)
7. [Feature Inventory](#7-feature-inventory)
8. [Information Architecture](#8-information-architecture)
9. [Page Inventory](#9-page-inventory)
10. [Workflows](#10-workflows)
11. [Permission Matrix](#11-permission-matrix)
12. [Reusability Analysis](#12-reusability-analysis)
13. [Backend Impact](#13-backend-impact)
14. [Frontend Impact](#14-frontend-impact)
15. [Risks](#15-risks)
16. [Recommended Development Roadmap](#16-recommended-development-roadmap)
17. [Suggested Spec Breakdown](#17-suggested-spec-breakdown)

---

## 1. Executive Summary

### What this project currently supports

The repository is a **Learning Management System** with a Django 6.0 + DRF backend and a Next.js 16 +
React 19 + TypeScript + Tailwind v4 frontend. It is built around three roles — **student, instructor,
admin** — but only the **student journey is delivered end-to-end** (backend *and* frontend). Students
can register (email/OTP or Google), browse and search a course catalog, pay via Stripe (or enroll
free), watch access-gated adaptive-HLS video, progress sequentially through sections/lectures/quizzes,
and review courses they complete.

### What already exists for instructors

Instructors are **half-built**: the *backend* is materially ready, the *frontend* does not exist.

- **Data & ownership**: `Course.instructor → InstructorProfile → CustomUser` is fully modeled, and an
  `InstructorProfile` (with `title`, `about`, `students_count`) is auto-created for instructor-role users.
- **CRUD APIs**: a complete, ownership-scoped instructor API family already ships —
  `InstructorCourseViewSet` / `InstructorSectionViewSet` / `InstructorLectureViewSet` /
  `InstructorQuizViewSet` at `/courses/instructor/{courses,sections,lectures,quizzes}/`
  (`backend/apps/course/views.py`), each filtering its queryset to the caller's own content and
  auto-binding ownership on create.
- **Video upload**: the direct-to-Cloudinary path is backend-ready — `POST /courses/video/upload-signature/`
  issues signed upload credentials, `Lecture.video_public_id` / `video_status` track transcoding, and a
  signed Cloudinary webhook flips status to `COMPLETED` (`backend/apps/course/video/`).
- **Read-only reputation**: `get_instructor_rating()` (`backend/apps/reviews/utils.py`) already
  aggregates an instructor's average rating and review count across their published courses.

### What is missing

- **The entire instructor frontend.** There is no instructor route, page, layout, sidebar, feature
  module, hook, or API client anywhere in `front-end/`. The register form offers a Student/Instructor
  toggle and `UserProfile.role` exists, but **nothing in the frontend branches on role** — the route
  guard (`src/proxy.ts`) checks only authenticated-vs-not.
- **Instructor-facing *read* APIs.** No dashboard summary, per-course analytics, enrolled-student
  roster, earnings/revenue view, or review-response endpoint. The write side (CRUD) exists; the
  insight side does not.
- **Supporting infrastructure.** No notification system and no background-job runner (Celery/Redis)
  exist anywhere in the codebase; both are prerequisites for a polished instructor experience
  (new-enrollment / new-review alerts, async email, heavy analytics).
- **Content lifecycle niceties.** No draft/soft-delete/versioning; `is_published` is a single boolean;
  deletes cascade irreversibly.

### Overall assessment

This is a **high-leverage, low-risk build**. The hardest and riskiest pieces — auth, ownership, media
pipeline, payments, the service layer — already exist and are production-grade. The instructor work is
predominantly (a) a **new frontend** that mirrors the proven student dashboard shell and feature-module
conventions, and (b) a **thin set of new read APIs** that assemble data the models already hold. The
project's own `specs/_overview.md` ranks "Instructor Dashboard" and "Instructor Upload UI" as the #1
and #2 next steps — this document designs exactly that, plus the analytics/engagement layer that makes
the experience compelling. Recommended approach: **reuse aggressively, add a small backend surface,
and phase delivery** (MVP authoring first, insights second, engagement/earnings third).

---

## 2. Current System Analysis

### 2.1 Current architecture

A decoupled two-tier application:

```
┌─────────────────────────────┐         HTTPS (cookies, withCredentials)        ┌──────────────────────────────┐
│  Next.js 16 (App Router)     │  ───────────────────────────────────────────▶  │  Django 6.0 + DRF            │
│  React 19 · TS · Tailwind v4 │                                                 │  PostgreSQL                  │
│  TanStack Query · Zustand    │  ◀───────────────────────────────────────────  │  SimpleJWT (HttpOnly cookies)│
│  Axios (interceptors)        │              JSON (raw payloads)                │  Cloudinary · Stripe · SendGrid │
└─────────────────────────────┘                                                 └──────────────────────────────┘
```

- **Auth transport**: JWT in **HttpOnly cookies** (`access_token` 15 min, `refresh_token` 7 days,
  rotation + blacklist). Axios sends `withCredentials: true` and auto-refreshes on 401 via a
  single-flight interceptor (`front-end/src/lib/axios.ts`).
- **API response contract** (authoritative, from `CLAUDE.md`): success responses return the **payload
  directly** — a plain object, a list, or standard DRF page-number pagination
  (`count`/`next`/`previous`/`results`). **No `{data,status}` envelope.** Errors are `{"error": "..."}`
  or DRF field errors `{"field": ["..."]}`. *(Note: `AGENTS.md`/`gemini.md` still describe an older
  envelope standard — that is stale; this document follows `CLAUDE.md`.)*
- **No API versioning**, **no Celery/Redis**, **no global DRF pagination/permission defaults** beyond
  `CookieJWTAuthentication` as the default authentication class + throttling.

### 2.2 Project organization

**Backend** (`backend/`, project package `config/`) — five apps under `backend/apps/`:

| App | Responsibility | Key models |
|-----|----------------|-----------|
| `authentication` | Users, profiles, JWT, OAuth, OTP | `CustomUser`, `StudentProfile`, `InstructorProfile`, `AdminProfile`, `EmailOTP`, `PasswordResetToken` |
| `course` | Course content tree + video | `Course`, `Section`, `Lecture`, `Quiz`, `Question`, `Choice` |
| `enrollment` | Orders, payments, enrollment | `Order`, `Transaction`, `Enrollment`, `ProcessedWebhookEvent` |
| `progress` | Learning progress + quiz attempts | `LectureProgress`, `QuizAttempt`, `QuizAttemptAnswer` |
| `reviews` | Course reviews & ratings | `Review` |

**Frontend** (`front-end/src/`):

```
app/            route tree (App Router; route groups (main), (auth), dashboard)
featuers/       (sic) feature modules: auth, courses, enrollment, progress, reviews
components/     atoms / molecules / organisms (+ empty templates, ui)
lib/            axios, queryProvider, cookies, toast, utils
hooks/          useDebounce, useFilters
store/          Zustand: auth.store, checkout.store, ui.store
proxy.ts        Next 16 middleware (auth route guard)
```

### 2.3 Routing (frontend)

Route groups: `(main)` public/marketing, `(auth)` login/register/OTP/password flows, `dashboard`
(student, wrapped in a sidebar shell), and `dashboard/learn` (full-screen course player). All dynamic
routes use `[id]` / `[slug]`. There is **no `middleware.ts`** — Next 16 renames it to `src/proxy.ts`.

### 2.4 Authentication

- Backend: `CookieJWTAuthentication` (`backend/apps/authentication/utils.py`) reads a Bearer header,
  then the `access_token` cookie. Google OAuth via allauth code exchange. OTP via `EmailOTP`.
- Frontend: **no React auth context** — the current user is a TanStack Query (`useProfile`,
  `queryKey: ['user','profile']`, `staleTime: Infinity`). A minimal `auth.store.ts` holds only OTP-flow
  state. Route protection is `src/proxy.ts` (authenticated-vs-not; `PROTECTED_ROUTES = ["/dashboard"]`).

### 2.5 Authorization

- Roles exist in **two overlapping places**: `CustomUser.role` (`student`/`instructor`/`admin`) **and**
  Django `is_staff`/`is_superuser`.
- Custom DRF permissions (`backend/apps/course/permissions.py`): `isAdmin` = `is_superuser`,
  `isInstructor` = **`is_staff`**. (The `create_instructor` manager sets `is_staff=True`.)
- **No object-level `has_object_permission`.** Ownership is enforced by **queryset filtering**
  (`get_queryset` restricted to `request.user.instructor_profile`) plus manual `if owner != ...` checks
  in `perform_create` / `perform_update`.

### 2.6 Reusable UI

Atomic-design library under `components/`: **atoms** (Radix + `class-variance-authority`: `button`,
`input`, `select`, `checkbox`, `accordion`, `avatar`, `dropdown-menu`, `alert-dialog`, `input-otp`,
`skeleton`, `StarRating`, `StarInput`, loaders), **molecules** (`CourseCard`, `DashboardCourseCard`,
`Filters`, `SearchAndSort`, `HlsVideoPlayer`, radio groups), **organisms** (`NavBar`, `Footer`,
`Hero`, `SideBar`). `templates/` and `ui/` are empty. Helper `cn` in `lib/utils.ts`. Custom Tailwind
tokens (`darktext`, `graytext2`, `darkmint`, `lightbg`, `darkbg`) are the house palette — raw hex /
Material tokens are explicitly discouraged in existing specs.

### 2.7 Reusable business logic (frontend)

Per-feature convention: `featuers/{feature}/{api,hooks,components,schemas,types,index.ts}` where API
modules are namespaced objects (`coursesAPI`, `authAPI`, `progressAPI`), hooks wrap
`useQuery`/`useMutation` (`use{Action}.tsx`), Zod schemas live in `{feature}.schma.ts` (sic), types in
`{feature}.types.ts`. Utility hooks `useDebounce`, `useFilters`. Zustand stores per concern.

### 2.8 Backend services (reusable)

A genuinely strong service layer already exists and should be **extended, not duplicated**:

| Service / module | Location | What it does |
|------------------|----------|--------------|
| Payment gateway abstraction | `backend/apps/enrollment/payments/` | `PaymentGateway` ABC → `StripeGateway` → `get_payment_gateway()` factory; `dto.py`, `exceptions.py` |
| `FulfillmentFacade` | `backend/apps/enrollment/payments/fulfillment.py` | Activates/deactivates enrollment, records `Transaction`, bumps `Course.subscribers_count` + `InstructorProfile.students_count`, triggers emails |
| `CheckoutService` / `RefundService` | `backend/apps/enrollment/payments/service.py` | Idempotent order creation; 14-day refund window |
| `WebhookDispatcher` | `backend/apps/enrollment/payments/webhooks.py` | event→handler strategy map, dedupe via `ProcessedWebhookEvent` |
| `EmailService` + `Sender` strategy | `backend/apps/enrollment/service.py` | OTP / payment / refund email senders (synchronous SendGrid via Anymail) |
| Video provider abstraction | `backend/apps/course/video/` | `get_video_provider()` factory → Cloudinary; `VideoUploadService`, `VideoWebhookService`, `can_access_lecture_video()` |
| Rating utilities | `backend/apps/reviews/utils.py` | `RatingComputing`, `StudentCoursesRating.has_completed_course`, `get_instructor_rating()` |

### 2.9 APIs (existing surface)

Root prefixes (`backend/config/urls.py`): `auth/`, `courses/`, `enrollment/`, `progress/`, `reviews/`,
`admin/`, `accounts/`. The `courses/` router exposes three parallel viewset families — **admin**
(`ModelViewSet`, all rows), **instructor** (`ModelViewSet`, own rows only), **student**
(`ReadOnlyModelViewSet`, published, with search/filter/cursor pagination + `enrolled_status`). The
**instructor family already exists**; what is missing is instructor **read/insight** endpoints (see §13).

### 2.10 Database entities (relationships)

```
CustomUser (email = USERNAME_FIELD; role ∈ {student,instructor,admin}; is_staff, is_superuser)
├── StudentProfile (1:1)      ── LectureProgress, QuizAttempt, Review, Enrollment, Order (via user)
├── InstructorProfile (1:1)   ── title, about, students_count   ──creates──▶ Course
└── AdminProfile (1:1)

Course (instructor FK → InstructorProfile; is_published; subscribers_count; reviews_count; rating)
├── Section (order, unique per course)
│   ├── Lecture (order unique per section; video_public_id; video_status; duration)
│   └── Quiz (1:1 section)
│       └── Question ── Choice (is_correct)
├── Review (1 per student per course; requires 100% completion)
├── Order (pending/paid/failed/refunded) ── Transaction (receipt_url, charge_id, method)
└── Enrollment (unique per user+course; is_active)
```

### 2.11 Reusable assets — quick index

| Asset | Path | Instructor reuse |
|-------|------|------------------|
| Instructor CRUD viewsets | `backend/apps/course/views.py` | **Direct** — the authoring backbone |
| Ownership pattern (`get_queryset`/`perform_create`) | `backend/apps/course/views.py` | **Direct** — copy for new read views |
| Video upload signature + provider | `backend/apps/course/video/` | **Direct** — powers Upload UI |
| `get_instructor_rating`, counters | `backend/apps/reviews/utils.py`, models | **Direct** — dashboard/analytics inputs |
| Email + payment services | `backend/apps/enrollment/` | **Extend** — new senders / earnings reads |
| Dashboard shell + Sidebar | `front-end/src/app/dashboard/(main)/layout.tsx`, `components/organisms/SideBar.tsx` | **Pattern reuse** — mirror for `(instructor)` |
| Atomic component library | `front-end/src/components/` | **Direct** |
| Feature-module convention | `front-end/src/featuers/*` | **Direct** — new `featuers/instructor*` |
| Axios + TanStack Query + Zustand | `front-end/src/lib`, `front-end/src/store` | **Direct** |
| Route guard | `front-end/src/proxy.ts` | **Extend** — add role awareness |

---

## 3. Student Experience Breakdown

The completed student journey is the **baseline** for instructor design — instructors author the exact
artifacts students consume, and the instructor dashboard mirrors the student dashboard shell.

### 3.1 Account & authentication
- **Purpose**: get an identity and a session.
- **Workflow**: register (email → OTP verify) or Google → login → JWT cookies set → profile fetched.
- **Pages**: `/login`, `/register`, `/verifyotp`, forget-/google-set-password flows.
- **APIs**: `/auth/user/register/sendOTP|verifyOTP/`, `/auth/user/login|logout|profile/`, `/auth/google/...`, `/auth/token/refresh/`.
- **Reusable logic**: `authAPI`, `useProfile`, `proxy.ts` gating, `auth.store.ts`. **Shared with instructors as-is** (same login; role decides landing).

### 3.2 Course discovery
- **Purpose**: find a course to buy.
- **Workflow**: homepage featured → catalog with filters/search/sort → course detail (curriculum preview, instructor bio, reviews, enroll CTA).
- **Pages**: `/`, `/courses`, `/courses/[id]`.
- **APIs**: `/courses/student/homepage/`, `/courses/student/courses/` (+ filters, cursor pagination), `/courses/student/courses/{id}/`.
- **Reusable logic**: `CourseCard`, `Filters`, `SearchAndSort`, `usePaginatedCourses`, `useCourse`, `useFilters`, `useDebounce`, `CourseCursorPagination`. **Instructors reuse `CourseCard` and the detail renderer for previews.**

### 3.3 Enrollment & payment
- **Purpose**: buy access (or enroll free).
- **Workflow**: enroll → order created → Stripe `PaymentElement` → webhook confirms → enrollment activated → confirmation email + receipt.
- **Pages**: `/courses/checkout/[orderID]`, `/dashboard/settings/billing`.
- **APIs**: `/enrollment/create-payment-intent/`, `/order-details/`, `/enroll-free/`, `/webhook/<gateway>/`, `/billing/summary|orders/`, `/refund-order/` (admin).
- **Reusable logic**: `checkout.store.ts`, payment services, `FulfillmentFacade` (**already updates instructor `students_count`** — the earnings data source).

### 3.4 Student dashboard & progress
- **Purpose**: track and continue learning.
- **Workflow**: overview stats → enrolled courses with % → per-course section/lecture/quiz status.
- **Pages**: `/dashboard`, `/dashboard/my-courses`.
- **APIs**: `/progress/student/overview|courses/`, `/progress/student/learn/course|section/<id>/`.
- **Reusable logic**: `DashboardPage`, `DashboardCourseCard`, the **dashboard shell** (`app/dashboard/(main)/layout.tsx` + `SideBar.tsx`) — the primary pattern the instructor shell mirrors.

### 3.5 Course player (learn)
- **Purpose**: consume content sequentially.
- **Workflow**: adaptive-HLS video (access-gated) → mark complete → unlock next → quiz (≥50% to pass) → completion.
- **Pages**: `/dashboard/learn/[id]`, `.../lecture/[lectureId]`, `.../quiz/[quizId]`.
- **APIs**: `/progress/student/learn/lecture/markcomplete/`, `/quiz/makeattempt/`, `/quiz/<id>/`.
- **Reusable logic**: `HlsVideoPlayer`, `LearnSideBar`, `ui.store.ts`, `can_access_lecture_video` (**already grants the owning instructor playback** — powers the instructor content preview).

### 3.6 Reviews
- **Purpose**: rate a completed course.
- **Workflow**: eligibility (enrolled + 100%) → submit/edit/delete → aggregates recomputed → instructor reputation reflected.
- **Pages**: `/dashboard/reviews`; public reviews on `/courses/[id]`.
- **APIs**: `/reviews/student/reviews`, `/reviews/course/<id>/`, `/reviews/eligibility/<id>/`.
- **Reusable logic**: `StarRating`, `StarInput`, `RatingComputing`, `get_instructor_rating` (**the review data instructors will want to see and respond to**).

**Baseline takeaway**: every student capability has an instructor counterpart — students *consume*
courses, progress, and reviews; instructors *produce* courses, *watch* progress in aggregate, and
*respond* to reviews. The instructor experience is the mirror image, built on the same shell.

---

## 4. Instructor Experience Vision

### 4.1 Onboarding
1. User registers choosing **Instructor** (existing toggle in `RegisterForm.tsx`) → OTP verify →
   `InstructorProfile` + `is_staff=True` provisioned by the existing `create_instructor` path.
2. On first login, role-aware routing sends them to `/instructor` (not `/dashboard`).
3. An **empty-state dashboard** greets a new instructor with a single primary CTA: *Create your first
   course*, plus a short checklist (complete instructor profile → create course → add curriculum →
   upload videos → publish).
4. **Instructor profile completion** (`title`, `about`, avatar) — reuses the profile-update path.

### 4.2 Daily workflow (established instructor)
- Land on **dashboard**: at-a-glance totals (courses, students, avg rating, earnings), recent
  enrollments, recent reviews, and any course "needs attention" (draft, failed video, unanswered review).
- Jump to **My Courses** → open a course → **curriculum builder** to add/reorder sections & lectures.
- **Upload a video** to a new lecture (direct-to-Cloudinary), watch `video_status` progress to COMPLETED.
- Check **analytics** for a course (enrollments over time, completion rate, quiz pass rate).
- Review the **students** roster for a course; skim **reviews** and respond.
- Check **earnings** and payout summary.

### 4.3 Primary goals
- Create, structure, and **publish** high-quality courses quickly.
- Understand **how students engage** (enrollment, completion, drop-off, quiz performance).
- **Grow revenue and reputation** (earnings + ratings/reviews).

### 4.4 Secondary goals
- Maintain a credible **public instructor profile**.
- Keep content **fresh** (edit, re-order, replace videos, unpublish/republish).
- Stay **informed** (notifications for new enrollments/reviews).

### 4.5 Common actions
Create course · edit course metadata · add/reorder section · add/reorder/delete lecture · upload/replace
video · build a quiz (questions + choices, mark correct) · publish/unpublish · view analytics · view
students · read/respond to reviews · view earnings · edit profile.

### 4.6 Edge cases
- **Publishing an incomplete course** (no sections/lectures, or a lecture whose `video_status ≠ COMPLETED`) → block with clear guidance.
- **Video upload fails / stuck PROCESSING** → surfaced state + retry.
- **Deleting content with enrolled students** → warn (cascade is irreversible; students lose access).
- **Editing a published course students are mid-way through** → allowed, but changes are live immediately (no versioning yet — see §15).
- **Reordering conflicts** (`unique_together (section, order)`) → the builder must renumber atomically.
- **Instructor with zero courses / zero students / zero earnings** → dedicated empty states everywhere.
- **A student refunds** → `students_count`/earnings must reflect it (already handled by `FulfillmentFacade`/`RefundService`).

---

## 5. User Stories

Priorities: **P1** = MVP authoring, **P2** = insight, **P3** = engagement/growth. Format mirrors the
project's Spec-Kit stories (Given/When/Then).

### 5.1 Primary stories (authoring & publishing) — P1
- **US-01 (Create course)**: *As an instructor, I want to create a course with title, description,
  price, category, level, language, and goals so that I can start building my curriculum.*
  - **Given** I am an authenticated instructor, **When** I submit the create-course form with valid
    data, **Then** a draft (`is_published=false`) course is created and owned by me.
- **US-02 (Edit course)**: *…edit my course's metadata and thumbnail so I can refine its presentation.*
  - **Given** a course I own, **When** I save changes, **Then** they persist and reject if I am not the owner.
- **US-03 (Build curriculum)**: *…add, rename, reorder, and delete sections and lectures so I can
  structure my course.*
  - **Given** a course I own, **When** I add/reorder a section or lecture, **Then** ordering stays unique
    and consistent (`unique_together`).
- **US-04 (Upload video)**: *…upload a video directly to a lecture and see its processing status so I
  know when it's ready.*
  - **Given** a lecture I own, **When** I upload a file, **Then** it goes directly to Cloudinary via a
    signed request and `video_status` transitions PENDING→PROCESSING→COMPLETED.
- **US-05 (Author quiz)**: *…create a section quiz with questions and multiple-choice answers, marking
  the correct choice, so I can assess students.*
- **US-06 (Publish)**: *…publish/unpublish a course so I control when students can discover and buy it.*
  - **Given** a course with at least one section, one lecture, and all videos COMPLETED, **When** I
    publish, **Then** `is_published=true` and it appears in the student catalog; **otherwise** publishing
    is blocked with reasons.

### 5.2 Secondary stories (insight) — P2
- **US-07 (Dashboard)**: *…see totals (courses, students, average rating, earnings) and recent activity
  the moment I log in so I understand my business at a glance.*
- **US-08 (Course analytics)**: *…see per-course enrollments over time, completion rate, and quiz pass
  rate so I can improve my content.*
- **US-09 (Student roster)**: *…see who is enrolled in a course and their progress so I know how my
  students are doing.*
- **US-10 (Profile)**: *…maintain a public instructor profile (title, about, avatar) so students trust me.*

### 5.3 Growth stories (engagement & earnings) — P3
- **US-11 (Reviews)**: *…read reviews on my courses and respond to them so I can engage students and
  address feedback.*
- **US-12 (Earnings)**: *…see revenue by course and over time, and refunds, so I can track income.*
- **US-13 (Notifications)**: *…be notified of new enrollments and new reviews so I can respond promptly.*

### 5.4 Administrative stories
- **US-14 (Admin oversight)**: *As an admin, I want to manage any instructor's courses and remove
  inappropriate reviews so I can keep the platform healthy.* (Backend already supports this via the
  admin viewset family and `/reviews/admin/...`; no new instructor-side work.)
- **US-15 (Instructor provisioning)**: *As the platform, when a user registers as an instructor, I
  create their `InstructorProfile` and grant instructor access so they can author immediately.*
  (Confirmed access model: `is_staff` + self-serve.)

### 5.5 Edge-case stories
- **US-16**: *…be prevented from publishing a course with no lectures or with a still-processing video,
  with a clear explanation.*
- **US-17**: *…be warned before deleting content that enrolled students depend on.*
- **US-18**: *…retry or replace a failed/stuck video upload.*
- **US-19**: *…see meaningful empty states when I have no courses/students/earnings/reviews yet.*
- **US-20**: *…never see or edit another instructor's content, even by guessing IDs* (ownership enforced
  server-side).

---

## 6. Capabilities

| # | Capability | Objective | Business value | Dependencies | Priority | Complexity | Reusable modules | New modules |
|---|-----------|-----------|----------------|--------------|----------|-----------|------------------|-------------|
| C1 | **Course Management** | CRUD + lifecycle of courses | Core supply-side; more courses = more GMV | Instructor auth, ownership | P1 | M | `InstructorCourseViewSet`, `CourseSerializer`, `CourseCard` | Instructor course pages/forms; publish-guard logic |
| C2 | **Curriculum Builder** | Structure sections/lectures/quizzes with ordering | Quality courses retain students | C1, ordering constraints | P1 | H | Instructor section/lecture/quiz viewsets; `accordion` | Drag-reorder UI; batch-order endpoint (optional) |
| C3 | **Video Upload & Processing** | Direct-to-Cloudinary lecture video with status | The #2 named gap; unblocks real content | Video signature endpoint, webhook | P1 | H | `VideoUploadService`, `upload-signature`, `video_status` | Chunked-upload UI + status polling |
| C4 | **Publishing Workflow** | Draft ↔ published with readiness gate | Controls catalog quality | C1–C3, `is_published` | P1 | M | `is_published` field | Readiness validation; publish/unpublish action + UI |
| C5 | **Instructor Dashboard** | At-a-glance business summary | Retention/engagement of instructors | C1, counters, ratings | P2 | M | `students_count`, `subscribers_count`, `get_instructor_rating` | Dashboard summary read API + page |
| C6 | **Course Analytics** | Enrollments/completion/quiz insight | Helps instructors improve → better outcomes | Enrollment, progress data | P2 | H | `Enrollment`, `LectureProgress`, `QuizAttempt` | Analytics aggregation read APIs + charts |
| C7 | **Student Management** | Roster + progress per course | Instructor support & transparency | Enrollment, progress | P2 | M | `Enrollment`, progress utils | Roster read API + page |
| C8 | **Instructor Profile** | Public identity management | Trust → conversion | `InstructorProfile`, profile update | P2 | S | Profile update path, `InstructorProfile` | Instructor profile edit page |
| C9 | **Reviews & Responses** | Read + respond to course reviews | Engagement, reputation repair | `Review`, ratings | P3 | M | `Review`, `get_instructor_rating`, `StarRating` | `ReviewResponse` model + endpoints + UI |
| C10 | **Earnings & Payouts** | Revenue/refund visibility | Instructor motivation/retention | Orders/Transactions | P3 | M | `Order`, `Transaction`, `FulfillmentFacade` | Earnings read API + page |
| C11 | **Notifications** | Alert on enrollment/review | Timeliness, re-engagement | net-new infra | P3 | H | `EmailService` (senders) | `Notification` model + API + (ideally) jobs |

Complexity: S = small, M = medium, H = high.

---

## 7. Feature Inventory

**C1 · Course Management** — Create Course · Edit Course (metadata + thumbnail) · Draft Courses list ·
Publish Course · Unpublish Course · Archive Course *(new: soft state)* · Duplicate Course *(new, optional)* ·
Delete Course (guarded).

**C2 · Curriculum Builder** — Add Section · Rename Section · Reorder Sections · Delete Section ·
Add Lecture · Edit Lecture (title/duration) · Reorder Lectures · Delete Lecture · Add Quiz to Section ·
Edit Quiz · Add/Edit/Delete Question · Add/Edit/Delete Choice · Mark Correct Choice.

**C3 · Video Upload** — Select/drag file · Signed direct-to-Cloudinary upload · Progress bar ·
Processing status (PENDING/PROCESSING/COMPLETED/FAILED) · Replace video · Retry failed.

**C4 · Publishing** — Readiness checklist · Publish · Unpublish · Blocked-publish reasons.

**C5 · Dashboard** — Summary tiles (courses/students/rating/earnings) · Recent enrollments ·
Recent reviews · Needs-attention list · Empty state.

**C6 · Analytics** — Enrollments over time · Completion rate · Section drop-off · Quiz pass rate ·
Per-course + aggregate.

**C7 · Students** — Roster per course · Per-student progress % · Enrolled date · Search/sort roster.

**C8 · Instructor Profile** — Edit title/about/avatar · Preview public profile.

**C9 · Reviews** — List reviews per course · Respond to review · Edit/delete response · Rating summary.

**C10 · Earnings** — Total/period revenue · Revenue by course · Refunds · Transaction list.

**C11 · Notifications** — New-enrollment alert · New-review alert · Read/unread · Notification center.

---

## 8. Information Architecture

**Confirmed decision**: a **separate top-level `app/(instructor)/` route group** with its own layout +
sidebar, mirroring but not sharing the student dashboard shell.

### 8.1 Top-level navigation (role-aware)
```
Authenticated user
├── role = student  → /dashboard        (existing student shell)
├── role = instructor → /instructor     (NEW instructor shell)
└── role = admin    → (admin uses Django admin / admin APIs; out of scope here)
```

### 8.2 Instructor sidebar (mirrors student `SideBar.tsx`, own nav set)
```
[ Instructor ]
├── Dashboard            /instructor
├── My Courses           /instructor/courses
│   └── (Create)         /instructor/courses/new
├── Students             /instructor/students
├── Analytics            /instructor/analytics
├── Reviews              /instructor/reviews
├── Earnings             /instructor/earnings
├── Notifications        /instructor/notifications
└── Settings
    ├── Profile          /instructor/settings/profile
    └── Instructor Bio   /instructor/settings/instructor-profile
```

### 8.3 Page hierarchy (tree)
```
/instructor                                   Dashboard (summary)
├── /courses                                  My Courses (list: draft + published)
│   ├── /new                                  Create Course (form)
│   └── /[courseId]                           Course workspace (tabbed)
│       ├── (overview)                        Course overview + publish control
│       ├── /curriculum                       Curriculum Builder (sections/lectures/quizzes)
│       │   └── /lectures/[lectureId]         Lecture editor + Video Upload
│       ├── /quizzes/[quizId]                 Quiz editor (questions/choices)
│       ├── /analytics                        Per-course analytics
│       ├── /students                         Per-course roster
│       └── /reviews                          Per-course reviews + responses
├── /students                                 All students (across courses)
├── /analytics                                Aggregate analytics
├── /reviews                                  All reviews (respond)
├── /earnings                                 Earnings & payouts
├── /notifications                            Notification center
└── /settings
    ├── /profile                              Account profile (shared path/pattern)
    └── /instructor-profile                   Public instructor bio (title/about/avatar)
```

### 8.4 Breadcrumbs
`Instructor / My Courses / {Course Title} / Curriculum / {Section} / {Lecture}` — derived from the route
segments; the course workspace keeps the course title as a persistent crumb root.

### 8.5 Layouts
```
app/(instructor)/layout.tsx           InstructorSidebar + scrollable <main> (mirrors dashboard/(main)/layout.tsx)
app/(instructor)/courses/[courseId]/layout.tsx   Course workspace tab bar (Overview·Curriculum·Analytics·Students·Reviews)
```

### 8.6 Dashboard organization
Summary tiles row → two-column: *Recent enrollments* + *Recent reviews* → *Needs attention* list →
quick actions (Create course · Upload video). New-instructor variant collapses to the onboarding checklist.

---

## 9. Page Inventory

> Permissions: all instructor pages require **authenticated + instructor** (route guard on
> `/instructor/*`, backend `isInstructor`). Data sources reference existing endpoints where present and
> **[NEW]** where a read API must be added (§13). Components in *italics* already exist.

| Page | URL | Purpose | Key components | Data sources | Primary actions | Loading | Empty | Error |
|------|-----|---------|----------------|--------------|-----------------|---------|-------|-------|
| Dashboard | `/instructor` | Business summary | Summary tiles, activity lists | **[NEW]** `/courses/instructor/dashboard/summary/` | Create course, jump to course | *skeleton* tiles | Onboarding checklist | Retry banner |
| My Courses | `/instructor/courses` | List own courses (draft+published) | *CourseCard* variant, status badge | `/courses/instructor/courses/` | New, edit, publish, delete | *CourseCardSkeleton* | "Create your first course" | Retry |
| Create Course | `/instructor/courses/new` | New draft | Form (*input/select/label*), Zod | POST `/courses/instructor/courses/` | Save draft | n/a | n/a | Field errors |
| Course Overview | `/instructor/courses/[id]` | Course summary + publish | Publish control, readiness list | `/courses/instructor/courses/{id}/`, **[NEW]** readiness | Publish/unpublish, edit | *skeleton* | — | Not-owner → 403 view |
| Edit Course | `/instructor/courses/[id]` (edit) | Metadata + thumbnail | Form, thumbnail upload | PATCH `/courses/instructor/courses/{id}/` | Save | *skeleton* | — | Field errors |
| Curriculum Builder | `/instructor/courses/[id]/curriculum` | Structure content | *accordion*, drag-reorder, section/lecture rows | instructor sections/lectures/quizzes endpoints | Add/reorder/delete | *skeleton* | "Add your first section" | Retry / order-conflict toast |
| Lecture Editor + Upload | `.../curriculum/lectures/[lectureId]` | Edit lecture + video | Uploader, progress, status badge | `upload-signature`, PATCH lecture, poll `video_status` | Upload/replace/retry | uploader idle | "No video yet" | Upload-failed state |
| Quiz Editor | `.../quizzes/[quizId]` | Author quiz | Question/choice editor, *StarInput* n/a | instructor quiz/question/choice endpoints | Add/edit questions, mark correct | *skeleton* | "No questions yet" | Field errors |
| Course Analytics | `/instructor/courses/[id]/analytics` | Per-course insight | Charts (line/bar), stat tiles | **[NEW]** `/courses/instructor/courses/{id}/analytics/` | Change period | *skeleton* | "No data yet" | Retry |
| Course Students | `/instructor/courses/[id]/students` | Roster + progress | Table, progress bars | **[NEW]** `/courses/instructor/courses/{id}/students/` | Search/sort | *skeleton* | "No students yet" | Retry |
| Course Reviews | `/instructor/courses/[id]/reviews` | Reviews + respond | *StarRating*, review list, response box | `/reviews/course/{id}/`, **[NEW]** response endpoint | Respond/edit | *skeleton* | "No reviews yet" | Retry |
| All Students | `/instructor/students` | Cross-course roster | Table, filters | **[NEW]** roster (aggregate) | Search/filter | *skeleton* | Empty | Retry |
| Aggregate Analytics | `/instructor/analytics` | All-course insight | Charts | **[NEW]** aggregate analytics | Period | *skeleton* | Empty | Retry |
| All Reviews | `/instructor/reviews` | Respond across courses | Review list | **[NEW]** instructor reviews feed | Respond | *skeleton* | Empty | Retry |
| Earnings | `/instructor/earnings` | Revenue/refunds | Stat tiles, table, chart | **[NEW]** `/enrollment/instructor/earnings/` | Period, export (later) | *skeleton* | "No earnings yet" | Retry |
| Notifications | `/instructor/notifications` | Alerts | List, read/unread | **[NEW]** `/…/notifications/` | Mark read | *skeleton* | "You're all caught up" | Retry |
| Instructor Profile | `/instructor/settings/instructor-profile` | Public bio | Form, avatar | profile update path, `InstructorProfile` | Save | *skeleton* | — | Field errors |

---

## 10. Workflows

### 10.1 Create Course
```
Instructor → /instructor/courses/new → fill form (Zod-validated)
   → POST /courses/instructor/courses/  (perform_create binds instructor_profile)
   → 201 draft (is_published=false) → redirect to /instructor/courses/{id}/curriculum
```

### 10.2 Build Curriculum
```
Add Section → POST instructor/sections/ {course, title, order}
Add Lecture → POST instructor/lectures/ {section, title, duration, order}
Reorder     → PATCH order fields (atomic renumber to respect unique_together)
Add Quiz    → POST instructor/quizzes/ {section} → add Questions → add Choices → mark is_correct
```

### 10.3 Upload Video (backend-ready path)
```
Lecture editor
  → POST /courses/video/upload-signature/ {lecture_id}     (isInstructor|isAdmin, ownership checked)
  → browser uploads file DIRECTLY to Cloudinary with returned signed credentials
  → Cloudinary transcodes (eager HLS) → signed webhook → /courses/video/webhook/
  → Lecture.video_status: PENDING → PROCESSING → COMPLETED
  → UI polls instructor lecture endpoint until COMPLETED (or FAILED → retry/replace)
```

### 10.4 Publish Course
```
Instructor clicks Publish
  → readiness check (≥1 section, ≥1 lecture, all videos COMPLETED)      [NEW validation]
  → if pass: PATCH /courses/instructor/courses/{id}/ {is_published:true} → appears in student catalog
  → if fail: blocked, show specific reasons (which lectures/sections are incomplete)
Unpublish → PATCH {is_published:false} (already-enrolled students retain access; hidden from catalog)
```

### 10.5 Edit Course
```
/instructor/courses/{id} edit → PATCH metadata/thumbnail → ownership enforced server-side
(no versioning: changes are immediately live for enrolled students — see Risks §15)
```

### 10.6 View Analytics
```
/instructor/courses/{id}/analytics → GET [NEW] analytics endpoint
  → aggregates Enrollment (over time), LectureProgress (completion/drop-off), QuizAttempt (pass rate)
  → render charts + stat tiles; period selector re-queries
```

### 10.7 Manage Students
```
/instructor/courses/{id}/students → GET [NEW] roster endpoint
  → list Enrollment rows for the course (only if course.instructor == caller)
  → per row: student, enrolled_at, progress % (derived from LectureProgress)
```

### 10.8 Review Assignments / Answer Questions
There is **no assignment or Q&A subsystem** today (only auto-scored quizzes). Instructors *author*
quizzes; scoring is automatic (`QuizAttempt`, 50% threshold). This document does **not** invent an
assignment-grading or Q&A feature (out of scope; noted as a future capability in §16/§17).

### 10.9 Respond to Reviews
```
/instructor/reviews (or per-course) → list Review rows for owned courses
  → POST [NEW] review-response {review_id, body}  → response shown under the review (public)
  → edit/delete own response
```

### 10.10 Handle Notifications
```
Enrollment activated / Review created → [NEW] Notification row for the course's instructor
  → /instructor/notifications lists unread-first → mark read
  → (optional) async email via existing EmailService sender — requires a job runner for scale (§15)
```

### 10.11 View Earnings
```
/instructor/earnings → GET [NEW] earnings endpoint
  → sum paid Order.amount for the instructor's courses, minus refunds; group by course + period
  → render totals, by-course table, trend chart
```

---

## 11. Permission Matrix

### 11.1 Roles
| Role | Backend gate | Landing | Scope |
|------|--------------|---------|-------|
| Student | authenticated (no staff/superuser) | `/dashboard` | Own enrollments/progress/reviews |
| Instructor | `isInstructor` = `is_staff` | `/instructor` | **Own** courses + their students/reviews/earnings |
| Admin | `isAdmin` = `is_superuser` | Django admin / admin APIs | All content |

### 11.2 Permissions (instructor)
| Action | Allowed on |
|--------|-----------|
| Create/read/update/delete course | **Own** courses only (`get_queryset` filtered by `instructor_profile`) |
| CRUD section/lecture/quiz/question/choice | Only within **own** courses (cascade ownership check) |
| Upload/replace video | Only lectures in **own** courses (`_get_owned_lecture`) |
| Publish/unpublish | **Own** courses |
| View analytics / students / earnings | **Own** courses only |
| Respond to reviews | Reviews on **own** courses |
| Edit instructor profile | **Own** `InstructorProfile` |
| View another instructor's private data | **Never** (server-enforced) |

### 11.3 Visibility
- **Draft courses** (`is_published=false`): visible only to the owning instructor (and admin); excluded
  from all student views.
- **Published courses**: visible to everyone; editable only by owner/admin.
- **Video streaming URLs**: served only to enrolled students, the **owning instructor**, or admin
  (`can_access_lecture_video` — already implemented).

### 11.4 Ownership
Ownership is anchored on `Course.instructor → InstructorProfile → CustomUser` and enforced by queryset
filtering + explicit `perform_create`/`perform_update` checks. **New read endpoints must apply the same
filter** — never trust a course/lecture ID from the client without confirming `instructor == request.user.instructor_profile`.

### 11.5 Restrictions
- Instructors cannot access admin endpoints (`isAdmin` only).
- Instructors cannot refund (admin-only) — but **can view** their earnings/refunds read-only.
- Frontend `proxy.ts` must guard `/instructor/*` (redirect students to `/dashboard`, unauthenticated to
  `/login`); the backend remains the source of truth (defense in depth).

---

## 12. Reusability Analysis

### 12.1 Can reuse directly
| Asset | Why |
|-------|-----|
| Instructor CRUD viewsets (`InstructorCourseViewSet` etc.) | Already ownership-scoped; the authoring backbone exists and is production-shaped. |
| Ownership pattern (`get_queryset` filter + `perform_create`) | Copy verbatim into new read views; consistent + safe. |
| Video pipeline (`upload-signature`, provider factory, `video_status`, webhook, `can_access_lecture_video`) | The hardest media work is done; the UI just drives it. |
| `get_instructor_rating`, `InstructorProfile.students_count`, `Course.subscribers_count`/`reviews_count` | Dashboard/analytics inputs already computed/maintained. |
| Atomic component library, `cn`, Tailwind tokens | Full design system; instructor pages compose the same primitives. |
| Feature-module convention, axios wrapper, TanStack Query, Zustand | Established patterns; new `featuers/instructor*` slots straight in. |
| Auth (login/OTP/Google/profile), `useProfile` | Same login; only landing/routing differs by role. |
| Dashboard shell **pattern** | Mirror it for `(instructor)` with its own nav set. |

### 12.2 Needs extension
| Asset | Extension |
|-------|-----------|
| `proxy.ts` route guard | Add **role awareness**: gate `/instructor/*`, redirect by role. (Requires role available at the edge — see §15 note on reading role without decoding the JWT client-side.) |
| `SideBar.tsx` | Currently hardcoded student nav; create a **sibling** `InstructorSidebar` (not a branch) with the instructor nav set. |
| `EmailService` / senders | Add new senders for enrollment/review notifications (reusing the Strategy pattern). |
| `CourseSerializer` | Possibly add instructor-only fields (readiness flags, draft counts) via a dedicated instructor serializer variant — do not change the student-facing shape. |
| Enrollment/payment reads | Add an **instructor earnings** read that aggregates existing `Order`/`Transaction` — no changes to payment writes. |

### 12.3 Needs refactor
| Asset | Refactor | Why |
|-------|----------|-----|
| `isInstructor = is_staff` | Optionally align to `role=='instructor'` / `hasattr(user,'instructor_profile')` | Current gate is semantically loose (any staff = instructor). Confirmed to **keep as-is for now**; flagged in §15. Revisit if admin/staff accounts should not be instructors. |
| Curriculum ordering (client-driven reorder) | Consider a small **batch-reorder** endpoint | Per-item PATCH risks transient `unique_together` violations during reordering; a batch/atomic renumber is safer (optional, P1/P2). |

### 12.4 Must be rebuilt (net-new)
| Area | Why nothing exists to reuse |
|------|----------------------------|
| Instructor **read/insight** APIs (dashboard summary, analytics, roster, earnings) | Only student/admin reads exist; instructor reads are absent. |
| Instructor **frontend** (routes, layouts, pages, feature modules, hooks) | Zero instructor UI today. |
| **Review responses** (`ReviewResponse`) | No response concept in the `Review` model. |
| **Notifications** (model + API + delivery) | No notification system anywhere. |
| **Publish-readiness validation** | `is_published` is a bare boolean with no gating logic. |
| **Background jobs** (if async notifications/analytics needed) | No Celery/Redis; all email is synchronous. |

---

## 13. Backend Impact

*(Described only — no implementation. All new endpoints follow the raw-payload contract and the
`{Role}{Entity}ViewSet` / ownership conventions.)*

### 13.1 New models
| Model | App | Purpose | Shape (conceptual) |
|-------|-----|---------|--------------------|
| `ReviewResponse` | `reviews` | Instructor reply to a review | FK → `Review` (1:1), FK author → `InstructorProfile`, `body`, timestamps |
| `Notification` | new `notifications` app (or `authentication`) | In-app alerts | FK → recipient `CustomUser`, `type` (enrollment/review), `payload`/`message`, `is_read`, `created_at` |
| *(optional)* course lifecycle fields | `course` | Archive/soft-delete | add `is_archived` / `deleted_at` (migration-only; never modify existing migrations — add new) |

### 13.2 New APIs (read-focused, instructor-scoped)
| Endpoint | Method | Returns |
|----------|--------|---------|
| `/courses/instructor/dashboard/summary/` | GET | totals (courses, students, avg rating, earnings), recent enrollments, recent reviews, needs-attention |
| `/courses/instructor/courses/{id}/analytics/` | GET | enrollments-over-time, completion rate, section drop-off, quiz pass rate |
| `/courses/instructor/analytics/` | GET | aggregate across owned courses |
| `/courses/instructor/courses/{id}/students/` | GET | roster: student, enrolled_at, progress % (paginated) |
| `/courses/instructor/courses/{id}/publish/` (or PATCH existing) | POST/PATCH | publish/unpublish with readiness validation |
| `/reviews/instructor/reviews/` | GET | reviews across owned courses |
| `/reviews/instructor/reviews/{id}/response/` | POST/PATCH/DELETE | create/edit/delete a response |
| `/enrollment/instructor/earnings/` | GET | revenue by course + period, refunds, transactions |
| `/notifications/` | GET / PATCH | list + mark-read |

### 13.3 New serializers
Instructor dashboard/analytics/earnings/roster serializers; `ReviewResponseSerializer`; a possible
`InstructorCourseSerializer` variant exposing readiness/draft fields (keep student serializer untouched).

### 13.4 New services
- **`InstructorAnalyticsService`** — encapsulate aggregation over `Enrollment` / `LectureProgress` /
  `QuizAttempt` (keep views thin; mirror the existing service-layer style).
- **`InstructorEarningsService`** — aggregate `Order`/`Transaction` (paid − refunded) per course/period.
- **`PublishReadinessService`** — validate a course is publishable.
- Extend **`EmailService`** with enrollment/review notification senders.

### 13.5 New permissions
Reuse `isInstructor`. Introduce a small reusable **ownership mixin** (`get_queryset` filter helper) so
every new read view enforces `instructor == request.user.instructor_profile` consistently — replacing
today's ad-hoc per-view checks.

### 13.6 Database changes
Additive migrations only (per Hard Rules): `ReviewResponse`, `Notification`, optional
`is_archived`/`deleted_at`. **No modification of existing migrations.** Add indexes for analytics-heavy
queries (`Enrollment(course, created_at)`, `LectureProgress(lecture, is_completed)`).

### 13.7 Background jobs
None exist. For P1–P2, analytics/earnings can be computed **synchronously on read** (acceptable at
current scale). For P3 notifications and async email at scale, introduce a job runner (Celery/RQ +
Redis) — called out as a dependency/risk, not a P1 requirement.

### 13.8 Notifications
New `Notification` model + list/mark-read API; write triggers on enrollment activation (hook into
`FulfillmentFacade`) and review creation (hook into the reviews create path). In-app first; email
delivery reuses `EmailService`.

---

## 14. Frontend Impact

### 14.1 New pages
All pages in §9 under `app/(instructor)/…`: dashboard, courses (list/new/workspace with
overview·curriculum·lecture editor·quiz editor·analytics·students·reviews tabs), aggregate students /
analytics / reviews, earnings, notifications, instructor profile.

### 14.2 New layouts
- `app/(instructor)/layout.tsx` — `InstructorSidebar` + scrollable `<main>` (mirrors
  `app/dashboard/(main)/layout.tsx`).
- `app/(instructor)/courses/[courseId]/layout.tsx` — course-workspace tab bar.

### 14.3 New feature modules (`src/featuers/`, matching house convention incl. the `featuers` spelling)
```
featuers/instructor-courses/     api · hooks · components · schemas (*.schma.ts) · types · index.ts
featuers/instructor-curriculum/  (sections/lectures/quizzes authoring + video upload)
featuers/instructor-analytics/
featuers/instructor-students/
featuers/instructor-reviews/
featuers/instructor-earnings/
featuers/instructor-dashboard/
featuers/notifications/
```

### 14.4 New hooks (TanStack Query)
Queries: `useInstructorDashboard`, `useInstructorCourses`, `useInstructorCourse`, `useCourseAnalytics`,
`useCourseStudents`, `useInstructorEarnings`, `useInstructorReviews`, `useNotifications`.
Mutations: `useCreateCourse`, `useUpdateCourse`, `usePublishCourse`, `useCreateSection`,
`useReorderSections`, `useCreateLecture`, `useUploadLectureVideo`, `useCreateQuiz`,
`useRespondToReview`, `useMarkNotificationRead`.

### 14.5 New queries/mutations (API clients)
`instructorCoursesAPI`, `instructorCurriculumAPI`, `instructorAnalyticsAPI`, `instructorStudentsAPI`,
`instructorEarningsAPI`, `instructorReviewsAPI`, `notificationsAPI` — each a namespaced axios object,
reusing the shared `axios` instance (`src/lib/axios.ts`) and error handling.

### 14.6 New contexts / state
- Prefer **TanStack Query as the source of truth** (as the student side already does) — avoid a bespoke
  auth context.
- New Zustand slices only where UI state is genuinely local: `instructorCurriculum.store.ts` (builder
  open/reorder state), `videoUpload.store.ts` (upload progress/status), possibly `notifications.store.ts`
  (unread badge).

### 14.7 Shared components (new, reusable)
Data table (roster/earnings/reviews), chart primitives (line/bar for analytics — follow the project's
dataviz conventions and Tailwind tokens), file uploader with progress, video-status badge,
publish-readiness checklist, empty-state and error-state components. Add these under
`components/molecules|organisms/` so the student side can borrow them later.

### 14.8 Routing impact (`proxy.ts`)
Extend the guard: add `/instructor` to protected routes and **branch by role** — instructors hitting
`/dashboard` → `/instructor` and students hitting `/instructor` → `/dashboard`; unauthenticated →
`/login`. Because role must be known at the edge and the JWT is HttpOnly, either (a) set a small
**non-sensitive `role` cookie** at login alongside the JWT, or (b) do a lightweight role check in a
server component / layout. **Decision needed at implementation time** (flagged in §15); recommendation:
a readable `role` cookie (non-HttpOnly, non-sensitive) for edge routing, with the backend as the real
gate.

### 14.9 State management impact
Minimal global-state growth; most instructor state is server state (Query) or view-local (Zustand). No
Redux (installed but unused — do not introduce).

---

## 15. Risks

### 15.1 Technical
- **`isInstructor = is_staff` is semantically loose.** Any staff user is treated as an instructor and
  any instructor gets `is_staff`. Confirmed to keep for now, but new instructor read endpoints should
  additionally rely on `request.user.instructor_profile` existing, so a staff account without an
  `InstructorProfile` fails cleanly rather than 500-ing.
- **Edge-side role routing vs HttpOnly JWT.** `proxy.ts` can't decode the HttpOnly token to read role.
  Needs a readable `role` cookie or a server-component check; picking wrong risks UI flicker or a
  perceived auth bypass on the client (the backend still enforces).
- **Curriculum reordering + `unique_together (section, order)`** can transiently collide under per-item
  PATCH; mitigate with a batch/atomic reorder endpoint.
- **Synchronous analytics/earnings on read** may get slow as data grows (no caching/jobs); add indexes
  and consider caching/denormalization before scale.

### 15.2 UX
- **No content versioning**: editing a published course changes it live for mid-course students — can
  confuse learners. Mitigate with clear "changes are live" messaging; consider drafts later.
- **Video processing latency**: instructors may expect instant availability; must communicate
  PROCESSING state clearly and avoid letting them publish before COMPLETED.
- **Empty states everywhere**: a new instructor sees many zero-data screens; strong onboarding/empty
  states are essential to avoid a "dead dashboard."

### 15.3 Performance
- Analytics aggregation over `LectureProgress`/`QuizAttempt` for large courses; needs indexed queries
  and pagination on rosters.
- Video-status **polling** from the lecture editor — bound the interval / stop on terminal state to
  avoid request storms (no WebSocket infra today).

### 15.4 Security
- **Ownership must be enforced on every new read endpoint** — the biggest risk is an instructor reading
  another instructor's students/earnings/analytics by ID. Standardize the ownership filter (mixin).
- **Draft leakage**: ensure draft courses never appear in any student/public serializer path.
- **Notification/earnings data** is sensitive; never expose another instructor's aggregates.
- Keep the `role` routing cookie **non-sensitive** (role only, not a token); never move the JWT out of
  HttpOnly.

### 15.5 Future scalability
- **No background-job runner** limits async notifications, scheduled analytics, and large email fan-out;
  introducing Celery/RQ + Redis is the main infra investment for P3.
- **No real-time layer** (WebSockets) — live notifications/progress would need new infra.
- **No soft-delete/versioning** — deleting content is irreversible and risky at scale; a soft-delete
  model is a sensible pre-scale addition.

---

## 16. Recommended Development Roadmap

Phases are ordered so each delivers an independently valuable, closely-related slice. Aligns with
`specs/_overview.md`'s #1/#2 next steps.

### Phase 1 — Instructor Authoring MVP (P1)
**Goal**: an instructor can create, structure, fill with video, and publish a real course from the UI.
- Role-aware routing (`proxy.ts` + role cookie/server check) and the `(instructor)` shell +
  `InstructorSidebar`.
- Course Management UI (list/create/edit) on the **existing** instructor CRUD APIs.
- Curriculum Builder UI (sections/lectures/quizzes) + optional batch-reorder endpoint.
- Video Upload UI on the **existing** signature/webhook pipeline + status polling.
- Publishing workflow + **`PublishReadinessService`** (the only meaningful new backend logic here).
**Outcome**: closes the #1 and #2 named gaps; end-to-end supply-side becomes self-serve.

### Phase 2 — Instructor Insight (P2)
**Goal**: instructors understand their courses and students.
- Instructor **Dashboard summary** API + page.
- **Course & aggregate Analytics** (`InstructorAnalyticsService`) + charts.
- **Student roster** per course (+ aggregate) with progress.
- **Instructor public profile** editing.
**Outcome**: retention/engagement of instructors; data-informed course improvement.

### Phase 3 — Engagement & Earnings (P3)
**Goal**: close the loop on reputation and revenue.
- **Reviews & responses** (`ReviewResponse` model + endpoints + UI).
- **Earnings** (`InstructorEarningsService`) + page.
- **Notifications** (model + API + in-app center; async email + job runner as the infra dependency).
**Outcome**: instructors are motivated, informed, and responsive.

### Phase 4 — Hardening & scale (post-MVP, optional)
Soft-delete/versioning, caching/denormalized analytics, background jobs, batch operations
(duplicate/archive course), export.

---

## 17. Suggested Spec Breakdown

Each spec is independently implementable and mirrors the existing `specs/features/*` +
`specs/00x-*` (Spec-Kit Format B) conventions. Recommended numbering continues the existing sequence
(`003…`). Sizes are rough (S ≈ few days, M ≈ 1–2 weeks, L ≈ 2–3 weeks of focused work).

| Order | Spec | Purpose | Scope | Dependencies | Size |
|-------|------|---------|-------|--------------|------|
| 1 | **003-instructor-foundation** | Role-aware routing + instructor shell | `proxy.ts` role gating, role cookie/server check, `(instructor)` layout + `InstructorSidebar`, instructor landing | Existing auth | S–M |
| 2 | **004-instructor-course-management** | Course CRUD UI | `featuers/instructor-courses`, list/create/edit pages on existing instructor course API | 003 | M |
| 3 | **005-instructor-curriculum-builder** | Sections/lectures/quizzes authoring | Builder UI, reorder (opt. batch endpoint), quiz editor | 004 | L |
| 4 | **006-instructor-video-upload** | Direct-to-Cloudinary lecture video UI | Uploader + progress + `video_status` polling on existing signature/webhook | 005 | M |
| 5 | **007-course-publishing** | Draft→publish with readiness gate | `PublishReadinessService`, publish/unpublish UI, blocked reasons | 005, 006 | S–M |
| 6 | **008-instructor-dashboard** | Summary landing | `/instructor/dashboard/summary/` API + page + empty/onboarding states | 004 | M |
| 7 | **009-instructor-analytics** | Course + aggregate analytics | `InstructorAnalyticsService`, analytics APIs + charts | 004, 008 | L |
| 8 | **010-instructor-students** | Roster + progress | roster APIs + pages | 004 | M |
| 9 | **011-instructor-profile** | Public bio editing | instructor profile page on existing profile path | 003 | S |
| 10 | **012-instructor-reviews-responses** | Read + respond to reviews | `ReviewResponse` model + endpoints + UI | reviews app | M |
| 11 | **013-instructor-earnings** | Revenue/refund visibility | `InstructorEarningsService` + earnings API + page | enrollment app | M |
| 12 | **014-notifications** | In-app alerts (+ async email) | `Notification` model + API + center; job runner as dependency | enrollment/reviews hooks | L |

> **Sequencing rationale**: 003 unlocks everything; 004–007 are the authoring MVP (Phase 1) and should
> ship together; 008–011 are the insight layer (Phase 2); 012–014 are engagement/earnings (Phase 3),
> with 014 carrying the only significant new infrastructure (a background-job runner). Every spec
> reuses the existing service-layer, component library, and feature-module conventions, and adds only a
> thin, ownership-scoped backend surface where insight data is genuinely missing.

---

*End of discovery document. This is an analysis and planning artifact only — no implementation code is
included or implied. It is intended as the direct foundation for the Spec-Kit specifications proposed
in §17.*
