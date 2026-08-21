# API Contract: Instructor Courses

Base: `/courses/instructor/courses/` — existing `InstructorCourseViewSet` (`ModelViewSet`).
Auth: `CookieJWTAuthentication` (HttpOnly cookies, `withCredentials`). Permissions: `IsAuthenticated`,
`isInstructor`. Every operation is **scoped to the caller's own courses** via `get_queryset`
(`instructor = request.user.instructor_profile`); a user without an instructor profile gets an empty set.

Response contract per `CLAUDE.md`: payloads are returned **directly** (object or list), errors as
`{ "error": "..." }` or DRF field errors `{ "field": ["..."] }`. **No `{data,status}` envelope.**

004 introduces `InstructorCourseSerializer` (server-managed fields read-only + defaulted on create) and
changes `Course.thumbnail` to a `URLField` so create/edit are **JSON** carrying a Cloudinary URL string.
No new CRUD endpoint, no route change, no student-facing shape change.

**Thumbnail pre-step (client)**: to set/replace a thumbnail, upload the file **direct-to-Cloudinary**
first via the existing generic signature endpoint `GET /auth/user/getCloudinarySignature/`
(auth required; returns `signature`, `timestamp`, `api_key`, `cloud_name`), POST the file to
`https://api.cloudinary.com/v1_1/{cloud_name}/image/upload`, and use the returned `secure_url` as the
`thumbnail` value in the JSON below. This endpoint is **reused as-is** — 004 adds no signature endpoint.

---

## GET `/courses/instructor/courses/` — list own courses

- **200** → array of course objects owned by the caller (both draft and published). No server-side
  filter/search/pagination (client-side per R3). Ordering `-created_at, id` (model default).
- Used by: My Courses grid.

## POST `/courses/instructor/courses/` — create draft

- **Request**: `application/json`
  - `title` (str, required), `description` (str, required), `price` (decimal ≥ 0, required),
    `category` (enum, required), `level` (enum, required)
  - `language` (str, optional), `goals_list` (`string[]`, optional),
    `thumbnail` (Cloudinary URL string, optional — from the pre-step above)
  - Server-managed fields (`is_published`, `rating`, `subscribers_count`, `reviews_count`, `instructor`)
    are **read-only** — ignored if sent.
- **201** → created course object with `is_published=false`, `rating=0`, counts `=0`, owned by caller.
- **400** → field errors `{ "field": ["..."] }` for invalid/missing required fields.
- Used by: Create Course form → then redirect to `/instructor/courses/{id}`.

## GET `/courses/instructor/courses/{id}/` — retrieve own course

- **200** → course object (incl. nested `sections`, `instructor_profile`) if owned.
- **404** → not owned or nonexistent (ownership gate; no data leak).
- Used by: Course workspace / Overview / Edit prefill.

## PATCH `/courses/instructor/courses/{id}/` — edit metadata / thumbnail

- **Request**: `application/json`, any subset of the create metadata fields; **omit `thumbnail`** to keep
  the existing image, or send a new Cloudinary URL to replace it; server-managed fields remain read-only.
- **200** → updated course object.
- **400** → field errors. **404** → not owned.
- Used by: Edit Course form.

## DELETE `/courses/instructor/courses/{id}/` — delete own course

- **204** → deleted (permanent; cascades to sections/lectures/quizzes and revokes access for enrolled
  students per existing model behaviour).
- **404** → not owned.
- Used by: Delete confirmation dialog. Client shows enrollment-aware warning when
  `subscribers_count > 0` before calling.

---

## Ownership & security invariants (must hold)

- No operation returns or mutates a course the caller does not own — verified independently of frontend
  routing (SC-004).
- `is_published`, `rating`, and the counters cannot be set by the client (mass-assignment closed).
- Draft courses never appear in any student/public endpoint (unchanged student viewset filters to
  published) (SC-008).

## Test checklist (backend `APITestCase`)

- [ ] Create (JSON) with only required metadata → 201, `is_published=false`, counts/rating default to 0.
- [ ] Create sending `is_published=true`/`rating=5` → those are ignored (still draft, rating 0).
- [ ] Create with a `thumbnail` URL string → stored; create without thumbnail → 201 (optional/nullable).
- [ ] Instructor A cannot retrieve/patch/delete Instructor B's course → 404 each.
- [ ] List returns only the caller's courses (draft + published), none of another instructor's.
- [ ] User without instructor profile → empty list / graceful (no 500).
- [ ] PATCH without `thumbnail` preserves the existing URL; PATCH with a new URL replaces it.
- [ ] Migration: `thumbnail` is a nullable `URLField`; API still emits `thumbnail` as a string URL.
