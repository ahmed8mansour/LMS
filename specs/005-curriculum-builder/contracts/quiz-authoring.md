# API Contract: Quiz Authoring (Quiz, Questions & Choices)

Bases:
- `/courses/instructor/quizzes/` — **existing** `InstructorQuizViewSet`.
- `/courses/instructor/questions/` — **NEW** `InstructorQuestionViewSet`.
- `/courses/instructor/choices/` — **NEW** `InstructorChoiceViewSet`.

Auth: `CookieJWTAuthentication`. Permissions: `IsAuthenticated`, `isInstructor`. Ownership is scoped
through the owning course on every resource:
- quizzes: `section__course__instructor = me`
- questions: `quiz__section__course__instructor = me`
- choices: `question__quiz__section__course__instructor = me`

Response contract per `CLAUDE.md`: payloads returned **directly**; errors `{ "error": "..." }` or field
errors `{ "field": ["..."] }`. **No `{data,status}` envelope.** No migration (no model field changes).

---

## Quiz — `/courses/instructor/quizzes/` (existing, one per section)

Serializer fields: `id, section, title, questions_count`. **005 change**: `questions_count` is
**read-only, default `0`** (server-managed; recomputed on question add/delete).

### POST — create the section's quiz
- **Request** (JSON): `section` (int, required — owned), `title` (str, required). `questions_count`
  ignored if sent.
- **201** → `{ id, section, title, questions_count: 0 }`.
- **400** → `{ "error": "This section already has a quiz." }` if the section already has one (OneToOne
  guard, returned cleanly — never a 500); `{ "error": "You don't have access to this section" }` if not
  owned.

### DELETE `/{id}/` — remove the quiz
- **204** → quiz + its questions/choices removed (cascade). UI confirms first.

*(A quiz's `title` may be edited via PATCH; questions_count is never client-set.)*

---

## Questions — `/courses/instructor/questions/` (NEW)

Serializer fields: `id, quiz, text, order, choices` — `choices` is a **nested read-only** array of
`{ id, question, text, is_correct }`; `order` is server-assigned/reordered (read-only to clients).

### GET `?quiz=<id>` — list a quiz's questions (with nested choices)
- **200** → array of question objects (each including its `choices`), ordered by `order`. Only for an
  owned quiz; otherwise empty. Used by the quiz editor to load content in one call.

### POST — add a question
- **Request** (JSON): `quiz` (int, required — owned), `text` (str; may be empty mid-edit).
  `order` auto-assigned to end.
- **201** → question object (`choices: []`). Side effect: parent `quiz.questions_count` recomputed.
- **400** → `{ "error": "…access…" }` if the quiz is not owned.

### PATCH `/{id}/` — edit text or reorder
- `{ "text"? }` → **200**. `{ "order"? }` → gap-free renumber among the quiz's questions (no DB uniqueness,
  cannot collide) → **200**.

### DELETE `/{id}/` — remove a question
- **204** → question + its choices removed; `quiz.questions_count` recomputed; remaining questions stay
  consistently ordered.

---

## Choices — `/courses/instructor/choices/` (NEW)

Serializer fields: `id, question, text, is_correct`.

### GET `?question=<id>` — list a question's choices *(optional; usually read nested via the question)*
- **200** → array of choice objects for an owned question; otherwise empty.

### POST — add a choice
- **Request** (JSON): `question` (int, required — owned), `text` (str, required),
  `is_correct` (bool, default false).
- **201** → choice object. **If `is_correct = true`**, all other choices of that question are set
  `is_correct = false` in the same transaction (exactly-one-correct invariant).
- **400** → `{ "error": "…access…" }` if the question is not owned; field error for empty `text`.

### PATCH `/{id}/` — edit text or mark correct
- `{ "text"? }` → **200**. `{ "is_correct": true }` → sets this choice correct and **unsets siblings**
  (transaction) → **200**. Setting `is_correct: false` is allowed but leaves the question with no correct
  choice (flagged incomplete by the UI).

### DELETE `/{id}/` — remove a choice
- **204** → choice removed. If it was the correct one, the question becomes incomplete (UI-flagged).

---

## Invariants enforced server-side (verified by APITestCase)

1. **Ownership** — every question/choice op resolves through the owning course; cross-owner access is
   refused with no data exposed (SC-005).
2. **Exactly one correct** — a question never has two correct choices; marking one correct unsets others
   (SC-004 / FR-009).
3. **Single quiz per section** — a second quiz create returns `400`, not `500` (SC-006 / FR-007).
4. **Server-managed count** — `questions_count` always equals the actual question count after any
   add/delete; clients cannot set it (FR-009a).

## Completeness (UI + future spec 007)

A question is **complete** when: `text` non-empty AND `choices ≥ 2` AND exactly one `is_correct`.
Incomplete questions are allowed to persist mid-edit but are flagged (FR-010); publish-readiness (spec 007)
will consult this. This feature does **not** block saving partial questions.
