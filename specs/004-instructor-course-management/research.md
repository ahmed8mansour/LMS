# Research: Instructor Course Management (004)

Phase 0 decisions. All spec clarifications were resolved during `/speckit.clarify`; the open items here
are the technical unknowns surfaced while grounding the plan in the real codebase.

---

## R1 — Creating a draft course through the instructor endpoint

**Question**: Can a minimal draft be created via `POST /courses/instructor/courses/` as the code stands?

**Finding**: No, not safely. `CourseSerializer` (`backend/apps/course/serializers.py`) lists
`rating`, `subscribers_count`, `reviews_count`, `is_published` as **writable** fields, and the `Course`
model gives these **no defaults** and makes them non-null. So a create that sends only metadata fails
validation/DB constraints, and a create that sends them is **mass-assignable** (a client could set
`is_published=true` or an arbitrary `rating`, bypassing the future publish gate).

**Decision**: Add a dedicated **`InstructorCourseSerializer`** used only by `InstructorCourseViewSet`
(via `get_serializer_class`, or by swapping `serializer_class`). It:
- marks `rating`, `subscribers_count`, `reviews_count`, `is_published` as **read-only**;
- **defaults** them on create — `rating=0`, `subscribers_count=0`, `reviews_count=0`,
  `is_published=False` — by injecting them in `create()` (or in the viewset's `perform_create`);
- keeps `thumbnail` (now a URL string — see R2), `language`, `goals_list` **optional** (draft-friendly, per FR-006);
- reuses the existing read representation (nested `sections`, `instructor_profile`) for retrieve/list so
  the workspace/overview has what it needs.

**Rationale**: Matches discovery §12.2/§13.3 ("dedicated instructor serializer variant — do not change the
student-facing shape"), closes a real security gap (Constitution III), and keeps the student
`CourseSerializer` and `StudentCourseViewSet` untouched.

**Defaults location — sub-decision**: Prefer defaulting **in the serializer/viewset** over adding model
`default=`s. Model defaults would require a new migration and change behaviour for admin-created courses
too. If the team prefers DB-level safety, an **additive** migration adding
`default=0`/`default=False` is acceptable (Hard Rule: new migration only, never edit existing). **Chosen:
serializer/viewset defaults** — smallest blast radius, no migration.

**Alternatives considered**: (a) Send all fields from the client with zeros — rejected: mass-assignment +
leaks server concerns into the form. (b) A separate custom create action — rejected: the existing
`ModelViewSet` create is sufficient once the serializer is fixed; no new endpoint needed.

---

## R2 — Thumbnail upload transport (owner decision: direct-to-Cloudinary)

**Question**: How does the thumbnail reach the backend — multipart file through Django, or the
direct-to-Cloudinary URL flow used by profile pictures?

**Owner decision**: Use the **direct-to-Cloudinary** flow (the owner explicitly does not want multipart
uploads through Django — they are slow).

**Finding**: The profile-picture flow uploads the file **straight to Cloudinary** from the browser and
stores the returned `secure_url` **string**; `profile_picture` is a **`URLField(max_length=500,
null=True, blank=True)`**. But `Course.thumbnail` is a Django **`ImageField`**, which stores a
storage-managed file, not a raw URL — incompatible with sending a plain URL string. The client helper
`uploadToCloudinary(file)` (`auth.api.ts`) gets a signature from the **generic, authenticated endpoint
`GET /auth/user/getCloudinarySignature/`** (`CloudinarySignatureView` — signs a timestamp only, no folder
pinning) and POSTs the file to `https://api.cloudinary.com/v1_1/{cloud}/image/upload`, returning
`secure_url`.

**Decision**:
1. **Change `Course.thumbnail` from `ImageField` → `URLField(max_length=500, null=True, blank=True)`**,
   mirroring `profile_picture`. This is an **additive new migration** (Hard Rule: never edit existing
   migrations). `null/blank=True` also makes the thumbnail **optional at draft time** for free (folds R3's
   draft-thumbnail concern away).
2. **Create/edit payloads are plain `application/json`** — no multipart. The client uploads the thumbnail
   file to Cloudinary first (reusing the flow above) and sends `thumbnail: <secure_url>` in the JSON body.
   `goals_list` is a native JSON array in the same body (no stringifying needed — JSON end to end).
3. On **edit**, omit `thumbnail` (PATCH) to keep the existing URL; send the new URL to replace it.
4. **Reuse the existing signature endpoint** `GET /auth/user/getCloudinarySignature/` as-is (it is generic
   and authenticated). Extract the client helper to `src/lib/cloudinary.ts` so auth and instructor-courses
   share one `uploadToCloudinary` (extend, don't duplicate).

**Student-facing shape unchanged**: both `ImageField` (serialized via `.url`) and `URLField` emit
`thumbnail` as a **string URL** in the API, so `StudentCourseViewSet`/`CourseSerializer` output is
unchanged.

**Migration data note**: existing `Course` rows hold `ImageField` storage values (a Cloudinary
public_id/path), not necessarily full URLs. After the field-type change, those legacy values may render
incorrectly. Options: (a) acceptable in dev if course data is reseeded; (b) a one-off **data migration**
converting stored public_ids to full Cloudinary URLs. **Chosen: reseed in dev** (flag to owner if
production data exists — it does not at this stage).

**Alternatives considered**: (a) Multipart through Django (original plan) — rejected per owner (slow, and
adds server upload handling). (b) Keep `ImageField` but accept a URL and re-upload server-side — rejected:
defeats the point and adds a server round-trip to Cloudinary.

---

## R3 — List, filter, and search strategy

**Decision**: Fetch the instructor's full owned-course list once via
`GET /courses/instructor/courses/` and apply **status filter (All/Published/Draft)** and **title search**
**client-side** (spec clarification Q1). No pagination, no server-side filter backend added.

**Rationale**: The instructor viewset is a plain `ModelViewSet` with no filter/search/pagination backends;
per-instructor course counts are small and bounded. Client-side keeps interactions instant and preserves
"no new backend endpoint". TanStack Query caches the single list; mutations invalidate its query key.

**Alternatives considered**: server-side filter + cursor pagination (as the student catalog uses) —
rejected as unjustified for a bounded personal list and out of the spec's scope.

---

## R4 — Edit surface & routing

**Decision**: Dedicated edit route `app/instructor/courses/[courseId]/edit/page.tsx` reusing a shared
**`CourseForm`** component (spec clarification Q2). The `[courseId]` segment carries a **workspace layout**
(`layout.tsx`) providing the tab bar (Overview · Curriculum · Analytics · Students · Reviews) and the
course-title breadcrumb root; `page.tsx` is the read-only **Overview**. Later-spec tabs are `ComingSoon`
placeholders, mirroring how 003 handled sidebar destinations.

**Rationale**: Deep-linkable edit, clean separation of read (Overview) vs write (Edit), one form for
create and edit (DRY), and a stable workspace shell for specs 005/009/010/012 to slot into.

**Note**: The `edit` route lives *under* the workspace `[courseId]` layout, so it inherits the tab bar and
breadcrumbs; that is acceptable (Edit is reachable from Overview's "Edit" link and from the card).

---

## R5 — Forms, validation, and the goals list

**Decision**: Use **React Hook Form + Zod** via `@hookform/resolvers/zod` (already the house pattern —
`ProfileForm.tsx`, `auth.schma.ts`). Two Zod schemas in `instructorCourses.schma.ts`:
`createCourseSchema` (title, description, price, category, level required; language, goals, thumbnail
optional) and `editCourseSchema` (same shape; thumbnail optional/replace-only). Validation rules:
- **price**: coerced number, `>= 0`, within the model's `max_digits=6, decimal_places=2` range (max
  9999.99); zero allowed (free course).
- **category**: enum `development | business | design & UI/UX | marketing` (exact model choices).
- **level**: enum `beginner | intermediate | advanced`.
- **title/description**: non-empty, `<= 255` chars (model `CharField(max_length=255)`).
- **goals_list**: array of non-empty short strings via a repeatable **`GoalsListField`** (add/remove rows)
  → `string[]` (spec clarification Q3).
- **thumbnail**: optional; the form field is a `FileList`, validated as an image within a size cap. On
  submit the file is uploaded direct-to-Cloudinary (R2) and only the resulting **URL string** is sent to
  the API. On edit, absence means "keep existing".

**Rationale**: Matches existing conventions and the actual model constraints; per-field inline errors
satisfy FR-006/FR-009 and SC-003.

---

## R6 — Delete confirmation & enrollment awareness

**Decision**: Delete via `DELETE /courses/instructor/courses/{id}/` behind an **`alert-dialog`** confirm
(`DeleteCourseDialog`). The dialog copy is **enrollment-aware**: if the course has enrolled students, the
confirmation explicitly states the course + content are permanently removed and students immediately lose
access; otherwise a lighter confirm.

**Enrollment signal**: The Course read representation already carries `subscribers_count` (bumped on
enrollment by `FulfillmentFacade`). Use `subscribers_count > 0` as the "has enrolled students" signal to
choose the warning copy — no extra request. (Exactness vs. `Enrollment` rows is unnecessary for a warning.)

**Rationale**: Uses existing data, no new endpoint; satisfies FR-014 and SC-006. Deletion stays permanent
and cascades per existing model behaviour (no soft-delete introduced).

---

## R7 — Ownership & draft-leak safety (already provided)

**Finding**: `InstructorCourseViewSet.get_queryset()` filters to
`Course.objects.filter(instructor=request.user.instructor_profile)` and returns `Course.objects.none()`
for a user without an instructor profile; `perform_create` binds ownership. Non-owned IDs therefore 404
for retrieve/update/delete — the authoritative gate (FR-010, SC-004). Drafts (`is_published=False`) never
appear in student/public serializers (student viewset filters to published), satisfying FR-018/SC-008.

**Decision**: Rely on this as-is; the new read views/pages add **no** cross-instructor access. Frontend
surfaces a clear not-found/forbidden state on 404. Handle the "staff without instructor profile" case
gracefully in the UI (consistent with 003 FR-008) — the empty queryset already prevents data leakage.

---

## Summary of backend work (in-scope, minimal)

1. **Model**: `Course.thumbnail` `ImageField` → `URLField(max_length=500, null=True, blank=True)` +
   **one new additive migration** (never edit existing).
2. `InstructorCourseSerializer` — read-only `rating/subscribers_count/reviews_count/is_published`;
   default them on create; `thumbnail` is an optional URL string; language/goals optional; reuse the
   nested read representation.
3. `InstructorCourseViewSet` — use that serializer (`get_serializer_class`), keep existing ownership logic.
4. **Reuse** `GET /auth/user/getCloudinarySignature/` for thumbnail uploads (no new signature endpoint).
5. Tests — draft create (JSON) succeeds with metadata only; `thumbnail` URL accepted and optional; server
   fields ignored if sent; ownership 404s. **No** new CRUD endpoint, **no** edit to existing migrations,
   **no** student-facing shape change.
