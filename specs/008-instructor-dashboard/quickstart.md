# Quickstart: Verifying the Instructor Dashboard

**Feature**: `008-instructor-dashboard` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/instructor-dashboard.md](./contracts/instructor-dashboard.md)

## Prerequisites

```bash
cd backend && env\Scripts\activate && python manage.py runserver
```

```bash
cd front-end && npm run dev
```

- Two instructor accounts (**A** and **B**) and at least two student accounts.
- Stripe CLI forwarding only if you want to create paid orders through checkout; otherwise use free courses
  plus the Django admin to set up paid/refunded orders.

## 1. Automated backend tests

```bash
cd backend && python manage.py test apps.course.tests_dashboard
```

Use the module label, not `apps.course` (no `__init__.py` under `backend/apps/`). Also re-run
`apps.course.tests_publishing` to confirm readiness is unaffected.

## 2. Frontend gates

```bash
cd front-end && npx tsc --noEmit
```

```bash
cd front-end && npm run lint
```

## 3. Manual walkthrough (browser)

### A. Onboarding (US-4)
1. Sign in as a **new instructor with no courses** → `/instructor` shows the onboarding checklist and
   "Create your first course"; **no tiles**.
2. Set the instructor profile's `title` and `about` (Django admin until spec 011) → reopen `/instructor` →
   the profile step is ticked.
3. Create a course → reopen `/instructor` → full dashboard; the draft is listed under Needs attention as
   **Draft in progress** with its blocker count.
4. Delete that course → `/instructor` shows the checklist again.

### B. Tiles (US-1)
1. As **A**, have: 2 published + 1 draft course; student S1 enrolled in two of A's courses; S2 enrolled via a
   free course; one paid order refunded (admin refund endpoint).
2. Open `/instructor` and check:
   - Courses: `3`, `2 published`.
   - Students: S1 counted once; secondary "N enrollments" counts S1 twice; the refunded student is absent.
   - Avg rating equals the rating on A's public instructor profile, or "Not yet rated".
   - Earnings: sum of paid orders only, formatted in full (e.g. `$8,940.00`).
3. Publish a course from its workspace, then click **Dashboard** in the sidebar → Courses tile updated with no
   manual reload.

### C. Needs attention (US-2)
Set up on A:
- a **published** course, then delete one lecture's video → **Live course needs attention**, top of list;
- a **draft** with one failed video → **Video failed**, link opens that lecture's editor;
- a **draft** passing readiness → **Ready to publish**;
- a **draft** with a lecture still **processing** and nothing else wrong → **Draft in progress**, never
  "Video failed".

Check: each course appears once; order matches Q2 (more students first among live items, fewer blockers first
among drafts); with more than 5 items the total is stated and "View all courses" goes to My Courses. Fix the
live course's video, return to Dashboard → item gone. With nothing to fix → "All caught up".

### D. Recent activity (US-3)
- Enroll S2 in another of A's courses → it tops Recent enrollments (name, avatar or initials, course, date).
- Leave a long review → Recent reviews shows stars, name, a clamped excerpt, course, date; no reply action.
- Clicking a course title opens that course's workspace.

### E. Access (US-5)
- As **B**, open `/instructor` → none of A's courses, students, reviews, or earnings appear.
- As a **student**, request `GET http://localhost:8000/courses/instructor/dashboard/` (browser with the
  student session) → `403`.
- Response body (browser dev tools → Network) contains no `email` key.

### F. States
- Throttle the network (dev tools "Slow 3G") → skeleton only; no zeros or empty messages flash.
- Stop the backend and reload `/instructor` → single page-level error with **Retry**; no zeros, no
  "All caught up". Start the backend, click Retry → dashboard loads.
- Narrow the viewport to 375px → single column in order: header, tiles, enrollments, reviews, needs
  attention; no horizontal scroll.
