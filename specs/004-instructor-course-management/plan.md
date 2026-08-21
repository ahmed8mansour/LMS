# Implementation Plan: Instructor Course Management — My Courses, Create, Edit & Course Workspace

**Branch**: `004-instructor-course-management` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-instructor-course-management/spec.md`

## Summary

Turn the placeholder **My Courses** destination (scaffolded in 003) into a working course-management
surface: an instructor can list every course they own (client-side filter + title search), create a new
**draft** course from a validated form, edit its metadata and thumbnail on a dedicated edit route, delete
a course behind an enrollment-aware confirmation, and open a per-course **workspace** whose Overview tab
summarises the course and whose later-spec tabs (Curriculum, Analytics, Students, Reviews) render
placeholders.

The work is **frontend-predominant** — a new `featuers/instructor-courses` module plus instructor app
routes — on top of the **existing** ownership-scoped `InstructorCourseViewSet` at
`/courses/instructor/courses/`. Three small, ownership-safe **backend accommodations** are required (all
anticipated by the discovery doc §12.2/§13.3; none changes the student-facing JSON shape or adds a CRUD
endpoint):

1. A dedicated **instructor course serializer** that makes the server-managed fields
   (`rating`, `subscribers_count`, `reviews_count`, `is_published`) read-only and defaults them on create
   so a draft can be created from metadata alone.
2. **Thumbnail via the direct-to-Cloudinary flow** (per owner request — avoids slow multipart uploads
   through Django): change `Course.thumbnail` from `ImageField` → `URLField` (mirroring the existing
   `profile_picture` field), so create/edit are **plain JSON** carrying a Cloudinary `secure_url`. The
   client uploads the file straight to Cloudinary using the **existing generic signature endpoint**
   (`GET /auth/user/getCloudinarySignature/`, reused), exactly like the profile-picture flow. This is an
   **additive new migration** (never edits existing migrations) and, with `null=True, blank=True`, makes
   thumbnail optional at draft time for free.
3. **Draft-friendly create** — thumbnail/language/goals optional (item 2 covers thumbnail).

The student-facing `thumbnail` stays a `string` URL in the API, so the student experience is unchanged.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16 / React 19) frontend; Python 3 / Django 6.0 + DRF backend
**Primary Dependencies**: Next.js App Router, TanStack Query, React Hook Form + Zod (`@hookform/resolvers`),
Axios (shared `@/lib/axios` with cookie auth + refresh), Tailwind CSS v4, Radix/shadcn atoms; DRF
`ModelViewSet`, Cloudinary storage for `ImageField`
**Storage**: PostgreSQL — one additive migration: `Course.thumbnail` `ImageField` → `URLField` (mirrors
`profile_picture`); Cloudinary holds thumbnail media (uploaded direct from the client, URL stored)
**Testing**: Backend — Django `APITestCase` for the instructor course endpoint (create defaults, ownership,
draft creation). Frontend — component/interaction tests for forms and list per constitution ("SHOULD" for
complex interactions); manual quickstart verification via the browser preview
**Target Platform**: Responsive web (desktop-first shell, sidebar collapses on narrow viewports)
**Project Type**: Web application (Next.js frontend + Django REST backend)
**Performance Goals**: My Courses interaction feels instant — client-side filter/search over a single
fetch of the instructor's own courses (bounded per-instructor); create-to-workspace in under 2 minutes (SC-002)
**Constraints**: Ownership enforced server-side on every action (defense in depth); drafts never leak to
student/public; no new course model, no new CRUD endpoint, no publish logic (deferred to 007); one
additive migration for the `thumbnail` field-type change (never modify existing migrations); thumbnail
uploads go **direct-to-Cloudinary** (no multipart through Django)
**Scale/Scope**: Per-instructor course counts are small/bounded (tens, not thousands); this feature adds ~1
frontend feature module, ~5 instructor routes, and one instructor serializer + minor viewset wiring

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ PASS | New module is TypeScript-strict; explicit `Course`/form types; Zod schemas validate create/edit inputs and narrow the API payload. No `any`. |
| II. Component-First Architecture | ✅ PASS | Reuses atoms (`input`, `select`, `label`, `button`, `alert-dialog`, `skeleton`) and molecules (`CourseCard`, `CourseCardSkeleton`, `ComingSoon`); new pieces are small, self-contained components with explicit props under the atomic-design tree. |
| III. Security-First Development | ✅ PASS | Uses `CookieJWTAuthentication` via the shared axios instance; ownership is enforced by the existing `get_queryset` filter + `perform_create` (the authoritative gate). Server-managed fields become read-only in the instructor serializer, closing a mass-assignment gap (a client could otherwise set `is_published`/`rating`). Thumbnail upload reuses the existing authenticated, signed Cloudinary flow (same trust model as profile pictures). No raw SQL; ORM only. |
| IV. Testing Discipline | ✅ PASS | Backend `APITestCase` for the serializer defaults + ownership + draft-create (a model/service-adjacent change). Frontend interaction tests for form validation and delete confirmation (complex interactions). |
| V. Documentation as Code | ✅ PASS | This plan + research/data-model/contracts/quickstart; the API contract for the instructor course endpoint is documented; the serializer "why" is captured inline. |

**Result**: PASS — no violations. Complexity Tracking not required.

**Backend-change note (not a violation)**: The spec's "no new CRUD endpoint" holds. The accommodations are
*required for correctness*: (a) the current `CourseSerializer` exposes `rating`/`subscribers_count`/
`reviews_count`/`is_published` as writable while the model gives them no defaults, so a minimal draft
create would both fail and be mass-assignable; (b) `Course.thumbnail` is an `ImageField`, incompatible
with the requested direct-to-Cloudinary (URL-string) flow, so it changes to a `URLField` via an **additive
new migration**. Both are in-scope and constitution-aligned (security + type-safe contract), and neither
alters the student-facing JSON shape.

## Project Structure

### Documentation (this feature)

```text
specs/004-instructor-course-management/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions (serializer, thumbnail transport, routing, forms)
├── data-model.md        # Phase 1 — Course fields, states, validation, form ↔ payload mapping
├── quickstart.md        # Phase 1 — manual verification walkthrough
├── contracts/
│   └── instructor-courses.md   # CRUD contract for /courses/instructor/courses/
├── checklists/
│   └── requirements.md  # from /speckit.specify
└── tasks.md             # Phase 2 — created by /speckit.tasks (NOT here)
```

### Source Code (repository root)

```text
backend/apps/course/
├── serializers.py        # + InstructorCourseSerializer (read-only server fields; thumbnail = URL string)
├── views.py              # InstructorCourseViewSet: use the new serializer (get_serializer_class or swap)
├── models.py             # Course.thumbnail: ImageField → URLField(max_length=500, null=True, blank=True)
└── migrations/           # NEW migration for the thumbnail field-type change (never edit existing)

front-end/src/
├── lib/
│   └── cloudinary.ts     # extract shared uploadToCloudinary() (from auth.api.ts) → reuse for thumbnails
├── app/instructor/
│   ├── courses/
│   │   ├── page.tsx                     # My Courses (replaces ComingSoon placeholder)
│   │   ├── new/page.tsx                 # Create Course
│   │   └── [courseId]/
│   │       ├── layout.tsx               # Course workspace shell (tab bar + breadcrumb root)
│   │       ├── page.tsx                 # Overview tab (read-only status + summary)
│   │       ├── edit/page.tsx            # Edit Course (reuses the create form)
│   │       ├── curriculum/page.tsx      # placeholder (ComingSoon) — spec 005
│   │       ├── analytics/page.tsx       # placeholder — spec 009
│   │       ├── students/page.tsx        # placeholder — spec 010
│   │       └── reviews/page.tsx         # placeholder — spec 012
└── featuers/instructor-courses/
    ├── api/instructorCourses.api.ts     # namespaced instructorCoursesAPI (list/get/create/update/delete)
    ├── hooks/
    │   ├── useInstructorCourses.tsx     # list (own courses)
    │   ├── useInstructorCourse.tsx      # single course (owned)
    │   ├── useCreateCourse.tsx          # mutation → redirect to workspace
    │   ├── useUpdateCourse.tsx          # mutation (metadata + thumbnail)
    │   └── useDeleteCourse.tsx          # mutation (invalidate list)
    ├── components/
    │   ├── MyCoursesGrid.tsx            # grid + status filter + title search (client-side)
    │   ├── InstructorCourseCard.tsx     # card variant w/ status badge + Edit/Manage
    │   ├── CourseForm.tsx               # shared create/edit form (RHF + Zod, goals repeatable rows, thumbnail)
    │   ├── GoalsListField.tsx           # add/remove goal rows → string[]
    │   ├── CourseWorkspaceTabs.tsx      # tab bar for [courseId] layout
    │   ├── CourseOverview.tsx           # Overview summary (read-only status)
    │   └── DeleteCourseDialog.tsx       # alert-dialog, enrollment-aware copy
    ├── schemas/instructorCourses.schma.ts  # createCourseSchema / editCourseSchema (Zod)
    ├── types/instructorCourses.types.ts    # InstructorCourse, form data, status
    └── index.ts
```

**Structure Decision**: Web application. Frontend follows the established house convention
(`featuers/{feature}/{api,hooks,components,schemas,types,index.ts}`, the `featuers` spelling, `*.schma.ts`,
`use{Action}.tsx`, namespaced `{feature}API`) and slots pages into the existing `app/instructor/*` shell
from 003; the shared `uploadToCloudinary` helper is extracted to `lib/cloudinary.ts` so both auth and
instructor-courses use one implementation (extend, don't duplicate). Backend changes are confined to
`apps/course` serializers/views/models plus **one additive migration** for the `thumbnail` field-type
change (see research R1/R2).

## Complexity Tracking

No constitution violations — table intentionally omitted.
