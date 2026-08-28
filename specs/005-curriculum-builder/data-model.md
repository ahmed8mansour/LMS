# Phase 1 Data Model: Instructor Curriculum Builder

**No new models and no migration.** This feature manages the **existing** content tree
(`Section → Lecture`, `Section → Quiz → Question → Choice`) and adds only serializer/view logic. This
document captures the fields the feature reads/writes, the invariants it enforces, the ordering rules, and
the mm:ss ↔ minutes conversion. All entities live in `backend/apps/course/models.py`.

## Entity map (existing)

```
Course (owned by InstructorProfile; stays draft in this feature)
└── Section            (course FK; title; order — unique per course)
    ├── Lecture        (section FK; title; duration[min]; order — unique per section; video_status RO)
    └── Quiz           (section OneToOne; title; questions_count — server-managed)
        └── Question   (quiz FK; text; order — NOT unique)
            └── Choice (question FK; text; is_correct — exactly one true per question)
```

Ownership for every entity resolves through `…course.instructor == request.user.instructor_profile`.

---

## Section (existing)

| Field | Type | Writable here | Rules |
|-------|------|---------------|-------|
| `id` | int (pk) | no | — |
| `course` | FK → Course | on create | MUST be a course the caller owns (server-checked). |
| `title` | char(255) | yes | Required, non-empty (trimmed). |
| `order` | int | server-managed | Unique within course. **Auto-assigned** to end on create if omitted; changed only via collision-safe reorder. |

- **Delete** cascades to the section's lectures and quiz (and questions/choices).
- **Reorder**: within the course only; transactional two-phase renumber (research R2).

## Lecture (existing)

| Field | Type | Writable here | Rules |
|-------|------|---------------|-------|
| `id` | int (pk) | no | — |
| `section` | FK → Section | on create | Section MUST belong to a course the caller owns. |
| `title` | char(255) | yes | Required, non-empty. |
| `duration` | decimal(6,2) — **minutes** | yes | Entered as **mm:ss**, stored as decimal minutes; MUST be > 0 and within range. |
| `order` | int | server-managed | Unique within section. Auto-assigned to end on create; changed only via collision-safe reorder. **Within-section only** (no cross-section move). |
| `video_status` | enum | **no (read-only)** | `PENDING / PROCESSING / COMPLETED / FAILED`; displayed only. Upload deferred to spec 006. |
| `video_public_id`, `video_url` | — | no | Not managed here (video subsystem / spec 006). |

### mm:ss ↔ decimal-minutes (frontend `lib/duration.ts`)

```
parse("mm:ss")  ->  minutes = mm + ss/60   (round to 2 dp)     # for the write payload
format(minutes) ->  m = floor(minutes); s = round((minutes-m)*60); if s==60 { m+=1; s=0 }  -> `${m}:${pad2(s)}`
```

Validation (Zod, client): matches `^\d{1,3}:[0-5]?\d$` (or a bare minutes integer), resolves to `> 0` and
`< 10000` minutes (fits `max_digits=6, decimal_places=2`). Server backstop: positive decimal in range.

## Quiz (existing)

| Field | Type | Writable here | Rules |
|-------|------|---------------|-------|
| `id` | int (pk) | no | — |
| `section` | OneToOne → Section | on create | Section MUST be owned; **at most one quiz per section** — a second create returns `400 {"error": …}`. |
| `title` | char(255) | yes | Required, non-empty. |
| `questions_count` | int | **server-managed (read-only, default 0)** | Recomputed as `quiz.question.count()` on each question create/delete. Clients never send it. |

## Question (existing model — newly manageable)

| Field | Type | Writable here | Rules |
|-------|------|---------------|-------|
| `id` | int (pk) | no | — |
| `quiz` | FK → Quiz | on create | Quiz MUST be owned (via section→course). |
| `text` | text | yes | Required for a **complete** question (non-empty); may be blank mid-edit. |
| `order` | int | server-managed | **Not** DB-unique; auto-assigned to end on create; reorder is a plain value update (gap-free renumber, cannot collide). |

- **Completeness** (for UI flag + future 007 gate): `text` non-empty AND `choices ≥ 2` AND exactly one
  `is_correct`. Incomplete questions persist but are flagged; they are not silently "valid".

## Choice (existing model — newly manageable)

| Field | Type | Writable here | Rules |
|-------|------|---------------|-------|
| `id` | int (pk) | no | — |
| `question` | FK → Question | on create | Question MUST be owned (via quiz→section→course). |
| `text` | text | yes | Required, non-empty. |
| `is_correct` | bool | yes | **Exactly one** true per question; setting one true unsets the others (server, in a transaction). |

---

## Serializer changes (existing file `serializers.py`)

- **`QuizSerializer`**: add `read_only_fields = ['questions_count']` and ensure it defaults to `0` on
  create (model default or serializer default). No other shape change (stays `fields='__all__'` incl.
  `id, section, title, questions_count`).
- **`QuestionSerializer`** (new): `fields = ['id', 'quiz', 'text', 'order', 'choices']`, where `choices`
  is a nested read-only `ChoiceSerializer(many=True)` sourced from the related manager; `order` read-only
  (server-assigned/reordered).
- **`ChoiceSerializer`** (new): `fields = ['id', 'question', 'text', 'is_correct']`.
- `LectureSerializer` / `SectionSerializer` unchanged (already expose the fields used).

## Viewset behaviour (existing file `views.py`)

| Viewset | Change |
|---------|--------|
| `InstructorSectionViewSet` | `perform_create`: auto-assign `order` if omitted (owner check already present). `update/partial_update`: if `order` changes, collision-safe reorder via `reorder.py` in a transaction. |
| `InstructorLectureViewSet` | Same as section (auto-assign + reorder), scoped within the section; reject cross-section `section` change on update (out of scope). |
| `InstructorQuizViewSet` | `perform_create`: catch the OneToOne violation → `400 {"error": "This section already has a quiz."}`. |
| `InstructorQuestionViewSet` (new) | Ownership queryset `quiz__section__course__instructor=…`; `?quiz=<id>` filter; auto-assign `order`; after create/destroy recompute parent `quiz.questions_count`. |
| `InstructorChoiceViewSet` (new) | Ownership queryset `question__quiz__section__course__instructor=…`; `?question=<id>` filter; on `is_correct=true` create/update, unset siblings in a transaction. |

## State & lifecycle

- The **course stays a draft** throughout — no field here toggles `is_published`.
- Deletes are **permanent** and cascade (existing model behaviour); no soft-delete/versioning.
- All content remains **invisible to students/public** (draft course), visible only to the owning
  instructor (and admin).

## Frontend types (`types/instructorCurriculum.types.ts`)

```ts
type VideoStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

interface Choice   { id: number; question: number; text: string; is_correct: boolean; }
interface Question { id: number; quiz: number; text: string; order: number; choices: Choice[]; }
interface Quiz     { id: number; section: number; title: string; questions_count: number; }
interface Lecture  { id: number; section: number; title: string; duration: string; order: number; video_status: VideoStatus; video_url: string | null; }
interface Section  { id: number; course: number; title: string; order: number; lectures: Lecture[]; quiz: Quiz | null; }
```

Form payloads carry `duration` as the converted decimal-minutes **string** (matching DRF decimal
serialization) and never include `order`, `questions_count`, or `video_status`.
