# Implementation Plan: Instructor Foundation — Role-Aware Routing & Instructor Shell

**Branch**: `003-instructor-foundation` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-instructor-foundation/spec.md`

## Summary

Give instructors a first-class entry point by adding a **role-aware routing layer** and a **dedicated
instructor shell**. Concretely: (1) the backend emits a small **non-sensitive `role` cookie** alongside
the existing HttpOnly JWT cookies (set in the one shared `set_jwt_cookies` helper, cleared in
`clear_jwt_cookies`), carrying a computed routing role (`admin` when superuser, else `instructor` when
`role == 'instructor'`, else `student`); (2) `src/proxy.ts` reads that cookie at the edge and enforces a
three-way branch — instructors land on `/instructor`, students on `/dashboard`, admins on an
"admin-unavailable" notice — redirecting cross-role access, with the shared course-player route
allow-listed; (3) a new `app/(instructor)/` route group mirrors the student dashboard shell with a
sibling `InstructorSidebar`, a landing placeholder, and coming-soon placeholders for later specs. The
backend remains the security boundary — the cookie only drives UI routing.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16 App Router, React 19) frontend; Python 3.12 / Django 6.0 + DRF backend
**Primary Dependencies**: Next.js middleware (`proxy.ts`), TanStack Query, Zustand, Axios; SimpleJWT (HttpOnly cookies), CookieJWTAuthentication; Tailwind v4 + existing atomic component library
**Storage**: PostgreSQL — **no schema change and no migration** required by this feature
**Testing**: Backend Django `tests.py` (role-cookie set/clear assertions); frontend verified via the browser-preview routing walkthrough in quickstart.md
**Target Platform**: Web (SSR + client) on the existing decoupled two-tier deployment
**Project Type**: Web application (existing `backend/` + `front-end/`)
**Performance Goals**: Redirect decisions resolve at the edge before any protected content paints (SC-006); zero wrong-role shell flashes (SC-003)
**Constraints**: JWT MUST stay HttpOnly (Constitution III) — the new `role` cookie is non-HttpOnly and non-sensitive (role string only); backend role gates remain authoritative (defense in depth); reuse existing feature-module / atomic-design / axios+Query conventions; additive-only (no existing files rewritten destructively)
**Scale/Scope**: Small foundation — 1 backend helper edit (+ optional test), 1 middleware edit, 1 new route group (layout + sidebar organism + landing + admin notice + placeholder pages), 1 small client role helper

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Verdict |
|-----------|-----------|---------|
| I. Type Safety First | Routing role modeled as a TS union (`"student" \| "instructor" \| "admin"`); `InstructorSidebar` and pages fully typed; no `any`. | ✅ Pass |
| II. Component-First Architecture | `InstructorSidebar` added as an **organism** (sibling to `SideBar.tsx`, not a branch); placeholder/empty states reuse existing atoms; shell layout mirrors `dashboard/(main)/layout.tsx`. | ✅ Pass |
| III. Security-First Development | JWT tokens remain in HttpOnly cookies untouched. The new `role` cookie carries only a non-secret role string (non-HttpOnly so the edge/UI can read it); it is explicitly **not** a security boundary — every instructor API keeps its `isInstructor` gate, so a tampered cookie yields UI routing only, never data. | ✅ Pass |
| IV. Testing Discipline | Backend unit test asserts the `role` cookie is set on auth and deleted on logout with correct flags; routing paths validated through the quickstart walkthrough. | ✅ Pass |
| V. Documentation as Code | This plan + research + contracts document the cookie and routing contract; CLAUDE.md/`_conventions` remain accurate (new route group follows documented patterns). | ✅ Pass |

**Result**: No violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-instructor-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (cookie + relied-upon fields; no DB models)
├── quickstart.md        # Phase 1 output (routing verification walkthrough)
├── contracts/           # Phase 1 output
│   ├── role-cookie.md          # The role cookie contract (shape, flags, lifecycle)
│   └── routing-contract.md     # Edge routing decision table (proxy.ts behavior)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit.specify)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/apps/authentication/
├── utils.py             # EDIT: set_jwt_cookies() also sets `role` cookie; clear_jwt_cookies() deletes it
└── tests.py             # ADD: assert role cookie set on login/verify, cleared on logout

front-end/src/
├── proxy.ts             # EDIT: read `role` cookie; add role-aware three-way guard for /instructor & /dashboard
├── lib/
│   └── cookies.ts       # EDIT/ADD: readRoutingRole() helper (client-side read of the non-HttpOnly cookie)
├── components/organisms/
│   └── InstructorSidebar.tsx    # NEW: sibling of SideBar.tsx with the instructor nav set
└── app/(instructor)/            # NEW route group (mirrors app/dashboard/(main))
    ├── layout.tsx               # InstructorSidebar + scrollable <main>
    ├── page.tsx                 # Instructor landing (foundational welcome/getting-started placeholder)
    ├── loading.tsx              # Route-level loader (mirrors student pattern)
    ├── courses/page.tsx         # Placeholder ("coming soon") — real UI in spec 004
    ├── students/page.tsx        # Placeholder — spec 010
    ├── analytics/page.tsx       # Placeholder — spec 009
    ├── reviews/page.tsx         # Placeholder — spec 012
    ├── earnings/page.tsx        # Placeholder — spec 013
    └── settings/page.tsx        # Placeholder — spec 011

front-end/src/app/(instructor)/
└── admin-unavailable/           # NEW: admin (superuser) notice route (or a shared /role-unavailable page)
    └── page.tsx
```

**Structure Decision**: Web application. Per the product-confirmed constraint, the instructor UI is an
isolated shell — its own `layout.tsx` + sibling `InstructorSidebar` organism, mirroring (not sharing)
`app/dashboard/(main)/layout.tsx` and `components/organisms/SideBar.tsx`. The only cross-cutting edits are
the two shared auth-cookie helpers (`backend/.../utils.py`) and the edge guard (`front-end/src/proxy.ts`);
everything else is additive new files. No new backend app, model, or migration is introduced.

> **As-built correction**: the shell is at `front-end/src/app/instructor/` (a real path segment with its
> own layout), not a parenthesised `app/(instructor)/` route group as originally sketched. A route group's
> root `page.tsx` resolves to `/` and collides with the existing `(main)/page.tsx`. A plain `instructor/`
> segment produces the intended `/instructor/*` URLs and still scopes the layout to the instructor section.
> The admin notice is a standalone top-level route `app/admin-unavailable/` (outside the guarded prefixes,
> so no shell and no redirect loop).

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
