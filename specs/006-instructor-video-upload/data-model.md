# Phase 1 Data Model: Instructor Lecture Video Upload

**One additive migration.** This feature adds a single nullable field to `Lecture`
(`pending_video_public_id`) and changes no other model. Everything else is service, view, serializer, and
signal logic. No existing migration is modified and no existing field changes type. All entities live in
`backend/apps/course/models.py`, except the reused webhook-dedupe model in `backend/apps/enrollment/models.py`.

## Entity map

```
Course (owned by InstructorProfile)
└── Section
    └── Lecture                          ← the only model this feature writes
        ├── video_public_id              live asset id        (existing)
        ├── pending_video_public_id      in-flight upload id  (NEW)
        ├── video_status                 PENDING/PROCESSING/COMPLETED/FAILED (existing, semantics tightened)
        └── duration                     decimal MINUTES      (existing, unit now enforced)

ProcessedWebhookEvent (apps.enrollment, reused)   ← notification dedupe, gateway="cloudinary_video"
```

Ownership for every operation resolves through `lecture.section.course.instructor == request.user.instructor_profile`
(superusers bypass). No new ownership path is introduced.

---

## Lecture (existing, one field added)

| Field | Type | Writable by client | Rules |
|-------|------|--------------------|-------|
| `id` | int (pk) | no | — |
| `section` | FK → Section | no (005) | Ownership path root for this feature. |
| `title` | char(255) | yes (005) | Untouched by this feature. |
| `duration` | decimal(6,2) — **minutes** | yes (005) | Instructor enters mm:ss → minutes. **Overwritten with the measured length on COMPLETED**, converted seconds→minutes and clamped. See *Duration rules*. |
| `order` | int | server-managed (005) | Untouched by this feature. |
| `video_public_id` | char(255), null | **never** | The **live** asset. Set only by promotion; cleared only by removal. Managed entirely by the video subsystem. |
| `pending_video_public_id` | char(255), null | **never** | **NEW.** The **in-flight** upload target. Set at signature time; cleared on promotion, removal, or supersession. |
| `video_status` | char(20) choices | **never** (read-only in serializer) | Per *Status rules* below. |

**Serializer exposure** (`LectureSerializer`): `video_status` and `video_url` as today, plus `has_video`
(derived: a live asset is attached). `video_public_id` and `pending_video_public_id` are **never**
serialized to any client — they are internal addresses, and exposing them would let a client name assets
directly.

### Migration

`0018_lecture_pending_video_public_id` — add `pending_video_public_id = CharField(max_length=255, null=True, blank=True)`.
Additive, nullable, no default backfill needed: existing rows correctly have no upload in flight.

---

## Status rules

`video_status` has exactly four meanings (spec FR-009):

| Value | Means | `video_public_id` | `pending_video_public_id` |
|-------|-------|-------------------|---------------------------|
| `PENDING` | **No video attached** | `NULL` | `NULL` or an in-flight id |
| `PROCESSING` | Attached, transcoding | set | `NULL` |
| `COMPLETED` | Ready to stream | set | `NULL` |
| `FAILED` | Transcode failed | set | `NULL` |

**Invariant**: `video_status != PENDING` ⟺ `video_public_id IS NOT NULL`.

A pending id may coexist with any status — that is an upload in flight, which by design does not disturb
the lecture's current video. It is the *live* id that determines status.

### Transitions

| From | To | Trigger | Allowed |
|------|----|---------|---------|
| `PENDING` | `PROCESSING` | Promotion (confirm or notification) | ✅ |
| `PROCESSING` | `COMPLETED` | Successful transcode notification | ✅ |
| `PROCESSING` | `FAILED` | Failed transcode notification | ✅ |
| `COMPLETED`/`FAILED` | `PROCESSING` | Promotion of a **replacement** | ✅ (explicit instructor action) |
| any | `PENDING` | Removal | ✅ (explicit instructor action) |
| `COMPLETED` | `PROCESSING`/`PENDING` | **A notification** | ❌ **Never** — ignored (FR-010) |
| `FAILED` | `PROCESSING` | A late notification | ❌ ignored |

Rank for the guard: `PENDING(0) < PROCESSING(1) < COMPLETED(2)`; `FAILED` is reachable only from
`PROCESSING`. A notification that would move a lecture to a rank at or below its current one is discarded.

---

## Duration rules

Stored unit is **decimal minutes**, always — the 005 convention, consumed by the student experience as
`{duration} min`.

```
# instructor entry (005, unchanged)
"4:20"  ->  4.33 minutes

# provider measurement (this feature)
seconds ->  clamp(round(Decimal(seconds) / 60, 2), 0.01, 9999.99) minutes
260.0   ->  4.33
7384.2  ->  123.07
999999  ->  9999.99   (clamped, not an error)
```

- Written **only** when a completion notification is accepted (deduped, authentic, fresh, forward-moving).
- **Not** written on a `PROCESSING` or `FAILED` notification, or when the provider reports no duration.
- Clamping is mandatory: `decimal(6,2)` caps at `9999.99`, and an overflow inside the notification handler
  becomes a 5xx, which the provider then retries against the same failing input — wedging the lecture in
  `PROCESSING` permanently.

---

## Upload authorisation (transient, not persisted)

The signed credential returned to the browser. Only `public_id` survives the request, on
`Lecture.pending_video_public_id`.

| Field | Source | Notes |
|-------|--------|-------|
| `signature`, `timestamp`, `api_key`, `cloud_name` | provider config | — |
| `public_id` | generated: `lms/lectures/lecture_{id}_{uuid4hex}` | Unique per attempt; never reused. |
| `folder` | constant | Carried in `public_id`; sent as `""` to avoid double-nesting. |
| `eager`, `eager_async`, `eager_notification_url` | settings | Adaptive-streaming transcode request. |
| `max_file_size` | `VIDEO_MAX_UPLOAD_BYTES` (default 2 GiB) | **NEW, returned but NOT signed** — advisory; client-enforced. |
| `allowed_formats` | `VIDEO_ALLOWED_FORMATS` (default `mp4,mov,webm,mkv,m4v`) | **NEW, signed** — provider-enforced. |

**Every field in the signed set must be echoed back by the client verbatim** or the provider rejects the
signature. Adding `allowed_formats` is therefore a coordinated client+server change.

`max_file_size` is the exception: it is returned but deliberately left **out** of the signed set and must
not be sent. It is an upload-*preset* parameter, not an upload-endpoint one, and signing it made the
provider's recomputed signature disagree with ours — rejecting the upload with 401 only after the whole
file had transferred. Size is therefore enforced client-side only; a hard server-side cap needs an
account-level limit or a signed upload preset referenced via `upload_preset`.

---

## Processing notification (transient, not persisted beyond dedupe)

| Field | Use |
|-------|-----|
| `notification_type` | Classification. Only the eager-transcode outcome is decisive; others are ignored. |
| `public_id` | Locate the lecture: match `video_public_id` first, else `pending_video_public_id` (promote). |
| `version` | Part of the dedupe key. |
| `error` | Presence ⇒ `FAILED`. |
| `duration` (seconds) | Converted + clamped into `Lecture.duration` on acceptance. |

**Dedupe key**: `"{notification_type}:{public_id}:{version}"`, or a SHA-256 of the raw body when no
version is present. Stored in the existing `ProcessedWebhookEvent` with `gateway="cloudinary_video"`.

**Authenticity**: provider signature over `raw_body + timestamp + secret`, compared with
`hmac.compare_digest`, plus a freshness window (`CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS`, default 7200s).

**A notification whose `public_id` matches no lecture is acknowledged and ignored** — that is the normal
outcome for an asset that was superseded or whose lecture was deleted, not an error.

---

## ProcessedWebhookEvent (existing, reused)

| Field | Value here |
|-------|-----------|
| `event_id` | The dedupe key above (unique). |
| `gateway` | `"cloudinary_video"` |
| `received_at` | auto |

Reused rather than duplicated: the model is already gateway-agnostic and already used by payments, and
`apps.course` already imports from `apps.enrollment`. No migration.

---

## Asset lifecycle (external, but the point of the integrity rules)

An asset is **destroyed** at exactly these moments, always best-effort (failure logged, never fatal):

| Moment | Asset destroyed |
|--------|-----------------|
| Promotion of a replacement | the superseded **live** asset |
| A new signature superseding an unconfirmed one | the abandoned **pending** asset |
| Removal | both live and pending |
| `Lecture` deleted (directly, or via section/course cascade) | both live and pending |

Any moment where a pointer is lost without a destroy is a permanent, billed leak — nothing in the system
can name that asset again.

---

## Validation summary

| Rule | Enforced where |
|------|----------------|
| Caller owns the lecture | Server, on every video endpoint (authoritative) |
| Signing requires a bound lecture | Server — `lecture_id` required |
| File size ≤ max, format allowed | Client (pre-transfer) **and** provider (signed params) |
| Confirm's `public_id` matches the lecture's pending id | Server |
| `video_status` / `video_public_id` never client-writable | Serializer read-only + never accepted in any payload |
| Status moves forward only via notification | Server, monotonic guard |
| Notification authentic, fresh, and not a duplicate | Server, before any write |
| Duration stored in minutes, clamped | Server, in the notification handler |
