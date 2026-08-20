# Contract: Edge Routing Decision Table (`proxy.ts`)

Defines the deterministic behavior of the role-aware guard. Auth presence is evaluated **first**, then
the role branch. `authed` = `access_token` OR `refresh_token` present. `role` = `role` cookie value
(missing/unknown ⇒ `student`).

## Constants
- `INSTRUCTOR_ROOT = "/instructor"`
- `STUDENT_ROOT = "/dashboard"`
- `ADMIN_NOTICE = "/admin-unavailable"` (standalone top-level route — NOT under `/instructor` or `/dashboard`, so it renders with no shell and never re-enters the guard)
- `COURSE_PLAYER_PREFIX = "/dashboard/learn"` — the shared full-screen player, **allow-listed for instructors**
- Protected prefixes: `/dashboard`, `/instructor`

## Decision table

| # | authed | role | Requested path | Result |
|---|--------|------|----------------|--------|
| 1 | no | — | any protected (`/dashboard/*`, `/instructor/*`) | redirect `/login` |
| 2 | yes | student | `/instructor/*` | redirect `STUDENT_ROOT` |
| 3 | yes | student | `/dashboard/*` | allow |
| 4 | yes | instructor | `/instructor/*` | allow |
| 5 | yes | instructor | `/dashboard/learn/*` (course player) | allow (allow-list) |
| 6 | yes | instructor | `/dashboard/*` (any other) | redirect `INSTRUCTOR_ROOT` |
| 7 | yes | admin | `/instructor/*` or `/dashboard/*` (except the notice route itself) | redirect `ADMIN_NOTICE` |
| 8 | yes | any | `/login` or `/register` | redirect to role home (instructor→`/instructor`, admin→`ADMIN_NOTICE`, else `/dashboard`) |
| 9 | — | — | non-protected, non-auth pages (e.g. `/`, `/courses`) | allow (unchanged) |

**Ordering rules**:
- Row 1 (auth check) precedes all role rows.
- The admin-notice route must be reachable by an admin (exclude it from row 7's redirect target to avoid a loop).
- Existing flows already in `proxy.ts` (forget-password, google-set-password, verify-otp) are preserved
  unchanged; the role branch is added to the "Protected Routes" and "Public Routes" sections.

## Invariants (map to Success Criteria)
- No wrong-role shell renders before a redirect resolves (SC-003) — decisions happen in middleware,
  before the route component runs.
- Every student attempt at `/instructor/*` redirects with zero instructor content (SC-002, row 2).
- Every admin sign-in/navigation resolves to the notice (SC-008, rows 7–8).
- The guard is a usability layer; backend `isInstructor` remains the authority (defense in depth).

## Acceptance mapping
| Spec item | Rows |
|-----------|------|
| FR-001 (role landing) | 8 |
| FR-003 (student blocked from instructor) | 2 |
| FR-004 (instructor off student routes, player excepted) | 5, 6 |
| FR-004a (admin notice) | 7, 8 |
| FR-005 (unauth → login) | 1 |
