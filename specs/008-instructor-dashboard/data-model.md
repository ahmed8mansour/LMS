# Data Model: Instructor Dashboard — At-a-Glance Summary Landing

**Feature**: `008-instructor-dashboard` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

## 1. Summary

**No schema change. No migration.** Every value on the dashboard is computed on read from existing tables.
This document defines (a) which existing fields each value is derived from, (b) the computed DTOs the
service builds, and (c) the invariants the implementation must hold.

---

## 2. Existing entities read (unchanged)

| Model | App | Fields read | Used for |
|-------|-----|-------------|----------|
| `InstructorProfile` | authentication | `id`, `title`, `about`, `user` | ownership anchor; onboarding step 1 |
| `CustomUser` | authentication | `first_name`, `last_name`, `username`, `profile_picture` | greeting name; student/reviewer display name + avatar. **`email` is never read into the response.** |
| `StudentProfile` | authentication | `user` | reviewer → user |
| `Course` | course | `id`, `title`, `is_published`, `created_at`, `instructor`, + everything `PublishReadinessService` reads | course tiles, readiness, needs attention, onboarding |
| `Section` / `Lecture` / `Quiz` / `Question` / `Choice` | course | via `READINESS_PREFETCH` only | readiness verdict (spec 007) |
| `Enrollment` | enrollment | `user`, `course`, `is_active`, `enrolled_at`, `id` | Students tile, per-course active students, recent enrollments |
| `Order` | enrollment | `course`, `status`, `amount` | Earnings tile |
| `Review` | reviews | `id`, `user`, `course`, `rating`, `comment`, `created_at` | recent reviews; rating via `get_instructor_rating` |

Reverse relation names relied on: `Course.enrollment_set` (query name `enrollment`), `Course.order_set`
(`order`), `Course.reviews`, `Course.section_set`, `Section.lectures`, `Section.quiz`,
`Quiz.question`, `Question.choice`.

---

## 3. Derived metrics

| Metric | Derivation | Null/empty rule |
|--------|-----------|-----------------|
| `courses.total` | count of `Course` where `instructor = profile` | `0` |
| `courses.published` | subset with `is_published = True` | `0` |
| `students.distinct` | `COUNT(DISTINCT Enrollment.user)` where `course.instructor = profile ∧ is_active` | `0` |
| `students.enrollments` | `COUNT(Enrollment.id)` over the same filter | `0` |
| `rating.avg_rating` | `get_instructor_rating(profile).avg_rating` — published courses only, rounded to 1 dp | `null` ⇒ "Not yet rated" |
| `rating.reviews_count` | `get_instructor_rating(profile).reviews_count` | `0` |
| `earnings.amount` | `SUM(Order.amount)` where `course.instructor = profile ∧ status = 'paid'` | `NULL` ⇒ `"0.00"` |
| `active_students(course)` | `COUNT(Enrollment)` where `course = c ∧ is_active` | `0` |

**Lifecycle facts these definitions depend on** (verified in code, not introduced here):
- Paid checkout: `FulfillmentFacade.activate_enrollment` sets `Order.status='paid'` and creates an active
  `Enrollment`.
- Free enrollment: creates `Order(status='paid', amount=0)` and an active `Enrollment`.
- Refund: `FulfillmentFacade.deactivate_enrollment` sets `Order.status='refunded'` and the enrollment
  `is_active=False` in one transaction.
- Unpublish (007): touches only `Course.is_published`.
- Course delete: cascades to sections, enrollments, orders, and reviews.

---

## 4. Computed DTOs (`backend/apps/course/dashboard/dto.py`)

Frozen dataclasses with tuples for sequences, following `publishing/dto.py`. None are persisted.

### `PersonRef`
| Field | Type | Notes |
|-------|------|-------|
| `name` | `str` | `f"{first_name} {last_name}".strip()` or `username` |
| `avatar` | `str \| None` | `profile_picture` |

### `CourseRef`
| Field | Type |
|-------|------|
| `id` | `int` |
| `title` | `str` |

### `RecentEnrollment`
| Field | Type |
|-------|------|
| `id` | `int` (enrollment id) |
| `enrolled_at` | `datetime` |
| `student` | `PersonRef` |
| `course` | `CourseRef` |

### `RecentReview`
| Field | Type | Notes |
|-------|------|-------|
| `id` | `int` | |
| `rating` | `int` | 1–5 |
| `comment` | `str` | may be `""`; full text, client truncates |
| `created_at` | `datetime` | |
| `reviewer` | `PersonRef` | |
| `course` | `CourseRef` | |

### `AttentionItem`
| Field | Type | Notes |
|-------|------|-------|
| `type` | `AttentionType` | see §5 |
| `course` | `CourseRef` | |
| `is_published` | `bool` | |
| `blocker_count` | `int` | `len(report.blockers)` |
| `active_students` | `int` | per-course annotation |
| `failed_lecture_ids` | `tuple[int, ...]` | from `lecture_video_failed` blocker targets; empty unless relevant |
| `target` | `AttentionTarget` | where to act, §6 |
| `created_at` | `datetime` | ordering only — **not serialised** |

### `AttentionTarget`
| Field | Type | Notes |
|-------|------|-------|
| `kind` | `'course' \| 'lecture'` | |
| `course_id` | `int` | always present |
| `lecture_id` | `int \| None` | set only when `kind == 'lecture'` |

### `NeedsAttention`
| Field | Type | Notes |
|-------|------|-------|
| `total` | `int` | number of classified courses (before the cap) |
| `items` | `tuple[AttentionItem, ...]` | ranked, at most 5 |

### `OnboardingProgress`
| Field | Type | Derivation |
|-------|------|-----------|
| `profile_complete` | `bool` | `profile.title.strip() and profile.about.strip()` |
| `has_course` | `bool` | `courses.total > 0` |
| `has_curriculum` | `bool` | any course with a section containing ≥ 1 lecture |
| `has_ready_video` | `bool` | any lecture with `video_status == 'COMPLETED'` |
| `has_published_course` | `bool` | `courses.published > 0` |

All five are computed truthfully in every mode from the prefetched course set (no extra queries). While
`mode == 'onboarding'` the last four are necessarily `false`.

### `DashboardSnapshot`
| Field | Type |
|-------|------|
| `mode` | `'onboarding' \| 'full'` |
| `instructor_name` | `str` |
| `courses` | `{total: int, published: int}` |
| `students` | `{distinct: int, enrollments: int}` |
| `rating` | `{avg_rating: float \| None, reviews_count: int}` |
| `earnings` | `{amount: Decimal, currency: 'USD'}` |
| `recent_enrollments` | `tuple[RecentEnrollment, ...]` (≤ 5) |
| `recent_reviews` | `tuple[RecentReview, ...]` (≤ 5) |
| `needs_attention` | `NeedsAttention` |
| `onboarding` | `OnboardingProgress` |

---

## 5. Needs-attention classification (state derivation)

Evaluated per course from its `ReadinessReport` (spec 007). First match wins, so each course yields at most
one item.

```text
                 report.needs_attention?  ── yes ──▶ live_needs_attention   (rank 1)
                         │ no
                 course.is_published?     ── yes ──▶ (healthy, no item)
                         │ no  (draft)
     any blocker code == lecture_video_failed? ── yes ──▶ video_failed      (rank 2)
                         │ no
                 report.is_publishable?   ── yes ──▶ ready_to_publish       (rank 3)
                         │ no
                         └──────────────────────────▶ draft_in_progress     (rank 4)
```

`AttentionType = 'live_needs_attention' | 'video_failed' | 'ready_to_publish' | 'draft_in_progress'`

### Ordering (clarification Q2, FR-017a)

Sort ascending by `(rank, secondary, -created_at, -course_id)`:

| Type | `secondary` |
|------|-------------|
| `live_needs_attention` | `-active_students` |
| `video_failed` | `-active_students` |
| `ready_to_publish` | `0` |
| `draft_in_progress` | `blocker_count` |

Take the first 5; `total` is the full classified count.

---

## 6. Link targets

| Type | Condition | `target` | Client route |
|------|-----------|----------|--------------|
| `live_needs_attention` | — | `{kind:'course', course_id}` | `/instructor/courses/{course_id}` |
| `video_failed` | exactly 1 failed lecture | `{kind:'lecture', course_id, lecture_id}` | `/instructor/courses/{course_id}/curriculum/lectures/{lecture_id}` |
| `video_failed` | > 1 failed lecture | `{kind:'course', course_id}` | `/instructor/courses/{course_id}` |
| `ready_to_publish` | — | `{kind:'course', course_id}` | `/instructor/courses/{course_id}` |
| `draft_in_progress` | — | `{kind:'course', course_id}` | `/instructor/courses/{course_id}` |

Recent enrollment and review entries link to `/instructor/courses/{course.id}` (FR-011).
Onboarding step 1 → `/instructor/settings`; steps 2–5 → `/instructor/courses/new` (FR-021, FR-024).

---

## 7. Invariants

| # | Invariant | Enforced by |
|---|-----------|-------------|
| I1 | Every row read is scoped to the caller's own `InstructorProfile`; the endpoint accepts no ids | service takes only `profile`; every query filters on it |
| I2 | Readiness is 007's verdict, never re-derived | `attention.classify` reads only `ReadinessReport` |
| I3 | A course appears at most once in needs attention | first-match classification |
| I4 | Processing videos are never flagged | `video_failed` matches only `lecture_video_failed` |
| I5 | Ranking is deterministic | unique final tiebreak `-course_id` |
| I6 | The snapshot is all-or-nothing | DTO fully built before serialisation; view returns `500 {error}` on any exception |
| I7 | No contact details in the response | `PersonRef` has no email field |
| I8 | Query count is independent of course count | aggregates + shared `READINESS_PREFETCH`; pinned by `assertNumQueries` |
| I9 | Nothing is written | read-only service; `GET` only |

---

## 8. Frontend types (`front-end/src/featuers/instructor-dashboard/`)

Types are **inferred from the Zod schema** in `schemas/instructorDashboard.schma.ts` so the runtime check and
the static type cannot drift (research R11). Money stays a `string`; timestamps stay ISO strings.

```text
DashboardSnapshot
├── mode: 'onboarding' | 'full'
├── instructor_name: string
├── courses: { total: number; published: number }
├── students: { distinct: number; enrollments: number }
├── rating: { avg_rating: number | null; reviews_count: number }
├── earnings: { amount: string; currency: 'USD' }
├── recent_enrollments: { id; enrolled_at; student: PersonRef; course: CourseRef }[]
├── recent_reviews: { id; rating; comment; created_at; reviewer: PersonRef; course: CourseRef }[]
├── needs_attention: { total: number; items: AttentionItem[] }
│     AttentionItem { type: AttentionType; course: CourseRef; is_published; blocker_count;
│                     active_students; failed_lecture_ids: number[];
│                     target: { kind: 'course' | 'lecture'; course_id; lecture_id: number | null } }
└── onboarding: { profile_complete; has_course; has_curriculum; has_ready_video; has_published_course }
```

`attentionHref(item)` switches exhaustively over `AttentionType` with a `never` default.
