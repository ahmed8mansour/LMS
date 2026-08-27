# Data Model: Instructor Course Management (004)

One field-type change, no new models. This feature reads and writes the **existing** `Course` model
through the instructor endpoint. The only schema change is **`Course.thumbnail`: `ImageField` →
`URLField(max_length=500, null=True, blank=True)`** (additive new migration; mirrors `profile_picture`)
so the thumbnail can use the direct-to-Cloudinary URL flow (research R2). This document captures the
fields surfaced, their client-side validation, the draft/published state, and the form ↔ payload mapping.

---

## Entity: Course (existing — `backend/apps/course/models.py`)

| Field | Type | Role in 004 | Client validation | Notes |
|-------|------|-------------|-------------------|-------|
| `id` | int | identity | — | route param `[courseId]` |
| `title` | CharField(255) | create/edit | required, 1–255 chars | |
| `description` | CharField(255) | create/edit | required, 1–255 chars | |
| `thumbnail` | **URLField** (was ImageField) | create(optional)/edit(replace) | image type + size cap on the picked file; optional | uploaded direct-to-Cloudinary; **URL string** sent in JSON; omit on edit to keep existing |
| `price` | Decimal(6,2) | create/edit | number ≥ 0, ≤ 9999.99 | zero = free course |
| `category` | choice | create/edit | enum (4 values) | `development`, `business`, `design & UI/UX`, `marketing` |
| `level` | choice | create/edit | enum (3 values) | `beginner`, `intermediate`, `advanced` |
| `language` | CharField(255) | create(optional)/edit | optional, ≤ 255 | |
| `goals_list` | JSONField(list) | create(optional)/edit | array of non-empty strings | repeatable add/remove rows |
| `is_published` | Bool | **read-only** | — | Draft/Published badge; publish action is spec 007 |
| `rating` | Decimal | **read-only** | — | server-managed; default 0 on create |
| `subscribers_count` | int | **read-only** | — | server-managed; default 0; drives delete-warning copy |
| `reviews_count` | int | **read-only** | — | server-managed; default 0 |
| `last_updated` | DateTime(auto) | read-only | — | shown in Overview |
| `created_at` | DateTime(auto) | read-only | — | list ordering (`-created_at`) |
| `instructor` | FK → InstructorProfile | **server-bound** | — | set by `perform_create`; never client-supplied |
| `sections` | reverse (read) | read-only | — | nested in read representation; used later by 005 |

**Ownership**: A course belongs to exactly one `InstructorProfile`. All list/retrieve/update/delete are
scoped to `request.user.instructor_profile` by the viewset (authoritative). A user without an instructor
profile sees an empty set (no leakage).

---

## State: publish status (read-only in 004)

```
              (create)                         (spec 007 — not here)
   ∅ ───────────────────────▶  DRAFT  ◀───────── unpublish ──────────  PUBLISHED
                              is_published=False        publish ───────▶ is_published=True
```

- **004 creates only DRAFT** courses and never flips `is_published`.
- Overview shows the badge **read-only**; any publish affordance is a placeholder that will route to the
  007 experience.
- Drafts are invisible to students/public (existing student viewset filters to published).

---

## Derived / referenced data

- **Has enrolled students** (delete warning): `subscribers_count > 0` from the course read representation.
  No extra request; approximate-but-sufficient for a confirmation warning (R6).
- **Status filter buckets** (client-side): `All` = every owned course; `Published` = `is_published===true`;
  `Draft` = `is_published===false`.
- **Title search** (client-side): case-insensitive substring over `title`.

---

## Form ↔ payload mapping

**Client thumbnail pre-step (both create & edit)**: if the user picked a file, upload it
direct-to-Cloudinary via `uploadToCloudinary()` (signature from `GET /auth/user/getCloudinarySignature/`)
→ obtain `secure_url`. Send that URL string as `thumbnail` in the JSON body below.

**Create** (`POST /courses/instructor/courses/`, `application/json`):

| Form field | JSON field | Required |
|------------|------------|----------|
| title | `title` | yes |
| description | `description` | yes |
| price | `price` | yes |
| category | `category` | yes |
| level | `level` | yes |
| language | `language` | no |
| goals (rows) | `goals_list` (`string[]`) | no |
| thumbnail (file → URL) | `thumbnail` (URL string) | no |

Server injects `instructor` (from the caller), and defaults `is_published=false`, `rating=0`,
`subscribers_count=0`, `reviews_count=0`. Any of these sent by the client are **ignored** (read-only).

**Edit** (`PATCH /courses/instructor/courses/{id}/`, `application/json`): same mappable fields; send
only changed fields; **omit `thumbnail`** to keep the existing image, or send a new URL to replace it.

**Frontend types** (`instructorCourses.types.ts`, conceptual):

```
InstructorCourse   = read shape (all fields above; is_published/rating/counts read-only)
CourseStatus       = 'draft' | 'published'   // derived from is_published
CourseFormData     = { title, description, price, category, level, language?, goals: string[], thumbnail?: FileList }
```

Zod schemas (`instructorCourses.schma.ts`): `createCourseSchema`, `editCourseSchema` (thumbnail optional).

---

## Validation rules → requirement traceability

- Required title/description/price/category/level, optional thumbnail/language/goals → **FR-005, FR-006**.
- Same rules on edit + inline errors → **FR-009**; block invalid saves → **SC-003**.
- price ≥ 0 and within range; category/level within allowed set → **Edge Cases**, **FR-006**.
- Server fields read-only + defaulted on create → **FR-005** (draft), **Constitution III** (no mass-assign).
- Ownership scoping on every action → **FR-010, SC-004**.
- Draft never in student/public listing → **FR-018, SC-008**.
- `thumbnail` optional at draft time (now `null/blank=True`) → **FR-006** (draft-friendly create).

## Schema change & migration

- **Change**: `Course.thumbnail` `ImageField(upload_to=...)` → `URLField(max_length=500, null=True, blank=True)`.
- **Migration**: one **new** migration in `apps/course/migrations/` (never edit existing).
- **Compatibility**: API `thumbnail` stays a string URL → **no** change to `CourseSerializer`/student output.
- **Legacy data**: existing rows' `thumbnail` values (ImageField public_ids) may not be full URLs after the
  change; **dev plan is to reseed** course data. If production data existed, a data migration converting
  public_ids → full Cloudinary URLs would be required (none at this stage — flag if that changes).
