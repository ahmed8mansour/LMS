# Contract: Instructor Dashboard Snapshot

**Feature**: `008-instructor-dashboard` | **Spec**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

## `GET /courses/instructor/dashboard/`

Returns the signed-in instructor's complete dashboard as one consistent snapshot (FR-026). Read-only.

| Aspect | Value |
|--------|-------|
| Auth | `CookieJWTAuthentication` (HttpOnly `access_token` cookie) |
| Permissions | `IsAuthenticated`, `isInstructor` |
| Throttle scope | `instructor_dashboard` — `60/min` |
| Parameters | **None.** No path, query, or body parameters are read. Scope comes only from the session. |
| Pagination | None (bounded lists: ≤ 5 each) |
| Caching | None server-side; client refetches on every mount (research R11) |

### 200 OK — full mode

```json
{
  "mode": "full",
  "instructor_name": "Ahmed Mansour",
  "courses":  { "total": 6, "published": 4 },
  "students": { "distinct": 1284, "enrollments": 1610 },
  "rating":   { "avg_rating": 4.6, "reviews_count": 213 },
  "earnings": { "amount": "8940.00", "currency": "USD" },
  "recent_enrollments": [
    {
      "id": 5012,
      "enrolled_at": "2026-09-15T18:22:04.113Z",
      "student": { "name": "Sara Ali", "avatar": "https://res.cloudinary.com/.../sara.png" },
      "course":  { "id": 42, "title": "Django for Beginners" }
    }
  ],
  "recent_reviews": [
    {
      "id": 931,
      "rating": 4,
      "comment": "Clear explanations, the ORM section was excellent.",
      "created_at": "2026-09-14T09:10:00.000Z",
      "reviewer": { "name": "Omar K", "avatar": null },
      "course":   { "id": 42, "title": "Django for Beginners" }
    }
  ],
  "needs_attention": {
    "total": 7,
    "items": [
      {
        "type": "live_needs_attention",
        "course": { "id": 42, "title": "Django for Beginners" },
        "is_published": true,
        "blocker_count": 1,
        "active_students": 318,
        "failed_lecture_ids": [],
        "target": { "kind": "course", "course_id": 42, "lecture_id": null }
      },
      {
        "type": "video_failed",
        "course": { "id": 51, "title": "React Fundamentals" },
        "is_published": false,
        "blocker_count": 2,
        "active_students": 0,
        "failed_lecture_ids": [108],
        "target": { "kind": "lecture", "course_id": 51, "lecture_id": 108 }
      },
      {
        "type": "ready_to_publish",
        "course": { "id": 60, "title": "Advanced SQL" },
        "is_published": false,
        "blocker_count": 0,
        "active_students": 0,
        "failed_lecture_ids": [],
        "target": { "kind": "course", "course_id": 60, "lecture_id": null }
      },
      {
        "type": "draft_in_progress",
        "course": { "id": 63, "title": "Figma Basics" },
        "is_published": false,
        "blocker_count": 3,
        "active_students": 0,
        "failed_lecture_ids": [],
        "target": { "kind": "course", "course_id": 63, "lecture_id": null }
      }
    ]
  },
  "onboarding": {
    "profile_complete": true,
    "has_course": true,
    "has_curriculum": true,
    "has_ready_video": true,
    "has_published_course": true
  }
}
```

### 200 OK — onboarding mode (instructor owns no courses)

The shape is **identical**; only values differ. Clients render the onboarding checklist when
`mode == "onboarding"` and ignore the other sections.

```json
{
  "mode": "onboarding",
  "instructor_name": "New Instructor",
  "courses":  { "total": 0, "published": 0 },
  "students": { "distinct": 0, "enrollments": 0 },
  "rating":   { "avg_rating": null, "reviews_count": 0 },
  "earnings": { "amount": "0.00", "currency": "USD" },
  "recent_enrollments": [],
  "recent_reviews": [],
  "needs_attention": { "total": 0, "items": [] },
  "onboarding": {
    "profile_complete": false,
    "has_course": false,
    "has_curriculum": false,
    "has_ready_video": false,
    "has_published_course": false
  }
}
```

### Field rules

| Field | Rule |
|-------|------|
| `mode` | `"onboarding"` iff `courses.total == 0`, else `"full"` (FR-020, FR-022) |
| `instructor_name` | `"{first_name} {last_name}"` trimmed, else `username` |
| `courses.published` | ≤ `courses.total` |
| `students.distinct` | distinct users with ≥ 1 active enrollment in the caller's courses (FR-005) |
| `students.enrollments` | active enrollments in the caller's courses; ≥ `students.distinct` |
| `rating.avg_rating` | number with 1 decimal, or `null` when no reviews on published courses (FR-006) |
| `earnings.amount` | decimal string, 2 places; sum of `paid` orders; `"0.00"` when none (FR-007) |
| `earnings.currency` | always `"USD"` |
| `recent_enrollments` | ≤ 5, active only, ordered `enrolled_at` desc then `id` desc (FR-009) |
| `recent_reviews` | ≤ 5, any of the caller's courses, ordered `created_at` desc then `id` desc (FR-010) |
| `*.avatar` | URL string or `null` |
| `comment` | full text (≤ 2,000 chars) or `""`; client truncates |
| `needs_attention.total` | count of all classified courses; `items.length == min(total, 5)` (FR-017) |
| `needs_attention.items` | ranked per data-model §5; each `course.id` appears at most once (FR-013, FR-017a) |
| `type` | one of `live_needs_attention`, `video_failed`, `ready_to_publish`, `draft_in_progress` |
| `failed_lecture_ids` | ids of lectures with `lecture_video_failed` blockers; non-empty only for `video_failed` and possibly `live_needs_attention` |
| `target.kind` | `"lecture"` only for `video_failed` with exactly one failed lecture; otherwise `"course"` |
| `target.lecture_id` | set iff `kind == "lecture"`, else `null` |
| **Never present** | any `email` key, any other instructor's data, any stack trace |

Clients MUST switch on `type` and `target.kind`, never on titles or counts.

### Errors

| Status | When | Body |
|--------|------|------|
| `401` | Missing/expired session (refresh interceptor retries once) | DRF default `{"detail": "..."}` |
| `403` | Authenticated non-instructor (student) | DRF default `{"detail": "..."}` |
| `403` | Instructor-gated account without an `InstructorProfile` (FR-032) | `{"error": "No instructor profile is associated with this account.", "code": "no_instructor_profile"}` |
| `429` | Throttle exceeded | DRF default `{"detail": "..."}` |
| `500` | Any failure while building the snapshot, including readiness evaluation (FR-027, FR-028) | `{"error": "We couldn't load your dashboard. Please try again."}` — **no partial snapshot keys** |

---

## Frontend consumer contract

| Item | Value |
|------|-------|
| API | `instructorDashboardAPI.getSnapshot()` in `featuers/instructor-dashboard/api/instructorDashboard.api.ts` — parses the body with `DashboardSnapshotSchema` (Zod); a parse failure throws and becomes the error state |
| Hook | `useInstructorDashboard()` → `useQuery({ queryKey: ['instructor', 'dashboard'], queryFn, staleTime: 0, gcTime: 0, refetchOnMount: 'always' })` |
| States | pending → skeleton; `403` with `code === 'no_instructor_profile'` → handled no-profile state; any other error → page-level error + Retry; success → `mode` switch |
| Links | `attentionHref(item)` exhaustive over `AttentionType` (data-model §6) |

---

## Backend test checklist (`apps/course/tests_dashboard.py`)

- [ ] Student → 403; anonymous → 401/403; staff without profile → 403 with `code: no_instructor_profile`
- [ ] Instructor A's response contains none of instructor B's courses, students, reviews, or earnings
- [ ] Response contains no `email` key at any depth
- [ ] `mode` is `onboarding` with 0 courses, `full` with 1 draft
- [ ] `profile_complete` true only when both `title` and `about` are non-blank
- [ ] `courses.total` / `courses.published` match fixtures
- [ ] Student enrolled in 2 courses → `distinct` +1, `enrollments` +2
- [ ] Refunded order excluded from earnings; its inactive enrollment excluded from students and recent list
- [ ] Free enrollment counts in students, adds `0.00` to earnings
- [ ] Pending and failed orders excluded
- [ ] Unpublished course's active enrollments and paid orders still counted
- [ ] `rating` equals `get_instructor_rating(profile)`; `avg_rating` `null` with no published-course reviews
- [ ] Recent enrollments/reviews: newest first, capped at 5
- [ ] Each attention type produced by its fixture; published+ready course absent; processing-only draft is `draft_in_progress`, never `video_failed`
- [ ] Published course with a failed video appears once, as `live_needs_attention`
- [ ] Ordering: 800-student before 3-student live item; 1-blocker before 4-blocker draft; same-type ties newest first
- [ ] 7 classified courses → `total: 7`, 5 items
- [ ] `video_failed` with 1 failed lecture → lecture target; with 2 → course target
- [ ] Readiness evaluation raising → `500 {error}` and no snapshot keys
- [ ] `assertNumQueries` identical for 1 course and 10 courses
- [ ] `attention.classify` / `attention.rank` unit tests without the database
