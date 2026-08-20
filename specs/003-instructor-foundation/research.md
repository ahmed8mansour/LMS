# Phase 0 Research: Instructor Foundation

All spec-level `[NEEDS CLARIFICATION]` were resolved during `/speckit.clarify` (guard scope → course-player
allow-list; routing signal → explicit three-way with admin via `is_superuser`). The remaining open item
the spec deferred to planning is the **role-at-the-edge mechanism**. This document resolves it and the
supporting design choices against the actual codebase.

---

## R1. How does the edge learn a user's role without decoding the HttpOnly JWT?

**Decision**: Emit a **non-HttpOnly, non-sensitive `role` cookie** from the backend, set in the single
shared `set_jwt_cookies(response, user)` helper (`backend/apps/authentication/utils.py`) and deleted in
`clear_jwt_cookies(response)`. Its value is a server-computed **routing role**:

```
routing_role = "admin"      if user.is_superuser
             else "instructor" if user.role == "instructor"
             else "student"
```

`src/proxy.ts` reads `req.cookies.get("role")` and branches; the client reads the same cookie via a small
`readRoutingRole()` helper for immediate post-login redirect and shell decisions.

**Rationale**:
- `set_jwt_cookies` is already the **one** place all six authenticated entry points converge (login, OTP
  verify, Google register, Google login, Google set-password, token refresh — verified via grep). One edit
  covers every path; `clear_jwt_cookies` (logout) is the one place to remove it.
- Next.js middleware (`proxy.ts`) runs at the edge and **cannot** read HttpOnly cookies' contents to
  decode a JWT, and must not (Constitution III keeps the JWT opaque to the client). A separate readable
  cookie is the standard pattern for edge role hints.
- The value is not a secret and grants nothing: every instructor endpoint independently enforces
  `isInstructor`, so tampering with the cookie changes only which shell the browser shows, never data
  access (satisfies FR-002, FR-007, and the §15.4 security note).
- Honors the clarified admin rule: `is_superuser` is checked first, so a superuser routes to the admin
  notice even if their `role` field says something else. (Note: the profile serializer **excludes**
  `is_staff`/`is_superuser`, so the client cannot derive admin-ness from `useProfile()` — the cookie is
  the correct carrier.)

**Alternatives considered**:
- *Decode JWT at the edge*: rejected — requires exposing/duplicating signing secrets to middleware and/or
  making the token readable, violating the HttpOnly rule.
- *Server-component/layout-only role check (no cookie)*: rejected as the primary mechanism — it cannot
  guard at the edge before a route renders, risking a wrong-role flash (SC-003) and pushing redirect
  latency past first paint (SC-006). It is retained as an optional secondary guard inside the
  `(instructor)` layout for defense in depth, not as the routing driver.
- *Encode role inside the access token and read a mirrored claim client-side*: rejected — still needs a
  readable copy, so it reduces to the cookie approach with extra coupling.

**Cookie flags**: `httponly=False`, `samesite="Lax"`, `secure` = same as `JWT_COOKIE_SETTINGS` (True in
prod), `path="/"`, lifetime aligned to the **refresh token** (7 days) so it outlives access-token refresh;
re-set on token refresh for safety. See `contracts/role-cookie.md`.

---

## R2. Where is the routing guard enforced, and how is the course-player allow-listed?

**Decision**: Enforce in `src/proxy.ts` (the existing Next 16 middleware, exported as `middleware`,
matcher already covers all app routes). Extend the current auth-only guard to:

1. Add `/instructor` to protected routes (redirect to `/login` when unauthenticated).
2. When authenticated, branch on the `role` cookie:
   - `admin` → redirect any `/instructor/*` or `/dashboard/*` request to the admin-unavailable notice.
   - `instructor` → redirect `/dashboard/*` **except** the shared course-player route to `/instructor`;
     allow `/instructor/*`.
   - `student` (default) → redirect `/instructor/*` to `/dashboard`; allow `/dashboard/*`.
3. Also make the "authenticated user hits `/login`/`/register`" redirect role-aware (instructor →
   `/instructor`, admin → notice, else `/dashboard`).

The **course-player allow-list** is a path predicate for the student player route (today
`/dashboard/learn/...`). Instructors keep access to it so a later spec can build owned-content preview on
the existing `can_access_lecture_video` grant, without reopening the guard.

**Rationale**: Centralizing in `proxy.ts` makes routing correct regardless of hardcoded `/dashboard`
links scattered in the UI (e.g., `UserAvater.tsx`), and runs before render so no wrong-role shell paints.
The allow-list is a single constant, easy to audit.

**Alternatives considered**: Per-layout client guards only — rejected as primary (flash + latency);
kept as optional secondary. Hardcoding redirects in each page — rejected (unmaintainable, leak-prone).

---

## R3. Post-authentication landing (so an instructor lands on `/instructor`)

**Decision**: Make the post-auth redirect role-aware. Today `LoginForm`/`GoogleLoginButton` redirect to
`/` and OTP-verify to a dashboard path. Update these success handlers to call `readRoutingRole()` and
route to `/instructor`, the admin notice, or `/dashboard`. As a safety net, `proxy.ts` (R2) corrects any
stale hardcoded target, so even an un-updated path converges on the right shell.

**Rationale**: Satisfies US1/FR-001 directly and avoids relying solely on a corrective redirect (smoother
UX, fewer hops). The proxy remains the backstop.

**Alternatives considered**: Rely only on the proxy correction — works but adds a visible extra redirect
hop on first login; acceptable fallback, not the primary path.

---

## R4. Instructor shell composition (mirror, not share)

**Decision**: New `app/(instructor)/layout.tsx` mirrors `app/dashboard/(main)/layout.tsx` (same
`bg-lightbg` flex + scrollable `<main>`), rendering a **new** `components/organisms/InstructorSidebar.tsx`
— a sibling copy of `SideBar.tsx` with the instructor nav set (Dashboard, My Courses, Students, Analytics,
Reviews, Earnings, Settings), reusing `DashboardAvater`/`DashboardLogout`, `LogoWithText`, lucide icons,
and the existing active-item/collapse/mobile behavior. Not-yet-built destinations render a shared
"coming soon" placeholder; `/instructor` renders a foundational welcome/getting-started placeholder.

**Rationale**: The product-confirmed constraint requires a separate route group and a sibling sidebar
(not a role branch inside `SideBar.tsx`). Mirroring preserves visual/interaction parity (Constitution II)
and gives specs 004–013 stable slots.

**Alternatives considered**: Parameterize `SideBar.tsx` by role — rejected per the confirmed constraint
and to avoid coupling the two shells.

---

## R5. Admin (superuser) handling

**Decision**: Admins are branched (via the `role` cookie value `admin`, derived from `is_superuser`) to a
clear "admin experience not yet available" notice route and never placed in either shell — at login and on
any manual navigation. The full admin experience is a separate later track (after the instructor track).

**Rationale**: Matches the clarified Q2→C decision and keeps this foundation minimal while leaving a clean
seam for the future admin work.

**Alternatives considered**: Route admins to `/dashboard` (rejected — they may lack a student profile and
it misrepresents their role) or into the instructor shell (rejected — semantically wrong).

---

## R6. Backend authorization — anything to change?

**Decision**: **No change** to backend permissions in this feature. `isInstructor` (= `is_staff`) and the
existing instructor viewsets already reject non-instructors; that is the security boundary this feature
leans on. The accepted `is_staff`-vs-`role` looseness is documented, not resolved here.

**Rationale**: Scope is routing + shell; the instructor read/write APIs are later specs. Adding gates now
would be premature.

---

## Summary of decisions

| # | Decision |
|---|----------|
| R1 | Non-HttpOnly `role` cookie set in `set_jwt_cookies` / cleared in `clear_jwt_cookies`; value = admin/instructor/student computed server-side |
| R2 | Role-aware three-way guard centralized in `proxy.ts`; course-player path allow-listed for instructors |
| R3 | Role-aware post-auth redirect (client), with proxy as backstop |
| R4 | New `(instructor)` route group + sibling `InstructorSidebar`; placeholders for later specs |
| R5 | Admin → dedicated "not yet available" notice; full admin experience deferred |
| R6 | No backend permission changes; existing `isInstructor` remains the security boundary |
