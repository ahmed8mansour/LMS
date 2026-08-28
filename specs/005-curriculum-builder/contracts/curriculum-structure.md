# API Contract: Curriculum Structure (Sections & Lectures)

Bases: `/courses/instructor/sections/` and `/courses/instructor/lectures/` — **existing**
`InstructorSectionViewSet` / `InstructorLectureViewSet` (`ModelViewSet`).
Auth: `CookieJWTAuthentication` (HttpOnly cookies, `withCredentials`). Permissions: `IsAuthenticated`,
`isInstructor`. Every operation is **scoped to the caller's own courses** via `get_queryset`
(`…course.instructor = request.user.instructor_profile`); a user without an instructor profile gets an
empty set. Response contract per `CLAUDE.md`: payloads returned **directly**; errors as `{ "error": "..." }`
or field errors `{ "field": ["..."] }`. **No `{data,status}` envelope.**

**005 changes (additive view logic, no new endpoint, no migration):**
- `order` is **auto-assigned** to the end of the parent on create when omitted.
- Changing `order` triggers a **collision-safe, transactional renumber** within the same parent (two-phase
  temp-offset; research R2). No batch endpoint.
- Lecture `section` is fixed after create (no cross-section move — out of scope; a changed `section` on
  update is rejected).

**Reads reuse the course retrieve**: the builder loads the whole `sections → lectures → quiz` tree from
`GET /courses/instructor/courses/{id}/` (existing `InstructorCourseSerializer`), so it does not list
sections/lectures separately for display.

---

## Sections — `/courses/instructor/sections/`

### POST — add a section
- **Request** (JSON): `course` (int, required — must be owned), `title` (str, required).
  `order` optional; **auto-assigned to end** if omitted. Sending `order` is allowed but normally omitted.
- **201** → `{ id, course, title, order, lectures: [], quiz: null }`.
- **400** → `{ "error": "You don't have access to this section" }` if `course` is not owned; field errors
  for missing/empty `title`.

### PATCH `/{id}/` — rename or reorder
- **Rename**: `{ "title": "…" }` → **200** updated section.
- **Reorder**: `{ "order": <int target position> }` → server renumbers the course's sections atomically so
  positions stay unique and gap-free → **200**. Never returns an `IntegrityError`/500 for a valid target.
- **404** → not owned / nonexistent.

### DELETE `/{id}/` — remove a section
- **204** → section and its lectures + quiz (+ questions/choices) are permanently removed (cascade).
- Client MUST confirm first (enrollment-aware copy); confirmation is UI-side.

---

## Lectures — `/courses/instructor/lectures/`

Serializer fields: `id, section, title, duration, order, video_status, video_url`
(`video_status` **read-only**; `video_url` read-only, non-null only for COMPLETED + authorized viewer).

### POST — add a lecture
- **Request** (JSON): `section` (int, required — must be owned), `title` (str, required),
  `duration` (decimal **minutes**, required, > 0 — client converts from mm:ss). `order` optional,
  **auto-assigned to end**.
- **201** → lecture object with `video_status = "PENDING"`, `video_url = null`.
- **400** → `{ "error": "You don't have access to this section" }` if `section` not owned; field errors for
  missing `title` / non-positive or malformed `duration`.

### PATCH `/{id}/` — edit or reorder
- **Edit**: `{ "title"?, "duration"? }` (duration = decimal minutes from mm:ss) → **200**.
- **Reorder**: `{ "order": <int target> }` → transactional renumber **within the same section** → **200**.
- **`section` change is rejected** (cross-section move out of scope) → **400** `{ "error": "…" }`.
- `video_status` is ignored if sent (read-only).

### DELETE `/{id}/` — remove a lecture
- **204** → lecture permanently removed; section's remaining lectures stay consistently ordered.

---

## Ownership & error semantics (both resources)

- Any create/update/delete referencing a parent the caller does not own → **400/404** with `{ "error": … }`
  and **no data exposed** (queryset filter + `perform_create` check). Verified by test independent of the
  frontend (SC-005).
- A staff account without an `InstructorProfile` → empty queryset / clean rejection, never a 500.
