# Implementation Plan: Course Publishing & Readiness Gate

**Branch**: `007-course-publishing` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-course-publishing/spec.md`

## Summary

Give the instructor the publish action 004 deliberately left as a placeholder, and put a legible gate in
front of it. Three things get built:

1. **A lifecycle the transitions live in.** Following the product owner's direction, the draft/published
   lifecycle is modelled with the **State pattern** — a `CourseState` interface with `DraftState` and
   `PublishedState` implementations behind a factory, mirroring the `PaymentGateway` ABC → adapter →
   `get_payment_gateway()` shape already in `apps/enrollment/payments/` and the provider factory in
   `apps/course/video/`. Each state owns what it permits: `DraftState.publish()` consults the readiness
   gate and refuses with reasons; `DraftState.unpublish()` is a no-op; `PublishedState.unpublish()` flips
   freely; `PublishedState.publish()` is a no-op. The idempotency of FR-005 and the asymmetric gate of
   FR-009/FR-016 stop being scattered `if` branches and become one small transition matrix (research R1).
2. **`PublishReadinessService` — one definition of "ready", itemized.** It returns a `ReadinessReport` of
   `ReadinessItem`s, each with a stable machine `code`, a severity (blocking vs advisory), a human message,
   and the **id of the offending section / lecture / quiz** so the client can deep-link to it (FR-015,
   FR-018). The same service answers three questions with one implementation: may this publish proceed
   (FR-014), what should the checklist show (FR-017), and does this live course need attention (FR-024).
3. **The instructor surface.** A publish panel and readiness checklist on the Course Overview replacing the
   004 placeholder, an unpublish confirmation that states both halves of the consequence, a
   needs-attention badge in My Courses, and a live-course reminder on the edit form.

**No database migration.** The lifecycle rides on the existing `Course.is_published` boolean; the state
object is *derived* from it, never stored. Readiness is computed on demand, never persisted (FR-013) —
which is the point: a stored flag would go stale the moment a video is removed. `published_at`, audit
history, and an `archived` state are all out of scope, so no field is added or changed.

Two findings shape the build and are worth reading before estimating it:

- **The gate cannot be computed on the client, even partially.** The nested course payload carries sections
  and lectures but a quiz only as `{id, title, questions_count}` — no questions, no choices. Quiz
  completeness is therefore unknowable client-side, which settles FR-014's "server is the gate" as the only
  buildable design rather than a preference (R4).
- **Readiness auto-refresh is almost free.** Keying readiness as `['instructor', 'course', id, 'readiness']`
  puts it under the prefix that every existing curriculum, lecture, and video mutation already invalidates,
  so FR-020 and FR-026 fall out of TanStack Query's default prefix matching with **no edits to the 005/006
  hooks** — except question and choice mutations, which today invalidate only their quiz key and need one
  line each (R9).

### Phasing

- **Phase 1 — backend: the lifecycle, the gate, and the tests.** The `publishing/` package, the two viewset
  actions plus the readiness action, the two computed serializer fields, the prefetch that keeps the list
  from going N+1, a throttle scope, and `tests_publishing.py`. Independently verifiable end-to-end with an
  HTTP client; nothing here needs the UI.
- **Phase 2 — frontend: the instructor experience.** Publish panel, readiness checklist with deep links,
  unpublish confirmation, needs-attention badge, live-course edit reminder, and the two invalidation lines
  in the curriculum hooks.

The split is clean this time — unlike 006, Phase 1 breaks nothing if shipped alone. The existing Overview
placeholder keeps working untouched until Phase 2 replaces it.

## Technical Context

**Language/Version**: Python 3 / Django 6.0 + DRF backend; TypeScript 5 (Next.js 16.1 / React 19.2) frontend
**Primary Dependencies**: Backend — DRF `ModelViewSet` + `@action`, `ScopedRateThrottle`,
`transaction.atomic` + `select_for_update`, `prefetch_related`, `abc.ABC`. Frontend — TanStack Query
(`useQuery`/`useMutation`), existing atoms (`button`, `alert-dialog`, `skeleton`), `lucide-react` icons.
**No new dependency in either tier.**
**Storage**: PostgreSQL — **no migration.** `Course.is_published` is reused as-is; readiness and the
needs-attention flag are computed, not stored.
**Testing**: Backend — Django `APITestCase` in `backend/apps/course/tests_publishing.py`: the state
transition matrix (publish/unpublish × draft/published, including both idempotent no-ops), every blocking
condition of FR-009 in isolation and in combination, advisory items never blocking, ownership refusal on all
three actions, the no-instructor-profile path, server-side re-evaluation against a stale client, and the
serializer's computed fields. Video provider mocked where a lecture needs a ready video; no test touches
Cloudinary or Stripe.
**Target Platform**: Responsive web (desktop-first instructor workspace)
**Project Type**: Web application (Next.js frontend + Django REST backend)
**Performance Goals**: Readiness for one course is O(1) queries via prefetched relations; the My Courses
list evaluates every owned course within the 5 prefetch queries it already needs, not N per course. No new
round trip on the Overview beyond one readiness fetch.
**Constraints**: Ownership enforced by the existing instructor queryset filter on every action (FR-028);
the gate re-evaluated server-side inside the write transaction (FR-014, FR-032); publish status never
writable through a metadata path (FR-003); the system never changes publish status on its own (FR-023); no
raw exceptions to clients (FR-033); no new infrastructure (no queue, scheduler, cache, or realtime layer);
student-facing serializers and queries untouched (FR-034)
**Scale/Scope**: Phase 1 — 4 new files in a new `publishing/` package, 3 edited backend files, 1 new test
module, 0 migrations. Phase 2 — 3 new components, 2 new hooks, 4 edited frontend files, 2 one-line
invalidation additions. Courses up to 20 sections / 200 lectures (SC-013)

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ PASS | `ReadinessItem` / `ReadinessReport` / `ReadinessCode` are explicit TS types mirroring the contract; `ReadinessCode` is a string-literal union so the code→route map in `readinessHref()` is exhaustiveness-checked by `tsc` — an unmapped new code becomes a compile error, not a dead link. No `any`. No new form, so no new Zod schema; the readiness response is a read shape, typed at the API boundary. Backend DTOs are frozen dataclasses. |
| II. Component-First Architecture | ✅ PASS | Three new components with explicit prop interfaces: `PublishPanel` (organism-ish, composes the rest), `ReadinessChecklist` (presentational, takes a report), `UnpublishDialog` (wraps the existing `alert-dialog` atom, same shape as the existing `DeleteCourseDialog`). No new atoms needed. |
| III. Security-First Development | ✅ PASS | Ownership comes from `InstructorCourseViewSet.get_queryset()` rather than a hand-written per-view check — using `@action` instead of a standalone `APIView` means the ownership filter **cannot be forgotten**, which is the §13.5 concern in the discovery doc. `CookieJWTAuthentication` + `isInstructor` unchanged. Publish status stays read-only on the metadata serializer, so no mass-assignment path exists. `select_for_update` prevents a lost-update race on a student-visible, revenue-bearing flag. New throttle scope on the transitions. ORM only. |
| IV. Testing Discipline | ✅ PASS | `tests_publishing.py` covers the service and state layer (mandated for models/services) and the full HTTP path for all three actions. The state matrix and each FR-009 condition get a test apiece, so a regression names itself. |
| V. Documentation as Code | ✅ PASS | This plan plus research/data-model/contract/quickstart. The non-obvious "why" is commented at each site: why readiness is computed not stored, why the gate re-runs inside the transaction, why the client's `isQuestionComplete` is not the gate, and the cross-reference between the write-side one-correct-choice invariant and the read-side completeness predicate. |

**Result**: PASS — no violations. Complexity Tracking not required.

**On the State pattern and "complexity MUST be justified"**: two states today is thin ground for a pattern,
and the honest framing is that a plain `if course.is_published` would also work. It is adopted because
(a) the product owner asked for it, (b) the transitions are *asymmetric* — publish is gated, unpublish is
not, and each direction has an idempotent no-op — so the logic is a 2×2 matrix with per-cell behaviour
rather than a single branch, and (c) the discovery document already anticipates an archived state, which is
the seam this buys. It is kept deliberately small: the state classes own **transitions only**, and the
readiness rules live in their own service. Folding the gate into `DraftState` would produce exactly the
god-object this pattern is supposed to prevent. Full reasoning and the rejected alternatives are in
research R1.

**Migration note (not a violation)**: Constitution "Backend changes affecting models MUST include migration
files" — no model is changed, so no migration is required or created. Recorded explicitly so a reviewer does
not look for a missing one.

**Backward-compatibility note**: "API contracts remain backward compatible" is met. The only change to an
existing response is two **additive** read-only fields (`is_publishable`, `needs_attention`) on
`InstructorCourseSerializer`, whose only consumers are the instructor pages on this branch. The
student-facing `CourseSerializer` is not touched. `is_published` remains read-only on the instructor
metadata path exactly as it is today — this feature adds a separate action rather than opening that field.

## Project Structure

### Documentation (this feature)

```text
specs/007-course-publishing/
├── plan.md                      # This file
├── spec.md                      # What/why — 5 stories, 37 FRs, 14 SCs
├── research.md                  # Phase 0 — decisions (state pattern, action surface, readiness,
│                                #   refusal shape, atomicity, cache keys)
├── data-model.md                # Phase 1 — the state machine, the readiness report, codes, no migration
├── quickstart.md                # Manual verification walkthrough
├── contracts/
│   └── course-publishing.md     # readiness / publish / unpublish + serializer fields + test checklist
├── checklists/
│   └── requirements.md          # specification quality gate
└── tasks.md                     # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/apps/course/
├── publishing/                       # NEW package — mirrors video/ and enrollment/payments/ shape
│   ├── __init__.py                   # public surface: get_course_state, PublishReadinessService,
│   │                                 #   CoursePublishingService, DTOs
│   ├── dto.py                        # ReadinessItem, ReadinessReport, TransitionResult (frozen dataclasses)
│   ├── states.py                     # CourseState(ABC) → DraftState | PublishedState + get_course_state()
│   ├── readiness.py                  # PublishReadinessService: the FR-009 conditions + advisories,
│   │                                 #   read-side question-completeness predicate
│   └── service.py                    # CoursePublishingService facade: atomic, locks the row,
│                                     #   re-evaluates, delegates to the state, persists
├── views.py                          # + @action readiness (GET), publish (POST), unpublish (POST)
│                                     #   on InstructorCourseViewSet; + prefetch_related in get_queryset;
│                                     #   + get_throttles() scoping course_publish to the two transitions
│                                     #   only (not to the CRUD routes) — research R10
├── serializers.py                    # InstructorCourseSerializer + is_publishable, needs_attention
│                                     #   (read-only, computed; student CourseSerializer untouched)
└── tests_publishing.py               # NEW: state matrix, each FR-009 condition, advisories, ownership,
                                      #   stale-client re-evaluation, serializer fields

backend/config/
└── settings.py                       # + throttle rate: course_publish

front-end/src/featuers/instructor-courses/
├── api/instructorCourses.api.ts      # + readiness(id), publish(id), unpublish(id) on instructorCoursesAPI
├── types/instructorCourses.types.ts  # + ReadinessCode/Item/Report, needs-attention status,
│                                     #   readinessHref(courseId, item); InstructorCourse gains two fields
├── hooks/
│   ├── useCourseReadiness.tsx        # NEW: query at ['instructor','course',id,'readiness']
│   └── usePublishCourse.tsx          # NEW: publish + unpublish mutations, cache invalidation
├── components/
│   ├── PublishPanel.tsx              # NEW: status, the action, blocked reason, needs-attention banner
│   ├── ReadinessChecklist.tsx        # NEW: blockers vs advisories, deep links, loading/error states
│   ├── UnpublishDialog.tsx           # NEW: confirmation naming both halves of the consequence
│   ├── CourseOverview.tsx            # replaces the 004 read-only status placeholder with PublishPanel
│   ├── InstructorCourseCard.tsx      # + needs-attention badge alongside the status badge
│   └── CourseForm.tsx                # + live-course reminder when editing a published course (FR-027)
└── index.ts                          # export the new hooks, components, and types

front-end/src/featuers/instructor-curriculum/hooks/
├── useQuestionMutations.tsx          # + invalidate ['instructor','course'] so readiness refreshes
└── useChoiceMutations.tsx            # + same (precedent: the 006 video hooks already do this)
```

**Structure Decision**: Web application. The backend addition is a new `publishing/` subpackage inside
`apps/course` — the same organisational move `video/` made, and the same ABC → implementations → factory +
`dto.py` shape as `apps/enrollment/payments/`. Nothing is added to `apps/course/views.py` beyond three thin
actions that delegate; the business rules live in the package, keeping views thin per the conventions doc.
No new app, no new URL module (the router generates the action routes), no new model.

The frontend deliberately **extends the existing `instructor-courses` feature module** rather than creating
an `instructor-publishing` one. Publishing is a property of a course, its only entry points are the Course
Overview and the My Courses card, and it needs no store, schema, or page of its own — a separate module
would split one concern across two folders for no gain. Three endpoints join the existing
`instructorCoursesAPI` namespaced object, preserving the one-API-object-per-feature convention.

## Complexity Tracking

No constitution violations — table intentionally omitted. The one judgement call that *looks* like added
complexity (the State pattern over a boolean with two values) is argued in the Constitution Check above and
in research R1, including the alternatives rejected.
