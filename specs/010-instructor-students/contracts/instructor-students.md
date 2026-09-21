# API Contract: Instructor Student Roster

**Feature**: 010-instructor-students | **Date**: 2026-09-20 | **Spec**: [spec.md](../spec.md)

One endpoint serves both roster views (owner answer P6).

---

## 1. Endpoint

```
GET /courses/instructor/students/
```

| | |
|---|---|
| **View** | `InstructorStudentsView(ListAPIView)` — `apps/course/views.py` |
| **Auth** | `CookieJWTAuthentication` (project default) |
| **Permissions** | `IsAuthenticated`, `isInstructor` |
| **Throttle** | scope `instructor_students`, `120/min` |
| **Methods** | `GET` only. `POST`/`PATCH`/`PUT`/`DELETE` → `405` (FR-035) |
| **Pagination** | `StudentRosterPagination(PageNumberPagination)`, `page_size = 20`, fixed |
| **Filters** | `filters.SearchFilter` |

### Query parameters

| Name | Type | Default | Behaviour |
|------|------|---------|-----------|
| `course` | positive int | — | Absent → all owned courses. Present → that course, resolved against the owned set |
| `search` | string | `""` | Partial, case-insensitive name match. Whitespace-only ≡ absent |
| `page` | positive int | `1` | Out of range / unparseable → page 1 with `200` |

Unknown parameters are ignored.

---

## 2. Success — `200 OK`

Payload returned directly; no envelope (CLAUDE.md).

```json
{
  "count": 318,
  "next": "http://localhost:8000/courses/instructor/students/?course=42&page=3",
  "previous": "http://localhost:8000/courses/instructor/students/?course=42&page=1",
  "results": [
    {
      "id": 1042,
      "name": "Maria Gomez",
      "avatar": "https://res.cloudinary.com/demo/image/upload/v1/maria.jpg",
      "enrolled_at": "2026-07-02",
      "progress": 70.0,
      "course": { "id": 42, "title": "Django for Beginners" }
    },
    {
      "id": 1041,
      "name": "kmansour",
      "avatar": null,
      "enrolled_at": "2026-07-02",
      "progress": null,
      "course": { "id": 51, "title": "React Fundamentals" }
    }
  ]
}
```

### Field rules

| Field | Type | Rule | FR |
|-------|------|------|-----|
| `count` | int | Students matching **scope + search**, not the page length | FR-018, FR-022 |
| `next`, `previous` | string \| null | DRF absolute URLs; `null` at the ends | FR-022 |
| `id` | int | **Enrolment** id — unique in both scopes | P2 |
| `name` | string | `"first last"` trimmed, else `username`. Never empty | FR-007 |
| `avatar` | string \| null | `profile_picture` or `null`. Empty string normalises to `null` | FR-008 |
| `enrolled_at` | string | `YYYY-MM-DD`, UTC, **date only** — not a timestamp | FR-009 |
| `progress` | number \| null | Percent to one decimal, `0.0`–`100.0`. `null` **iff** the course has no lectures | FR-010, FR-011 |
| `course` | object | `{id: int, title: string}`. **Always present**, in both scopes | R9 |

An empty roster is `200` with `count: 0` and `results: []`. It is never `404`, and the *reason* it is empty
(no students / no matches / no courses) is the client's to distinguish — see §5.

### Guarantees

- Only enrolments in courses owned by the caller (FR-031).
- Only `is_active=True` enrolments, in `results` **and** in `count` (FR-006).
- Ordered by `enrolled_at` descending, ties broken by `id` descending — a total order, so consecutive pages
  of an unchanged roster neither repeat nor skip (FR-012, SC-003).
- No email address, order, transaction, quiz or lecture data appears anywhere in the body (FR-033, SC-005).
- Read-only; nothing is written (FR-035).

---

## 3. Errors

| Status | When | Body |
|--------|------|------|
| `401` | No/invalid session | DRF default |
| `403` | Authenticated but not an instructor | DRF default |
| `404` | `?course=` is not an owned course — **whether it belongs to someone else, does not exist, or is unparseable** | `{"error": "Course not found."}` |
| `405` | Any method other than `GET` | DRF default |
| `429` | Throttle exceeded | DRF default |
| `500` | Unexpected | `{"error": "We couldn't load the students. Please try again."}` — logged with a traceback, never returned |

**The four 404 cases must be byte-identical.** A different status or message for a non-owned course than for
a missing one turns the endpoint into a probe for which course ids exist (FR-032). The `int()` parse matters
here: without it, `?course=abc` raises `ValueError` and becomes a `500`, which is itself a distinguishing
signal.

**A caller with no `InstructorProfile`** (staff without a profile) gets `403` with
`{"error": "No instructor profile is associated with this account.", "code": "no_instructor_profile"}` —
the same body 009 returns, so the client's existing no-profile state handles it. **Not** a `200` with an empty
page: an empty roster already means "you have no students yet", and a broken account must not look like a new
instructor (FR-029, FR-034).

---

## 4. Worked examples

| Request | Result |
|---------|--------|
| `?course=42` | Course 42's roster, page 1 |
| `?course=42&search=mar&page=2` | Page 2 of the students of course 42 whose name matches `mar`; `count` = matches |
| *(no params)* | Every owned course, newest enrolment first |
| `?search=maria%20gomez` | Terms ANDed: matches a student whose first name contains `maria` **and** last name contains `gomez` |
| `?search=%20%20` | Whitespace only → treated as no search |
| `?search=50%25` | `%` matched literally, not as a wildcard |
| `?page=999` (3 pages exist) | Page 1, `200` |
| `?page=abc`, `?page=0`, `?page=-1` | Page 1, `200` |
| `?course=<another instructor's>` | `404` |
| `?course=999999` | `404`, identical |
| `?course=abc` | `404`, identical |

---

## 5. Consumer contract (frontend)

- **Parse with Zod before use.** A shape mismatch is the error state, not a half-rendered table.
- **`progress: null` renders `—`**, never `0%` (SC-007). The bar renders empty with no fill.
- **Do not build a `Date` from `enrolled_at`.** `new Date("2026-07-02")` is UTC midnight and
  `.toLocaleDateString()` shows **1 July** west of Greenwich, breaking FR-009. Format by splitting the string.
- **`count` drives the position label** — `"{from}–{to} of {count}"` — and `next`/`previous` being `null`
  drive the disabled states (FR-022). Do not compute page counts from `results.length`.
- **Do not use `keepPreviousData`.** FR-036 forbids showing the previous page's or search's rows as if they
  were the new result; show the skeleton.
- **`staleTime: 0`, `gcTime: 0`**, following 008/009 — a roster must not be served from cache after an
  enrolment or a refund.
- **One row per enrolment.** Key React lists on `id` (the enrolment), never on the student, or the aggregate
  view will drop rows for anyone enrolled in two courses.
- **The course column is driven by the route, not by the payload** — `course` is always sent; the workspace
  tab hides it, the sidebar page shows it.
- **Query key**: `['instructor', 'students', { courseId, search, page }]`.

---

## 6. Test checklist

Each line is one assertion in `backend/apps/course/tests_roster.py`.

**Scope**
- [ ] No `course` → enrolments from every owned course
- [ ] `?course=<owned>` → only that course
- [ ] Another instructor's enrolments appear in neither scope

**Ownership & refusals** (FR-031, FR-032)
- [ ] `?course=<other instructor's>` → `404`
- [ ] `?course=<nonexistent>` → `404`, identical status **and** body
- [ ] `?course=abc` → `404`, identical (not `500`)
- [ ] `?course=0`, `?course=-1` → `404`, identical
- [ ] Student caller → `403`; anonymous → `401`
- [ ] Staff user with no `InstructorProfile` → `403` with `code: no_instructor_profile` (not a `500`, and not a `200` empty page)
- [ ] `POST` → `405`

**Rows** (FR-006 – FR-011)
- [ ] Refunded (`is_active=False`) enrolment absent from `results` **and** from `count`
- [ ] `name` falls back to `username` when both name fields are blank
- [ ] `avatar` is `null` when `profile_picture` is unset
- [ ] `enrolled_at` matches `^\d{4}-\d{2}-\d{2}$`
- [ ] 7 of 10 lectures completed → `progress == 70.0`
- [ ] Course with no lectures → `progress is None` (not `0`)
- [ ] `LectureProgress` rows with `is_completed=False` do not count
- [ ] A student in two owned courses → two rows, different `course`, independent `progress`
- [ ] `course` is present in both scopes

**Agreement** (FR-010)
- [ ] The same student/course yields the same `progress` here as on `/progress/student/courses/`

**Ordering** (FR-012, SC-003)
- [ ] Newest `enrolled_at` first
- [ ] Rows sharing an `enrolled_at` come back in the same order across two identical requests
- [ ] With tied timestamps spanning a page boundary, pages 1 and 2 share no `id`

**Search** (FR-014 – FR-019)
- [ ] Partial match (`"mar"` → `"Maria"`)
- [ ] Case-insensitive
- [ ] Surname-only matches
- [ ] `"maria gomez"` matches across first **and** last name
- [ ] `%` and `_` matched literally
- [ ] Whitespace-only ≡ no search
- [ ] `count` reflects matches, not the full roster
- [ ] A match on page 4 of the unfiltered roster is returned on page 1 of the search

**Paging** (FR-021 – FR-025)
- [ ] Page size is 20
- [ ] `count`, `next`, `previous` correct at first, middle and last page
- [ ] `?page=999`, `?page=abc`, `?page=0`, `?page=-1` → page 1 with `200`
- [ ] Search + page combine; paging applies to matches only
- [ ] A single-page roster has `next` and `previous` both `null`

**Query plan** (R7)
- [ ] 5 queries for a full page in the `?course=` scope (the four below plus the ownership resolution)
- [ ] 4 queries for a full page in the aggregate scope
- [ ] Unchanged when the page holds students from 20 different courses
- [ ] A search term adds no query

**Privacy** (FR-033, SC-005)
- [ ] The raw response body contains no `@`-bearing email, no order/transaction field, no quiz field, no
      lecture id
