# Phase 0 Research: Course Publishing & Readiness Gate

Decisions taken before implementation, with the alternatives that were rejected and why. Each is referenced
from `plan.md` as R*n*.

---

## R1 — Model the lifecycle with the State pattern

**Decision**: Represent draft and published as **state objects**, not as scattered branches on the boolean.

```text
CourseState (ABC)
├── name: 'draft' | 'published'
├── publish(course, readiness)   -> TransitionResult
└── unpublish(course)            -> TransitionResult

DraftState      publish   → gate on readiness; refuse with blockers, or flip to published
                unpublish → no-op (already a draft)
PublishedState  publish   → no-op (already published)
                unpublish → flip to draft, ungated

get_course_state(course) -> CourseState      # factory; derives from course.is_published
```

The state is **derived, never stored**. `Course.is_published` remains the single persisted fact; the factory
maps it to a state object on each use. `TransitionResult` carries `changed: bool`, the resulting state name,
a `refused: bool`, and (on refusal) the blocking items. `refused` was added during implementation:
`changed=False` alone is ambiguous — it is true for both an idempotent no-op (200) and a gate refusal (400) —
and the view should not have to infer which from whether `blockers` happens to be non-empty.

**Rationale**:

- **The product owner asked for it.** That is the first reason and it is sufficient on its own for a pattern
  this cheap.
- **The transition table is genuinely asymmetric**, which is what makes it more than one `if`. Publishing is
  gated by readiness; unpublishing is not (FR-016). Each direction also has an idempotent no-op (FR-005).
  That is four distinct behaviours across a 2×2 matrix. Expressed as branches, the same conditions get
  re-derived in the publish view, the unpublish view, and the readiness view, and the no-op cases are
  exactly the ones people forget — they are invisible in a happy-path test.
- **It matches this codebase's established taste.** `PaymentGateway` ABC → `StripeGateway` →
  `get_payment_gateway()` factory, and the video provider factory, are the same shape. A reviewer who knows
  `apps/enrollment/payments/` will read `apps/course/publishing/` without orientation cost.
- **It is the seam for the state the discovery doc already anticipates.** §13.1 and §7 float an *archived*
  state. Adding `ArchivedState` later is one new class plus one factory branch; adding it to a thicket of
  boolean branches means revisiting every call site.

**Honest cost**: with two states, this is more structure than the minimum. Accepted, bounded by a hard rule:
**the state classes own transitions only.** The readiness rules live in `PublishReadinessService` (R3) and
are passed *in* to `DraftState.publish()`. A state class that also knew how to inspect quizzes would be the
god object the pattern exists to avoid.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Plain `if course.is_published` in the view | Puts business rules in the view layer, against the conventions doc ("keep views thin"). The idempotency and gate matrix would be duplicated across three endpoints. |
| A state-machine library (`django-fsm`, `transitions`) | A new dependency for two states, and both want to own the field/transitions, which pulls `is_published` away from the many student-facing queries that filter on it. No value at this scale. |
| Replace `is_published: bool` with `status: CharField` | Changes the meaning of an existing field that eight code paths filter on, and would need a data migration plus edits across enrollment, progress, reviews, and discovery. Directly against the project's Hard Rules and the spec's no-migration assumption. |
| Store the state object's name alongside the boolean | Two sources of truth for one fact — the classic drift bug. The factory deriving state from the boolean costs nothing and cannot disagree. |

---

## R2 — Expose the transitions as viewset actions, not standalone views

**Decision**: Three DRF `@action`s on the existing `InstructorCourseViewSet`:

- `GET  /courses/instructor/courses/{id}/readiness/`
- `POST /courses/instructor/courses/{id}/publish/`
- `POST /courses/instructor/courses/{id}/unpublish/`

**Rationale**: `@action` resolves the course through `get_object()` → `get_queryset()`, which is **already**
filtered to `instructor=request.user.instructor_profile`. Ownership (FR-028) therefore comes from existing,
tested code and **cannot be forgotten** — a non-owned id is a 404 before any handler runs. This is precisely
the ad-hoc-per-view-check problem the discovery document flags in §13.5, solved without inventing a mixin.
The router generates the routes, so `urls.py` is untouched.

Each action is thin: resolve the course, call `CoursePublishingService`, serialize the result. No business
logic in the view.

### Mechanics (so the tasks phase does not rediscover them)

- **Routes are generated, not declared.** `@action(detail=True, methods=['post'])` on a method named
  `publish` yields `/{registered prefix}/{pk}/publish/` — here `/courses/instructor/courses/12/publish/`,
  because `DefaultRouter` already registers `instructor/courses` and the app is included under `courses/`.
  `urls.py` gets **no new line**. All three method names are single words, so the URL segment is the method
  name verbatim; `url_path=` is available if that ever stops being true.
- **`self.get_object()` is the whole ownership story.** It resolves the pk *inside* `get_queryset()`, so a
  course belonging to another instructor is a 404 raised by DRF before the handler body runs, and a caller
  with no `InstructorProfile` hits the existing `Course.objects.none()` branch and also gets a clean 404
  (FR-029) rather than an `AttributeError`. Neither case needs code in the action.
- **Shared configuration is inherited.** `authentication_classes`, `permission_classes`, the serializer, and
  critically the `prefetch_related` added for R5 all come from the viewset. Standalone views would need the
  prefetch repeated in each — and a repeated prefetch is a silent N+1 the moment one copy drifts.
- **Per-action overrides**: `permission_classes` and `throttle_classes` may be passed as `@action(...)`
  kwargs. **`throttle_scope` may not** — it is not an `APIView` attribute, so DRF's initkwargs validation
  rejects it. See R10 for the mechanism that does work.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Standalone `APIView`s (the pattern the video endpoints use) | Requires hand-written ownership lookups, the `InstructorProfile`-missing `try/except`, and a repeated prefetch — three copies each of what `get_queryset()` already does once. 006 did the right thing by centralising `_get_owned_lecture()` (`views.py:425`) rather than inlining it three times, but that helper still had to be written and still has to be *remembered* at each call site; an action has nothing to remember. |
| `PATCH` the course with `{is_published: true}` | Violates FR-003 outright: publishing would become reachable through a metadata save. |
| One `POST .../publish/` taking `{publish: bool}` | A body flag for a binary action makes the audit-less request log ambiguous and invites a client to send the wrong value; two named routes are self-describing. |

**Where `APIView` is still correct** — the test is "does this act on one row the viewset already scopes?":
`/courses/video/webhook/` genuinely cannot be an action (unauthenticated, provider-signed, belongs to no
user's queryset, so there is no `get_object()` to lean on), and cross-resource workflows like
`create-payment-intent` do not hang off a single row. The video signature/confirm/delete views key off
`lecture_id` and arguably *could* have been actions on `InstructorLectureViewSet`; that is not being
retrofitted with a rationale and is **not** proposed for change by this feature.

**Note on the conventions doc**: it lists `APIView` for "complex operations, actions, or workflows", and
`@action` is not yet used anywhere in this codebase. This is a deliberate, narrow first use, justified by the
ownership-by-construction argument above. It is standard DRF, not a bespoke abstraction. The one real cost is
grep-ability — the route is not visible in `urls.py`, so a reader has to know the router generates it.

---

## R3 — One readiness implementation, returning itemized codes

**Decision**: `PublishReadinessService.evaluate(course) -> ReadinessReport`. The report holds
`is_publishable`, a list of **blocking** items, and a list of **advisory** items. Each `ReadinessItem`
carries:

- `code` — a stable machine identifier (`missing_thumbnail`, `no_sections`, `empty_section`,
  `lecture_video_missing`, `lecture_video_processing`, `lecture_video_failed`, `quiz_no_questions`,
  `quiz_incomplete_question`, plus advisories `no_language`, `no_goals`, `no_quizzes`)
- `severity` — `blocking` | `advisory`
- `message` — human text, already phrased for display
- `target` — the offending object's kind and id (`{"kind": "lecture", "id": 42, "section_id": 7}`)

One service answers three questions (FR-013/014/017/024): may this publish, what does the checklist show,
does this live course need attention. `needs_attention` is simply `is_published and not is_publishable`.

**Rationale**: FR-015 requires naming the *specific* offending items and FR-018 requires deep-linking to
them, so a boolean or a list of sentences is not enough — the client needs ids. Codes rather than parsed
prose keep the client's routing logic honest and let copy change without breaking links. Severity as data
(rather than two separately-shaped lists in the JSON) lets one renderer handle both while still grouping
them visually.

**Alternatives considered**: a boolean plus a string list (rejected — no deep links, FR-018 unbuildable);
separate endpoints per condition (rejected — N round trips for one question); raising an exception per
failure (rejected — the instructor needs *all* blockers at once, not the first one).

---

## R4 — The gate must be server-side, and that is a fact, not a preference

**Decision**: Readiness is computed on the server. The client never derives it.

**Finding that settles it**: the nested instructor course payload includes sections and their lectures, but
a section's quiz is serialized by `QuizSerializer` as `{id, section, title, questions_count}` — **no
questions, no choices**. Quiz completeness (FR-009e) is therefore not computable from any payload the client
has, at any cost. A client-side gate would either be wrong or require fetching every quiz's content for
every section before enabling a button.

So FR-014's "server-side at the moment of publish" is not a defensive preference here — it is the only
buildable design. The client's checklist renders the server's verdict verbatim.

**Consequence for the quiz predicate**: the "complete question" rule (text, ≥2 choices, exactly one correct)
now exists in two tiers — `isQuestionComplete()` in `featuers/instructor-curriculum/types/` (005, drives the
inline badge in the quiz editor) and the read-side predicate in `readiness.py` (007, drives the gate). This
duplication is accepted as unavoidable and handled as follows: **the server is authoritative**, the
readiness checklist never re-derives anything, and a cross-reference comment at both sites names the other.
The only drift risk left is the quiz editor's local badge disagreeing with the gate, which is cosmetic and
visible.

Note also that the **write-side** invariant and the **read-side** predicate are complementary, not
duplicates: the choices viewset prevents *two* correct choices from ever being stored; readiness detects
*zero* correct choices, too-few choices, and blank text — states the write side legitimately allows while an
instructor is mid-edit.

---

## R5 — Keep the list fast: prefetch once, evaluate in Python

**Decision**: Add `prefetch_related('section_set__lectures', 'section_set__quiz__question__choice')` to
`InstructorCourseViewSet.get_queryset()`, and have `evaluate()` read only prefetched relations.

**Rationale**: FR-025 needs a needs-attention signal for every course in My Courses, so readiness runs once
per owned course on the list call. Without prefetching that is N×4 queries. With it, the whole list costs
the 5 queries it already needs regardless of course count, and each evaluation is pure Python over objects
already in memory. (The list is unpaginated by 004's explicit decision — an instructor's own catalogue is
small and bounded — so this is bounded work.)

Related-name spellings are the existing ones, including the singular `question` and `choice` (sic).

**Alternatives considered**: a separate bulk readiness endpoint (rejected — an extra round trip and a second
shape for the same data); aggregate-query-only needs-attention for the list (rejected — a second, subtly
different implementation of the rules, which is the drift this feature is supposed to prevent); evaluating
readiness only on the detail endpoint and showing no badge in the list (rejected — FR-025).

---

## R6 — Surface the two booleans on the existing serializer

**Decision**: `InstructorCourseSerializer` gains read-only `is_publishable` and `needs_attention`
`SerializerMethodField`s. The student-facing `CourseSerializer` is **not** touched.

**Rationale**: the card needs only the booleans, the workspace needs the full report; this gives each what
it needs without a second request for the list. Keeping it off the student serializer keeps instructor-only
signal off public payloads (FR-030's spirit) and leaves the student contract byte-identical.

---

## R7 — A refused publish is a 400 carrying its reasons

**Decision**:

```json
400 { "error": "This course isn't ready to publish yet.", "blockers": [ { "code": "...", ... } ] }
```

**Rationale**: `CLAUDE.md` requires a meaningful message under `error`, which this has; `blockers` is an
**additive, machine-readable companion** that FR-015 requires and that no existing consumer sees. A 400 is
the honest status — the request did not do what it asked.

**Alternatives considered**: `200` with `is_publishable: false` (rejected — reporting a refusal as success
invites clients to ignore it, and makes the mutation's error path untestable); `409 Conflict` (rejected — the
conflict is with the course's content, not with concurrent state; 400 is the better fit and the codebase's
existing habit); `error` as a pre-joined sentence listing every blocker (rejected — unlinkable, and
unreadable with six blockers).

---

## R8 — Re-evaluate inside the write transaction, with the row locked

**Decision**: `CoursePublishingService.transition()` opens `transaction.atomic()`, re-reads the course with
`select_for_update()`, evaluates readiness **inside** that transaction, asks the state object to transition,
and saves with `update_fields=['is_published']`.

**Rationale**: two requirements converge here. FR-014 demands the gate judge the state *at the moment of
publish* — so readiness computed for the client's checklist, seconds or minutes earlier, must not be the
value the gate trusts. FR-032 demands that concurrent publish/unpublish leave one coherent state and that
the instructor be told the truth — so the row is locked for the duration, making lost updates impossible and
letting the response report the state actually persisted. `update_fields` keeps the write narrow so nothing
else on the course is clobbered by a stale in-memory instance.

**`last_updated` is deliberately not bumped** *(corrected during implementation)*. This section originally
claimed saving would touch `last_updated` because it is `auto_now`. That was wrong on the mechanics: Django
only runs an `auto_now` field's `pre_save` when the field is listed in `update_fields`, so
`update_fields=['is_published']` leaves it alone. It is also the right outcome, not just the accidental one —
students see "Last updated" on the public course detail page (`CourseDetailPage.tsx`), and bumping it on
publish would make an unchanged course that was unpublished and republished look freshly updated. Pinned by
`FacadeIntegrityTests.test_successful_publish_does_not_bump_last_updated`.

**Alternatives considered**: evaluate before the transaction (rejected — reintroduces exactly the
time-of-check/time-of-use gap FR-014 names); optimistic concurrency on `last_updated` (rejected — more
machinery and a worse failure message than a short row lock for a rare, low-contention write).

---

## R9 — Readiness auto-refresh comes free from the existing cache keys

**Decision**: key readiness as `['instructor', 'course', id, 'readiness']`.

**Rationale**: TanStack Query's `invalidateQueries` matches by **prefix** by default, and the existing 005
and 006 mutation hooks already invalidate `['instructor', 'course', courseId]` (sections, lectures, quizzes)
or the whole `['instructor', 'course']` prefix (video upload and delete). Putting readiness under that
prefix means every curriculum and video change refreshes the checklist with **no edits to those hooks** —
which is how FR-020 and FR-026 get satisfied almost for free.

**The one gap, and its fix**: `useQuestionMutations` and `useChoiceMutations` invalidate only
`['instructor', 'quiz-content', quizId]`. Since quiz completeness is a blocker, editing a question or a
choice must refresh readiness too. Fix: add `queryClient.invalidateQueries({ queryKey: ['instructor',
'course'] })` to each — one line apiece, and exactly what `useUploadVideo` and `useDeleteVideo` already do,
so it needs no new argument threading (these hooks only know `quizId`, not the course id).

**Alternatives considered**: `refetchInterval` on the readiness query (rejected — polling for state the
client already knows changed, and the 006 spec went out of its way to bound polling); `staleTime: 0` plus
refetch-on-mount only (rejected — the Overview and the curriculum tab are different routes in the same
workspace, so a change made in one tab would not refresh the other until remount); threading `courseId`
into the quiz hooks (rejected — a wider signature change across the quiz editor for no benefit over the
prefix invalidation already used elsewhere).

---

## R10 — Throttle the transitions

**Decision**: new `course_publish` scope in `DEFAULT_THROTTLE_RATES`, applied to the publish and unpublish
actions. `20/min` — orders of magnitude above any human publishing rate.

**Rationale**: consistent with the posture 006 established for `video_signature` and `video_webhook`. A
publish/unpublish cycle is a student-visible catalog change; leaving it unbounded allows catalog churn and
needless write load for free. The readiness action is a cheap authenticated read on the caller's own data and
is left on the default (unscoped) path, as the other instructor reads are.

### How the scope is applied — not via `@action`

On a standalone `APIView` a scope is a class attribute (`throttle_scope = 'video_signature'`, as the video
views do). That does **not** transfer to an action: `throttle_scope` is not an attribute `APIView` defines, so
DRF's initkwargs validation rejects `@action(..., throttle_scope='course_publish')`. And setting it at class
level on the viewset would apply it to **every** route including `list`, `retrieve`, `create`, and `destroy` —
silently throttling the CRUD endpoints 004 already ships.

The mechanism that scopes it to exactly these two actions is `get_throttles()`:

```python
def get_throttles(self):
    # Publishing is a student-visible catalog change; the CRUD routes stay on the
    # project default. throttle_scope can't be passed via @action (not an APIView
    # attribute, so initkwargs validation rejects it) and must not be set at class
    # level, which would throttle list/retrieve/create/destroy too.
    if self.action in ('publish', 'unpublish'):
        self.throttle_scope = 'course_publish'
        return [ScopedRateThrottle()]
    return super().get_throttles()
```

Two things this relies on, both already true in this project:

- **Mutating `self` here is safe.** DRF instantiates the view once per request (`as_view()` → a fresh
  instance), so the assigned scope cannot leak across requests.
- **The fallthrough does not throttle.** `DEFAULT_THROTTLE_CLASSES` is `ScopedRateThrottle`, and that class
  allows the request outright when the view carries no `throttle_scope`. That is why the existing instructor
  viewsets work today with no scope declared, and why `super().get_throttles()` is the correct no-op for
  `readiness` and for every CRUD route.

**Alternative considered**: a dedicated throttle class (`class CoursePublishThrottle(ScopedRateThrottle):
scope = 'course_publish'`) passed as `@action(..., throttle_classes=[CoursePublishThrottle])` — which does
work, since `throttle_classes` *is* an `APIView` attribute. Rejected as a third way to spell a throttle in
one codebase: 006 established the `throttle_scope` + `DEFAULT_THROTTLE_RATES` idiom, and `get_throttles()`
stays inside it.

---

## R11 — Use data the payload already carries for the unpublish confirmation

**Decision**: the confirmation dialog states both halves of the consequence (FR-006) and, when
`subscribers_count > 0`, names the number of enrolled students who keep access. No new endpoint, no
enrollment query.

**Rationale**: `subscribers_count` is already on the instructor course payload and already maintained by
`FulfillmentFacade` on purchase and refund. Saying "12 enrolled students keep full access" is materially more
reassuring than the abstract promise, and costs nothing. It is presented as a count of enrolled students, not
as a precise live figure, so a denormalised counter is an appropriate source.

---

## R12 — The live-course reminder is static

**Decision**: FR-027's reminder is an inline notice rendered on the edit form when the course is published.
No backend involvement, no tracking of what changed.

**Rationale**: the requirement is to *inform*, and the information is fully determined by `is_published`.
Anything more (diffing changes, notifying students, staging edits) is explicitly out of scope in the spec —
versioning is the thing this notice exists *instead of*.
