# Feature Specification: Instructor Foundation — Role-Aware Routing & Instructor Shell

**Feature Branch**: `003-instructor-foundation`
**Created**: 2026-08-19
**Status**: Draft
**Input**: User description: "read planning/instructor-experience-discovery.md — the first spec for the instructor experience (003-instructor-foundation): role-aware routing + instructor shell."

## Overview

Today the platform delivers a complete **student** experience but has **no instructor frontend at all**.
The instructor CRUD backend already exists, yet an instructor who logs in lands on the *student*
dashboard, because nothing in the app branches on a user's role. This feature builds the **foundation**
that every later instructor feature depends on: a **role-aware routing layer** and a **dedicated
instructor shell** (its own layout, sidebar, and navigation) living in a separate top-level instructor
route group that mirrors — but does not share — the student dashboard shell.

Concretely, this feature makes three things true:

1. **The right person lands in the right place.** An instructor is routed to the instructor home after
   login; a student is routed to the student dashboard.
2. **Roles cannot cross over.** A student can never reach an instructor page, an instructor is sent to
   their own home instead of the student dashboard, and unauthenticated visitors are sent to login —
   with no wrong-role content ever flashing on screen, and the backend remaining the real gate.
3. **The instructor has a home to grow into.** The instructor shell presents the full planned
   navigation (Dashboard, My Courses, Students, Analytics, Reviews, Earnings, Settings) around a
   scrollable workspace, matching the look and behaviour of the student shell.

This is intentionally a **thin, structural** feature. The destinations behind the sidebar (course
management, analytics, earnings, etc.) are delivered by **later specs (004–013)**; here they are wired
into the shell as placeholders. No new backend data models are introduced, and the existing access
model (`isInstructor` = staff, self-serve instructor provisioning at registration) is reused unchanged.

## Clarifications

### Session 2026-08-19

- Q: What is the guard scope for an instructor hitting student `/dashboard/*` routes? → A: Redirect instructors away from **all** student `/dashboard/*` pages (including the progress / my-courses surface), **except** the shared full-screen course-player route, which stays reachable so a later spec can build the owned-content preview on it without changing the guard. Note: student pages only ever show the signed-in user's own data, so this is about clean role separation, not cross-user leakage.
- Q: Which signal drives frontend routing, and where does an admin land at login? → A: Explicit **three-way** branch by role. Admins are identified by the **`is_superuser`** flag and are routed **out of both the student and instructor shells** to a clear "admin experience not yet available" notice (the full admin experience is a later track, to be built after the instructor experience is complete). Instructors (role `instructor`, staff but not superuser) → instructor home; everyone else → student dashboard.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instructor lands in their own workspace (Priority: P1)

An instructor-role user signs in (via the same login the platform already uses). Instead of the student
dashboard, they are taken to the **instructor home** and see the instructor shell — a sidebar with the
instructor navigation and a workspace area. A newly-provisioned instructor (who just registered choosing
the Instructor role) has the same experience on first login.

**Why this priority**: This is the core promise of the feature and the entry point for every future
instructor capability. Without it, an instructor has no way into any instructor page. It is the minimum
viable slice — even with every destination still a placeholder, an instructor now has a home.

**Independent Test**: Sign in as an instructor account and confirm the browser lands on the instructor
home showing the instructor shell (not the student dashboard). Sign in as a student account and confirm
they land on the student dashboard as before.

**Acceptance Scenarios**:

1. **Given** an authenticated instructor-role user, **When** they complete login, **Then** they are
   taken to the instructor home and shown the instructor shell, not the student dashboard.
2. **Given** a user who just registered choosing the Instructor role and verified their account,
   **When** they sign in for the first time, **Then** they are recognised as an instructor and routed to
   the instructor home.
3. **Given** an authenticated student-role user, **When** they complete login, **Then** they land on the
   existing student dashboard exactly as they do today.

---

### User Story 2 - Roles cannot cross over (Priority: P1)

Access to each role's area is enforced. A student who tries to open any instructor URL (including a
deep-linked or guessed one) is redirected to the student dashboard. An instructor who opens the student
dashboard home is redirected to the instructor home. Anyone not signed in who opens a protected page is
sent to login. At no point does a user see content that belongs to a role they do not have, and the
backend independently rejects instructor API requests from non-instructors.

**Why this priority**: This is a security and integrity requirement, not a convenience. If it fails, one
instructor's forthcoming private data (students, earnings, analytics) could be exposed to the wrong
person, or a student could reach an authoring surface. It must ship together with the landing behaviour.

**Independent Test**: While signed in as a student, navigate directly to an instructor URL and confirm
an immediate redirect to the student dashboard with no instructor content rendered. While signed out,
open a protected URL and confirm redirection to login. Confirm an instructor API call made by a
non-instructor is rejected by the backend.

**Acceptance Scenarios**:

1. **Given** a signed-in student, **When** they navigate to any instructor route (including a deep link
   such as an instructor course URL), **Then** they are redirected to the student dashboard and no
   instructor content is shown at any moment.
2. **Given** a signed-in instructor, **When** they navigate to any student dashboard route (other than
   the shared course-player), **Then** they are redirected to the instructor home.
3. **Given** an unauthenticated visitor, **When** they open any protected route (instructor or student),
   **Then** they are redirected to login.
3a. **Given** a signed-in admin (superuser), **When** they sign in or open any student or instructor
   route, **Then** they are routed to the admin "not yet available" notice and neither role shell is
   rendered.
4. **Given** any non-instructor (student or unauthenticated) request to an instructor backend endpoint,
   **When** the request is processed, **Then** the backend rejects it with an authorization error,
   independent of any frontend routing.
5. **Given** a user whose client-side role signal is missing, stale, or tampered with, **When** they
   attempt to reach instructor data, **Then** access is still governed by the backend and no instructor
   data is returned to a non-instructor.

---

### User Story 3 - Instructor navigation shell (Priority: P2)

Inside the instructor area, the instructor sees a persistent sidebar listing the full planned navigation
— Dashboard, My Courses, Students, Analytics, Reviews, Earnings, and Settings — around a scrollable main
workspace, visually and behaviourally consistent with the student dashboard shell (active-item
highlighting, responsive collapse, sign-out). Destinations whose features are not yet built render a
clear placeholder rather than an error, so the shell is complete and coherent from day one.

**Why this priority**: The shell is what makes the foundation usable and gives later specs a stable place
to slot into, but the platform still delivers value with just the landing and guarding in place, so this
ranks below them.

**Independent Test**: As a signed-in instructor, confirm the sidebar shows the full navigation set, that
the current section is highlighted, that each item is reachable in one click, and that not-yet-built
destinations show a placeholder instead of breaking.

**Acceptance Scenarios**:

1. **Given** an instructor in the instructor shell, **When** the shell loads, **Then** the sidebar shows
   all planned top-level items (Dashboard, My Courses, Students, Analytics, Reviews, Earnings, Settings).
2. **Given** the instructor sidebar, **When** the instructor selects any item, **Then** the workspace
   navigates to that destination and the selected item is visually marked active.
3. **Given** a destination whose feature is not yet implemented, **When** the instructor opens it,
   **Then** a clear placeholder/"coming soon" state is shown rather than a crash or blank page.
4. **Given** the instructor shell on a narrow viewport, **When** it is displayed, **Then** the sidebar
   adapts (e.g., collapses) consistently with how the student shell behaves.
5. **Given** an instructor in the shell, **When** they sign out, **Then** the session and any role-routing
   signal are cleared so a subsequent login as a different role routes correctly.

---

### Edge Cases

- **Admin user (superuser).** An admin is identified by the superuser flag and is routed by the frontend
  to the admin notice state (FR-004a) — never into the instructor or student shell — both at login and
  on any manual navigation. The backend instructor gate still technically admits an admin's API calls
  (`isInstructor` = staff, and superusers are staff); this residual over-permissiveness is the accepted,
  flagged staff-vs-role looseness and is not resolved here.
- **Non-superuser staff who is not a role-instructor.** Such an account routes as a student (it is
  neither superuser nor role `instructor`), yet the backend staff gate would admit its instructor API
  calls. This is the same accepted looseness; the graceful "staff without instructor profile" handling
  (FR-008) prevents any crash if such an account reaches instructor data.
- **Staff account with no instructor profile.** A staff user who lacks an instructor profile must fail
  cleanly (a clear "no instructor profile" state or safe redirect), never a crash or server error.
- **Instructor who is also enrolled as a student.** The guard redirects instructors away from all
  student dashboard routes **except** the shared course-player route, which stays reachable so an owning
  instructor's future content-preview flow (designed in a later spec) is not hard-blocked. An instructor
  never lands on the student progress / my-courses surface, even for their own data.
- **Deep link / ID guessing.** A student opening a specific instructor sub-page by URL is redirected the
  same as opening the instructor root — no instructor content renders, and no owned-resource data is
  fetched for them.
- **Role changes mid-session.** If a user's role changes while signed in, routing must converge on the
  correct area on the next navigation or refresh without exposing the wrong shell.
- **Wrong-role flash.** Under slow loads, the correct-role or a neutral loading state must be shown; the
  wrong-role shell must never paint, even briefly, before a redirect resolves.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After successful authentication, the system MUST route a user by an explicit three-way
  role branch: an **admin** (identified by the superuser flag) to the admin notice state defined in
  FR-004a; an **instructor** to the instructor home; **any other** authenticated user (student) to the
  existing student dashboard.
- **FR-004a**: An **admin** user (superuser) MUST NOT be placed in either the student or the instructor
  shell. The system MUST route them to a clear notice state indicating the admin experience is not yet
  available. This applies both at login and to any manual attempt to open a student or instructor route.
  (The full admin experience is a later track, planned after the instructor experience is complete.)
- **FR-002**: The system MUST reliably determine a user's role at routing time using the existing
  authentication/profile mechanism, without exposing or requiring client-side access to sensitive
  session tokens.
- **FR-003**: The system MUST treat all instructor routes as protected and redirect any student who
  attempts to access them to the student dashboard, with no instructor content rendered at any point.
- **FR-004**: The system MUST redirect an authenticated instructor away from **all** student dashboard
  routes to the instructor home, with a single exception: the shared full-screen course-player route,
  which MUST remain reachable so a later spec can build the owning-instructor content preview on it
  without changing the routing guard. (Student pages only ever expose the signed-in user's own data, so
  this rule enforces clean role separation, not cross-user protection — which the backend already
  provides.)
- **FR-005**: The system MUST redirect any unauthenticated visitor who requests a protected route
  (instructor or student) to the login page.
- **FR-006**: The system MUST ensure that during routing decisions no wrong-role content is displayed —
  a neutral or loading state is acceptable, the wrong-role shell is not.
- **FR-007**: The backend MUST continue to authorize every instructor endpoint by role independently of
  frontend routing, rejecting requests from non-instructors (defense in depth); frontend routing is a
  usability layer, not the security boundary.
- **FR-008**: A staff/instructor account that lacks an associated instructor profile MUST be handled
  gracefully (clear message or safe redirect) rather than producing an error or crash.
- **FR-009**: The instructor area MUST render within a dedicated instructor shell — a persistent sidebar
  plus a scrollable workspace — that mirrors the structure and interaction patterns of the student
  dashboard shell without sharing its student-specific navigation.
- **FR-010**: The instructor sidebar MUST present the full planned top-level navigation set: Dashboard,
  My Courses, Students, Analytics, Reviews, Earnings, and Settings.
- **FR-011**: The instructor shell MUST indicate the currently active navigation section and allow every
  top-level destination to be reached in a single action from the sidebar.
- **FR-012**: Navigation destinations whose features are delivered by later specs MUST render a clear
  placeholder state rather than an error or blank page, so the shell is coherent from first release.
- **FR-013**: The instructor home MUST render a foundational landing state (e.g., a welcome/getting-
  started placeholder) suitable to be replaced by the full dashboard in a later spec.
- **FR-014**: Signing out from the instructor shell MUST clear the session and any role-routing signal so
  a subsequent login (including as a different role) routes to the correct area.
- **FR-015**: This feature MUST NOT introduce a new role data model or change how instructor access is
  provisioned; it reuses the existing roles and the existing self-serve instructor provisioning at
  registration.

### Key Entities *(include if feature involves data)*

- **User (existing)**: The authenticated account. Carries a role of student, instructor, or admin, the
  staff attribute the current instructor gate relies on, and the superuser flag used to identify admins
  for routing. No new fields are added by this feature.
- **Instructor profile (existing)**: The record that marks a user as an authoring instructor and anchors
  ownership of their content. Its presence is what a graceful "instructor without profile" check keys on.
- **Role-routing signal (conceptual)**: The non-sensitive indication of a user's role that the routing
  layer reads to decide the correct area (distinguishing admin/superuser, instructor, and student for
  the FR-001 three-way branch), without decoding sensitive tokens. Its concrete form is an implementation
  decision for the planning phase; it must never carry authentication secrets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of instructor logins land on the instructor home; 0% land on the student dashboard.
- **SC-002**: 100% of student attempts to reach any instructor route (including deep links) are
  redirected away, with instructor content rendered 0 times.
- **SC-003**: The wrong-role shell is painted 0 times across role-mismatch and slow-load scenarios (no
  visible wrong-role flash before a redirect resolves).
- **SC-004**: 100% of instructor backend endpoints reject non-instructor requests, verified independently
  of the frontend.
- **SC-005**: An instructor can reach every top-level sidebar destination in exactly one action, and the
  active section is always correctly indicated.
- **SC-006**: Routing and redirect decisions resolve before any protected content is shown — an
  instructor perceives login-to-home as immediate, with no intermediate student screen.
- **SC-007**: A staff account without an instructor profile produces a clear handled state in 100% of
  cases, with 0 crashes or server errors.
- **SC-008**: 100% of admin (superuser) sign-ins and manual navigations resolve to the admin notice
  state; the instructor and student shells are rendered to an admin 0 times.

## Assumptions

- **Confirmed constraints (from the discovery document).** The instructor UI lives in a **separate
  top-level instructor route group** with its own layout and sidebar, mirroring but not sharing the
  student dashboard shell; and the existing **access model is kept** — instructor access equals the
  existing staff-based gate, provisioned self-serve when a user registers choosing the Instructor role.
- **Role at the routing edge.** The routing layer needs to know a user's role at decision time even
  though the session token is not readable by the client. The *mechanism* (e.g., a small non-sensitive
  role indicator vs. a server-side role check) is deliberately left to the planning phase; the spec only
  requires the outcomes in FR-002 and FR-006. Whatever is chosen must never move authentication secrets
  out of their secure storage.
- **Staff-vs-role gap is accepted for now.** Because the current gate equates instructor with staff, a
  staff/admin account can pass the instructor gate. This is a known, accepted looseness for this feature
  (flagged as a risk in the discovery document) and is not resolved here.
- **Placeholders for later specs.** Sidebar destinations (course management, curriculum, analytics,
  students, reviews, earnings, profile) are represented as placeholders; their real behaviour is out of
  scope and delivered by specs 004–013.
- **Existing infrastructure is reused.** The existing login/registration/verification flows, profile
  fetching, the shared component library and design tokens, and the student dashboard shell pattern are
  reused; no new backend models, background jobs, or real-time infrastructure are introduced.
- **Admins are branched out, full admin experience deferred.** Admin users (superusers) are explicitly
  routed to a "not yet available" notice rather than into any role shell; the complete admin experience
  is a separate later track, planned to begin **after** the instructor experience is finished. Until
  then admins continue to use the existing Django admin surfaces.

## Dependencies

- The existing authentication system (login, registration with the Student/Instructor toggle, account
  verification, profile retrieval) and the existing instructor provisioning path.
- The existing student dashboard shell and shared component library, reused as the visual/interaction
  pattern for the instructor shell.
- The existing instructor backend endpoints, which already enforce role authorization and provide the
  defense-in-depth guarantee this feature relies on.

## Out of Scope

- Course creation/editing, curriculum building, video upload, and publishing (later specs).
- Instructor dashboard data, analytics, student rosters, reviews feed, and earnings (later specs).
- Instructor public-profile editing (later spec).
- Any change to the student experience beyond redirecting instructors away from the student dashboard
  routes (excluding the shared course-player).
- The full **admin experience** — this feature only branches admins to a "not yet available" notice; the
  admin experience is a separate later track.
- Resolving the staff-vs-role semantic gap or introducing content versioning, soft-delete, background
  jobs, or real-time updates.
