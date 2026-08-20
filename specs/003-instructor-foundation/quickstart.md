# Quickstart: Verifying Instructor Foundation

Manual verification walkthrough for the role-aware routing + instructor shell. No automated E2E harness
exists; use the running dev servers and the browser preview. Backend cookie behavior additionally has a
unit test in `authentication/tests.py`.

## Prerequisites
- Backend and frontend dev servers running.
- Three test accounts: a **student**, an **instructor** (registered via the Instructor toggle → has
  `InstructorProfile` + `is_staff`), and an **admin** (`is_superuser`).

## A. Backend: the `role` cookie
1. Log in as each account (via the API or UI).
2. Inspect the `Set-Cookie` headers / browser cookies. Expect a **`role`** cookie:
   - student → `student`, instructor → `instructor`, admin → `admin`.
   - Flags: `HttpOnly` **absent**, `SameSite=Lax`, `Path=/`, ~7-day expiry, `Secure` in prod.
3. Log out. Expect the `role` cookie deleted alongside the JWT cookies.
4. Run the backend test: it asserts the cookie is set on login/verify with the right value and cleared on logout.

## B. Instructor landing (US1 / FR-001)
1. Log in as the **instructor**.
2. Expect to land on `/instructor` showing the instructor shell (sidebar + workspace) — **not** the student dashboard.
3. Repeat with a freshly-registered instructor (register → verify OTP → first login): same landing.

## C. Student unaffected (US1 / FR-001)
1. Log in as the **student** → lands on `/dashboard` exactly as before.

## D. Role guarding (US2)
| Step | Action | Expected |
|------|--------|----------|
| D1 | Student opens `/instructor` (and a deep link like `/instructor/courses`) | Redirect to `/dashboard`; no instructor content flashes |
| D2 | Instructor opens `/dashboard` (home) | Redirect to `/instructor` |
| D3 | Instructor opens `/dashboard/my-courses` | Redirect to `/instructor` |
| D4 | Instructor opens `/dashboard/learn/<id>` (course player) | **Allowed** (allow-listed) |
| D5 | Signed-out user opens `/instructor` or `/dashboard` | Redirect to `/login` |
| D6 | Admin signs in / opens `/instructor` or `/dashboard` | Redirect to the admin "not yet available" notice; neither shell renders |
| D7 | Edit the `role` cookie to `instructor` as a student, open an instructor page that calls an instructor API | UI may route, but the API returns an authorization error — no instructor data shown |

## E. Instructor shell (US3)
1. In the instructor shell, confirm the sidebar shows: Dashboard, My Courses, Students, Analytics, Reviews, Earnings, Settings.
2. Click each item → navigates in one action; the active item is highlighted.
3. Open a not-yet-built destination (e.g., Analytics) → a clear "coming soon" placeholder, not an error/blank.
4. Narrow the viewport → sidebar collapses like the student shell.
5. Sign out from the shell → session + `role` cookie cleared; logging back in as a different role routes correctly.

## Success signals (map to Success Criteria)
- B → cookie contract correct.
- B/C/D6 → SC-008 (admin never sees a shell).
- D1 → SC-002 (student never reaches instructor content).
- D1/D6 + slow-load check → SC-003 (no wrong-role flash — redirect is server-side in middleware).
- D7 → FR-007 (backend is the real gate).
- E → SC-005 (one-click nav, active indicator).
