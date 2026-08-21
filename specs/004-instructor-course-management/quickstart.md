# Quickstart: Verify Instructor Course Management (004)

Manual walkthrough to confirm the feature end-to-end. Assumes 003 (instructor shell/routing) is in place
and you can sign in as an instructor account with an `InstructorProfile`.

## Prerequisites

- Backend running (Django) and frontend running (`npm run dev` under `front-end/`).
- An instructor account (role `instructor`, staff, has an `InstructorProfile`).
- A second instructor account (to verify ownership isolation).
- A small image file for the thumbnail.

## Backend accommodation is applied

- `Course.thumbnail` is now a `URLField` and the **new migration** is applied
  (`python manage.py migrate`). Existing course data reseeded in dev (thumbnail URLs valid).
- `InstructorCourseSerializer` exists and is used by `InstructorCourseViewSet` (server fields read-only,
  thumbnail optional URL string).
- Thumbnail uploads reuse `GET /auth/user/getCloudinarySignature/` (no new signature endpoint).
- Run backend tests: `python manage.py test apps.course` — the instructor-course create/ownership tests pass.

## Happy path

1. **Land + navigate**: Sign in as the instructor → you land on `/instructor` (003). Click **My Courses**.
   - New instructor: see the empty state with a single **Create your first course** CTA (FR-004).
2. **Create** → click **New course** (`/instructor/courses/new`). Submit empty → inline field errors
   block the save (FR-006, SC-003). Fill title, description, price (try `0` — allowed), category, level;
   add two **learning goal** rows; optionally pick a thumbnail (it uploads direct-to-Cloudinary on save,
   and only the URL is stored). **Save draft**.
   - You are redirected to `/instructor/courses/{id}` (workspace Overview) (FR-007).
   - The course shows a **Draft** badge (read-only) (FR-013).
3. **Browse**: Go back to **My Courses** → the new course appears with a **Draft** badge and Edit/Manage
   actions (FR-002). Toggle **Draft / Published / All** filters and type in **search** — the grid narrows
   client-side (FR-003).
4. **Edit** → open **Edit** (`/instructor/courses/{id}/edit`). Change the title and price, replace the
   thumbnail, add another goal, **Save**. Reload → changes persisted across My Courses and Overview
   (FR-008, SC-005). Omit the thumbnail on a later edit → existing image is kept.
5. **Workspace tabs**: In the workspace, click **Curriculum / Analytics / Students / Reviews** → each
   shows a **coming soon** placeholder, not an error (FR-012). Overview shows thumbnail, title, status,
   and key metadata with an **Edit** link (FR-011).
6. **Delete** → from a card or the workspace, choose **Delete**.
   - Course with **no** enrollments → light confirm → confirm → it disappears from My Courses (FR-015).
   - Course with enrolled students (`subscribers_count > 0`) → the confirm **explicitly warns** the
     course/content are permanently removed and students lose access (FR-014, SC-006). Cancel → nothing
     changes.

## Ownership & safety

7. **Not-owner by ID**: As the instructor, note another instructor's course id. Visit
   `/instructor/courses/{otherId}` and `/instructor/courses/{otherId}/edit` → refused / not-found state,
   no course data shown (FR-010, SC-004). Confirm the backend returns **404** for retrieve/patch/delete on
   a non-owned id.
8. **Draft leak**: Confirm the draft does **not** appear in the student catalog (`/courses`) or any
   public listing (FR-018, SC-008).
9. **States**: Throttle the network → the list shows a **skeleton**, then content; force an error →
   a retry-able error state (not blank) (FR-016, SC-007).

## Done when

- Create → workspace in under ~2 minutes (SC-002); all filters/search work; edit persists; delete is
  guarded and enrollment-aware; non-owned ids are refused; drafts never leak; every surface has
  loading/empty/error states.
