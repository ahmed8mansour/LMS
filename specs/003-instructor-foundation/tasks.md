---
description: "Task list for Instructor Foundation — Role-Aware Routing & Instructor Shell"
---

# Tasks: Instructor Foundation — Role-Aware Routing & Instructor Shell

**Input**: Design documents from `/specs/003-instructor-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Only ONE automated test is in scope (the backend `role`-cookie unit test the plan/Constitution IV
call for). Frontend routing is verified through the manual `quickstart.md` walkthrough — no E2E harness exists.

**Organization**: Tasks are grouped by user story. MVP = US1 + US2 (both P1). US3 (P2) is the polished shell.

> **Status: ✅ COMPLETE** (implemented 2026-08-20). All phases done and verified.
> **Implementation note**: the instructor shell lives at `front-end/src/app/instructor/` (a real path
> segment with its own `layout.tsx`), **not** a parenthesised `app/(instructor)/` route group. A route
> group's root `page.tsx` resolves to `/` and collides with the existing `(main)/page.tsx` ("two parallel
> pages resolve to the same path"). A plain `instructor/` segment yields the intended `/instructor/*` URLs
> and still scopes the shell layout to the instructor section only — the confirmed design intent is met.
> The admin notice is a standalone top-level route `app/admin-unavailable/` (outside the guarded prefixes).

## Path Conventions
Web app: backend at `backend/apps/…`, frontend at `front-end/src/…`. All paths below are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the new frontend locations this feature adds.

- [X] T001 [P] Create the route-group directory `front-end/src/app/instructor/` (empty scaffold to hold the instructor shell)
- [X] T002 [P] Ensure `front-end/src/lib/cookies.ts` exists (create it if missing) as the home for the client role helper

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `role` cookie contract + client reader that BOTH routing and landing depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 In `backend/apps/authentication/utils.py`, extend `set_jwt_cookies(response, user)` to also set a non-HttpOnly `role` cookie: value = `"admin"` if `user.is_superuser`, elif `user.role == "instructor"` then `"instructor"`, else `"student"`; flags `httponly=False`, `samesite="Lax"`, `secure` per `JWT_COOKIE_SETTINGS`, `path="/"`, expiry aligned to the refresh token (7d). (Contract: `contracts/role-cookie.md`)
- [X] T004 In `backend/apps/authentication/utils.py`, extend `clear_jwt_cookies(response)` to `delete_cookie("role", path="/", samesite="Lax")` so logout removes it
- [X] T005 In `backend/apps/authentication/views.py`, in `TokenRefreshCookieView.post` (which sets `access_token` directly, not via `set_jwt_cookies`), also re-set the `role` cookie for the refreshed user so it stays alive across long, rotated sessions
- [X] T006 [P] Add backend unit test in `backend/apps/authentication/tests.py`: assert the `role` cookie is set with the correct value + flags on login and on OTP-verify (student/instructor/admin), and deleted on logout
- [X] T007 [P] In `front-end/src/lib/cookies.ts`, add `export type RoutingRole = "student" | "instructor" | "admin"` and `readRoutingRole(): RoutingRole` that reads the `role` cookie client-side and defaults unknown/missing to `"student"` (display/routing only — never an auth check)

**Checkpoint**: The role cookie is emitted, cleared, and readable — user stories can begin.

---

## Phase 3: User Story 1 - Instructor lands in their own workspace (Priority: P1) 🎯 MVP

**Goal**: After login, an instructor is routed to `/instructor` (not the student dashboard); a newly-registered instructor gets the same on first login.

**Independent Test**: Log in as an instructor → lands on `/instructor`. Log in as a student → still lands on `/dashboard`.

### Implementation for User Story 1

- [X] T008 [US1] Create `front-end/src/app/instructor/layout.tsx` mirroring `front-end/src/app/dashboard/(main)/layout.tsx` (font-manrope, `bg-lightbg` flex, scrollable `<main>`); leave a slot for the sidebar (mounted in US3)
- [X] T009 [US1] Create `front-end/src/app/instructor/page.tsx` — the foundational instructor landing (welcome / getting-started placeholder per FR-013), typed and using house Tailwind tokens
- [X] T010 [P] [US1] Create `front-end/src/app/instructor/loading.tsx` route-level loader mirroring the student `loading.tsx` pattern
- [X] T011 [US1] Update `front-end/src/featuers/auth/components/LoginForm.tsx` success handler to redirect via `readRoutingRole()` (instructor → `/instructor`, admin → `/instructor/admin-unavailable`, else existing student target)
- [X] T012 [P] [US1] Update `front-end/src/featuers/auth/components/GoogleLoginButton.tsx` success redirect to be role-aware via `readRoutingRole()`
- [X] T013 [P] [US1] Update `front-end/src/featuers/auth/components/RegisterOTPComponent.tsx` post-verify redirect to be role-aware, so a first-login instructor lands on `/instructor`

**Checkpoint**: Instructors land on `/instructor`; students unaffected. (Full shell chrome arrives in US3; the proxy backstop for stray links arrives in US2.)

---

## Phase 4: User Story 2 - Roles cannot cross over (Priority: P1)

**Goal**: Students are redirected away from instructor routes, instructors off student routes (except the course-player), unauthenticated → login, and admins → the admin notice — with no wrong-role content shown. Backend remains the real gate.

**Independent Test**: As a student, open `/instructor` (and a deep link) → redirect to `/dashboard`, no instructor content. Signed out → `/login`. As admin → notice. (See `quickstart.md` §D.)

### Implementation for User Story 2

- [X] T014 [US2] Extend `front-end/src/proxy.ts`: add `/instructor` to protected routes; read the `role` cookie; implement the three-way decision table rows 1–7 from `contracts/routing-contract.md`, including the `COURSE_PLAYER_PREFIX = "/dashboard/learn"` allow-list for instructors and the least-privilege default (unknown role ⇒ student)
- [X] T015 [US2] In `front-end/src/proxy.ts`, make the existing "authenticated user hits `/login`/`/register`" redirect role-aware (row 8: instructor → `/instructor`, admin → notice, else `/dashboard`), preserving the existing forget-password / google-set-password / verify-otp flows unchanged
- [X] T016 [P] [US2] Create `front-end/src/app/admin-unavailable/page.tsx` — a clear "admin experience not yet available" notice at a **top-level** route (deliberately NOT under `/instructor` or `/dashboard`, so it renders with no role shell and never triggers the protected-route guard → no redirect loop)

**Checkpoint**: All cross-role access is guarded server-side before render; backend `isInstructor` still enforces data access (verify via quickstart §D7).

---

## Phase 5: User Story 3 - Instructor navigation shell (Priority: P2)

**Goal**: The instructor shell shows the full planned sidebar with active-state/collapse/mobile parity, placeholders for not-yet-built destinations, and working sign-out.

**Independent Test**: In the shell, the sidebar shows all 7 items; each is one-click reachable with active highlighting; unbuilt destinations show a placeholder; narrow viewport collapses the sidebar. (See `quickstart.md` §E.)

### Implementation for User Story 3

- [X] T017 [P] [US3] Create `front-end/src/components/organisms/InstructorSidebar.tsx` as a sibling of `SideBar.tsx` with the instructor nav set (Dashboard `/instructor`, My Courses `/instructor/courses`, Students `/instructor/students`, Analytics `/instructor/analytics`, Reviews `/instructor/reviews`, Earnings `/instructor/earnings`, Settings `/instructor/settings`), reusing `DashboardAvater`, `DashboardLogout`, `LogoWithText`, lucide icons, and the existing active-item / collapse / mobile-overlay behavior
- [X] T018 [US3] Mount `<InstructorSidebar/>` into `front-end/src/app/instructor/layout.tsx` (edits the US1 layout to render sidebar + scrollable main, matching the student shell)
- [X] T019 [P] [US3] Create a shared placeholder component `front-end/src/components/molecules/ComingSoon.tsx` (empty-state style, reuses atoms + house tokens) with a short "coming soon" message and optional feature label
- [X] T020 [P] [US3] Create `front-end/src/app/instructor/courses/page.tsx` rendering `ComingSoon` (real UI in spec 004)
- [X] T021 [P] [US3] Create `front-end/src/app/instructor/students/page.tsx` rendering `ComingSoon` (spec 010)
- [X] T022 [P] [US3] Create `front-end/src/app/instructor/analytics/page.tsx` rendering `ComingSoon` (spec 009)
- [X] T023 [P] [US3] Create `front-end/src/app/instructor/reviews/page.tsx` rendering `ComingSoon` (spec 012)
- [X] T024 [P] [US3] Create `front-end/src/app/instructor/earnings/page.tsx` rendering `ComingSoon` (spec 013)
- [X] T025 [P] [US3] Create `front-end/src/app/instructor/settings/page.tsx` rendering `ComingSoon` (spec 011)
- [X] T026 [US3] Verify sign-out from `InstructorSidebar` (via `DashboardLogout`) calls the logout API (clears the `role` cookie per T004) and re-routes to `/login`; adjust the shared logout target only if it breaks instructor-side sign-out

**Checkpoint**: The instructor shell is complete and coherent; all three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] Run the `quickstart.md` walkthrough (A–E) against the running dev servers; capture proof of instructor landing, student→redirect, and admin notice
- [X] T028 [P] Ensure `tsc` (strict) and ESLint pass for all new/edited frontend files; zero console errors on the instructor shell
- [X] T029 Confirm SC-003 (no wrong-role flash on slow load — redirect happens in middleware) and SC-004/FR-007 (instructor API rejects a student even with a forged `role` cookie — quickstart §D7), and that the instructor course-player allow-list works (§D4)
- [X] T030 [P] Note the new documented patterns (non-HttpOnly `role` cookie + `app/(instructor)` route group) in `specs/_conventions.md` if they should be codified for later instructor specs

---

## Dependencies & Execution Order

### Phase dependencies
- **Setup (P1)** → no dependencies.
- **Foundational (P2)** → depends on Setup; **blocks all user stories** (the `role` cookie + reader).
- **US1 (P3)** → depends on Foundational; establishes the `(instructor)` route group + role-aware landing.
- **US2 (P4)** → depends on Foundational; its proxy logic is independent, but its redirect *targets* (`/instructor`, admin notice) are scaffolded by US1/T016 — sequence US1 (or at least T008/T009) before validating US2 end-to-end.
- **US3 (P5)** → depends on Foundational **and** US1's layout (T018 edits `(instructor)/layout.tsx` from T008).
- **Polish (P6)** → after the desired stories are complete.

### User story dependencies
- **US1 (P1)**: Foundational only.
- **US2 (P1)**: Foundational only for its logic; full manual test needs US1's routes + T016's notice page.
- **US3 (P2)**: Foundational + US1 (extends the layout).

### Within each story
- Backend cookie (T003–T005) before its test (T006).
- Layout (T008) before mounting the sidebar (T018).
- `ComingSoon` (T019) before the placeholder pages (T020–T025).
- `proxy.ts` guard (T014) before the public-redirect edit (T015) — same file, sequential.

---

## Parallel Opportunities

- **Setup**: T001, T002 together.
- **Foundational**: T006 and T007 run in parallel (different files); T003→T004→T005 are the same file `utils.py`/`views.py`, keep sequential for T003/T004.
- **US1**: T010, T012, T013 in parallel (different files) after T008/T009; T011 edits LoginForm (own file).
- **US3**: T017 and T019 in parallel; then all placeholder pages T020–T025 in parallel (distinct files). T018 must wait for T017.

### Parallel example — US3 placeholder pages
```bash
Task: "Create front-end/src/app/instructor/courses/page.tsx rendering ComingSoon"
Task: "Create front-end/src/app/instructor/students/page.tsx rendering ComingSoon"
Task: "Create front-end/src/app/instructor/analytics/page.tsx rendering ComingSoon"
Task: "Create front-end/src/app/instructor/reviews/page.tsx rendering ComingSoon"
Task: "Create front-end/src/app/instructor/earnings/page.tsx rendering ComingSoon"
Task: "Create front-end/src/app/instructor/settings/page.tsx rendering ComingSoon"
```

---

## Implementation Strategy

### MVP first (US1 + US2 — both P1)
1. Phase 1 Setup → Phase 2 Foundational (role cookie + reader).
2. US1: role-aware landing + `(instructor)` scaffold.
3. US2: proxy three-way guard + admin notice.
4. **STOP and VALIDATE**: instructor lands on `/instructor`; students/admins/unauth are correctly routed; backend still gates data. This is a shippable MVP that closes the routing gap.

### Incremental delivery
- MVP (US1+US2) → demo role-aware routing.
- Add US3 → full sidebar shell with placeholders → demo the instructor home.
- Later specs (004–013) fill each placeholder destination.

---

## Notes
- `[P]` = different files, no incomplete dependencies.
- JWT cookies stay HttpOnly and untouched; the `role` cookie is a non-secret UI hint (Constitution III).
- No new backend model or migration.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
