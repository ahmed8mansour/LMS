# API Contract: Course Readiness, Publish & Unpublish

Base: `/courses/instructor/courses/<id>/`

Auth: `CookieJWTAuthentication`. Permissions: `IsAuthenticated`, `isInstructor`.

**Ownership**: all three routes are `@action`s on `InstructorCourseViewSet`, so the course is resolved via
`get_object()` → `get_queryset()`, which is already filtered to
`instructor=request.user.instructor_profile`. A course owned by anyone else is a **404 before any handler
runs** — ownership is structural, not a per-view check (research R2). A caller with no `InstructorProfile`
gets an empty queryset and therefore a 404, never a 500.

Response contract per `CLAUDE.md`: payloads returned **directly**; errors `{ "error": "..." }` or field
errors `{ "field": ["..."] }`. **No `{data,status}` envelope.** No raw exceptions or stack traces.

**Migrations: none.** See `data-model.md`.

---

## GET `/courses/instructor/courses/<id>/readiness/` — the readiness report

Computes the course's readiness from its current content. Read-only; writes nothing.

- **Request**: no body.
- **200** →
  ```json
  {
    "status": "draft",
    "is_publishable": false,
    "needs_attention": false,
    "blockers": [
      {
        "code": "missing_thumbnail",
        "severity": "blocking",
        "message": "Add a course thumbnail.",
        "target": { "kind": "course", "id": 12 }
      },
      {
        "code": "empty_section",
        "severity": "blocking",
        "message": "Section 2 “Getting set up” has no lectures.",
        "target": { "kind": "section", "id": 31 }
      },
      {
        "code": "lecture_video_processing",
        "severity": "blocking",
        "message": "“Installing the toolchain” is still processing its video.",
        "target": { "kind": "lecture", "id": 88, "section_id": 30 }
      },
      {
        "code": "quiz_incomplete_question",
        "severity": "blocking",
        "message": "Quiz “Basics check” has 2 incomplete questions.",
        "target": { "kind": "quiz", "id": 9, "section_id": 30 }
      }
    ],
    "advisories": [
      { "code": "no_language", "severity": "advisory", "message": "Set the course language.", "target": { "kind": "course", "id": 12 } }
    ]
  }
  ```
  A fully ready course returns `"is_publishable": true` with `"blockers": []`.
- **404** → `{ "detail": "No Course matches the given query." }` — a course that does not exist **or** is not
  the caller's. The two are deliberately indistinguishable (FR-028: nothing exposed).
- **403** → a non-instructor caller (permission class).

**Codes**: the full set, and what each means, is in `data-model.md` §3. Codes are stable; `message` text is
not — clients MUST switch on `code`, never parse `message`.

**`needs_attention`** is `status == "published" && !is_publishable`. It is returned on every call so one fetch
drives both the checklist and the needs-attention banner.

---

## POST `/courses/instructor/courses/<id>/publish/` — publish

Evaluates the gate **inside the write transaction** on a row-locked course, then transitions. Throttled
(`course_publish` scope, 20/min).

- **Request**: no body. (Deliberately — the action is the intent; see research R2.)
- **200 — published** →
  ```json
  {
    "status": "published",
    "changed": true,
    "is_publishable": true,
    "needs_attention": false,
    "blockers": [],
    "advisories": [],
    "detail": "Your course is live."
  }
  ```
- **200 — already published (idempotent, FR-005)** → the same shape with `"changed": false` and
  `"detail": "This course is already published."` Nothing is written.
- **400 — refused by the gate (FR-014, FR-015)** →
  ```json
  {
    "error": "This course isn't ready to publish yet.",
    "blockers": [ { "code": "lecture_video_missing", "severity": "blocking", "message": "…", "target": { "kind": "lecture", "id": 88, "section_id": 30 } } ]
  }
  ```
  Nothing is written (invariant I4). `blockers` is an additive companion to the required `error` message —
  see research R7 for why this is the chosen shape.
- **404** / **403** → as above.
- **429** → throttled.

**Side effects on success**: `is_published = True`, saved with `update_fields=['is_published']`. That
deliberately does **not** bump `last_updated` — students see it on the public course page, so republishing
must not make unchanged content look fresh (research R8). Nothing else is touched: no counters, no
enrollments, no emails, no notifications.

**Concurrency**: the course row is held under `select_for_update()` for the duration, so a simultaneous
unpublish serialises behind it and the response always reports the state actually persisted (FR-032).

**Note on a stale client**: a client whose cached checklist said "ready" still gets a 400 if the course is no
longer ready. The client MUST treat that 400 as authoritative and refresh its readiness query rather than
retrying.

---

## POST `/courses/instructor/courses/<id>/unpublish/` — unpublish

Ungated — readiness is never consulted (FR-016). Throttled (`course_publish` scope).

- **Request**: no body.
- **200 — unpublished** → the readiness-report shape with `"status": "draft"`, `"changed": true`, and
  `"detail": "Your course is no longer in the catalog."` The report reflects the course's *current*
  readiness, so the instructor immediately sees what stands between this draft and republishing.
- **200 — already a draft (idempotent, FR-005)** → `"changed": false`,
  `"detail": "This course is already a draft."` Nothing is written.
- **404** / **403** / **429** → as above.

**Side effects on success**: `is_published = False` only. **Explicitly not touched** (FR-031): `Enrollment`,
`Order`, `Transaction`, `LectureProgress`, `QuizAttempt`, `Review`, `subscribers_count`,
`InstructorProfile.students_count`. No refund is initiated and no email is sent.

**Why enrolled students keep access** (verified, not assumed): no progress or playback path filters on
`is_published` — `apps/progress/views.py` gates every route on an **active enrollment**, and
`can_access_lecture_video()` on enrollment, course ownership, or admin. Unpublishing only removes the course
from the paths that *do* filter on it: the student course/section/lecture/quiz querysets, the homepage, and
the two enrollment entry points.

**Confirmation is a client obligation** (FR-006): the endpoint does not require a confirmation token. The
UI MUST confirm first and MUST state both halves of the consequence.

---

## Changed response shape: `InstructorCourseSerializer`

Two **additive**, read-only fields on every instructor course payload (list and detail):

```json
{ "id": 12, "title": "…", "is_published": false, "is_publishable": false, "needs_attention": false, "…": "…" }
```

- `is_publishable` — the course passes every blocking condition.
- `needs_attention` — `is_published && !is_publishable`; drives the My Courses badge (FR-025).

`is_published` remains **read-only** here, exactly as today: publishing is not reachable through `POST` or
`PATCH` on this serializer (FR-003). The student-facing `CourseSerializer` is **not** modified.

`InstructorCourseViewSet.get_queryset()` gains
`prefetch_related('section_set__lectures', 'section_set__quiz__question__choice')` so evaluating these two
fields across a list costs no per-course queries (research R5).

---

## Test checklist (`backend/apps/course/tests_publishing.py`)

**State transition matrix**

- [ ] draft + publish, course ready → 200, `changed=true`, `is_published` is True in the DB
- [ ] draft + publish, course not ready → 400 with `blockers`, `is_published` **still False**
- [ ] draft + unpublish → 200, `changed=false`, nothing written
- [ ] published + publish → 200, `changed=false`, nothing written
- [ ] published + unpublish → 200, `changed=true`, `is_published` is False in the DB
- [ ] publish twice in a row → second call is a clean no-op, not a 400 or a 500

**Each blocking condition, in isolation**

- [ ] no thumbnail (null, and separately blank string) → `missing_thumbnail`
- [ ] zero sections → `no_sections`
- [ ] one section with zero lectures → `empty_section` targeting that section's id
- [ ] lecture `video_status=PENDING` → `lecture_video_missing` targeting that lecture
- [ ] lecture `video_status=PROCESSING` → `lecture_video_processing`
- [ ] lecture `video_status=FAILED` → `lecture_video_failed`
- [ ] quiz with zero questions → `quiz_no_questions`
- [ ] question with blank text / with one choice / with zero correct choices → `quiz_incomplete_question`
- [ ] multiple simultaneous blockers → **all** are returned, not just the first
- [ ] every condition satisfied → `is_publishable=true`, `blockers=[]`

**Advisories never block**

- [ ] blank language, empty `goals_list`, no quizzes anywhere → advisories present, `is_publishable=true`
- [ ] `price=0` → publishable (FR-011)
- [ ] a course with no quizzes in any section → publishable (FR-010)

**Ownership & access (FR-028, FR-029)**

- [ ] instructor B's course: readiness → 404; publish → 404; unpublish → 404; B's `is_published` unchanged
- [ ] a student account on all three actions → 403
- [ ] a staff account with **no** `InstructorProfile` → 404 on all three, no exception raised
- [ ] an anonymous caller → 401/403, never a 500

**Gate integrity**

- [ ] readiness is recomputed at publish time: evaluate (ready), remove the only video, then publish → 400
- [ ] a refused publish leaves `last_updated` unchanged (nothing was saved)
- [ ] readiness writes nothing — `is_published` and `last_updated` identical before and after a GET

**Serializer fields**

- [ ] detail payload carries `is_publishable` and `needs_attention`
- [ ] a published course failing a condition → `needs_attention=true`; a draft failing one → `false`
- [ ] `is_published` is rejected as a write on `POST`/`PATCH` (stays read-only)
- [ ] list payload carries both fields for every course, and the query count does not grow with course count

**Student-facing invariants (FR-030, FR-031, FR-034)**

- [ ] a draft course is absent from the student course list, detail, and homepage
- [ ] after unpublish, an enrolled student can still fetch course progress, section content, and a video URL
- [ ] after unpublish, the course cannot be newly enrolled in (paid or free)
- [ ] after unpublish, enrollment / order / progress / review rows are byte-identical

The video provider is mocked throughout (`get_video_provider` patched); no test touches Cloudinary or Stripe.
