# API Contract: Lecture Video Upload, Confirmation & Removal

Base: `/courses/video/`

Auth: `CookieJWTAuthentication`. Permissions: `IsAuthenticated`, `isInstructor | isAdmin` — except the
notification endpoint, which is provider-authenticated by signature and takes no session.

Ownership is enforced on every instructor-facing endpoint through
`lecture.section.course.instructor == request.user.instructor_profile` (superusers bypass). A lecture in
another instructor's course is refused, never silently ignored.

Response contract per `CLAUDE.md`: payloads returned **directly**; errors `{ "error": "..." }` or field
errors `{ "field": ["..."] }`. **No `{data,status}` envelope.** No raw exceptions or stack traces.

Migration: one additive field (`Lecture.pending_video_public_id`) — see `data-model.md`.

---

## POST `/courses/video/upload-signature/` — authorise one upload

Issues signed credentials for a direct browser → provider upload of **one video, for one owned lecture**.

**Changed in 006**: `lecture_id` is now **required** (the unbound generic-upload mode is removed, research
R9); the call **no longer mutates** the lecture's live video, status, or duration (R1); and the signed set
now carries size/format limits (R5).

- **Request** (JSON): `lecture_id` (int, **required** — must be a lecture in a course the caller owns).
- **200** →
  ```json
  {
    "signature": "…", "timestamp": 1757203200,
    "api_key": "…", "cloud_name": "…",
    "folder": "", "public_id": "lms/lectures/lecture_42_9f3c…",
    "eager": "sp_auto/m3u8", "eager_async": true, "eager_notification_url": "https://…",
    "max_file_size": 2147483648,
    "allowed_formats": "mp4,mov,webm,mkv,m4v"
  }
  ```
- **400** → `{ "error": "lecture_id is required." }`
- **403** → `{ "error": "You don't have access to this lecture" }`
- **404** → `{ "error": "Lecture not found" }`
- **429** → throttled (`video_signature` scope, 20/min).

**Side effects**: sets `pending_video_public_id` to the newly generated id. If a *different* unconfirmed
pending id was already present, that abandoned asset is destroyed first (best-effort). **`video_public_id`,
`video_status`, and `duration` are not touched** — a lecture with a ready video keeps it, ready, until a
replacement is confirmed.

**Client obligation**: every field in the signed set (`eager`, `eager_async`, `eager_notification_url`,
`public_id`, `allowed_formats`, `timestamp`, `api_key`, `signature`) must be sent to the provider
**verbatim**, or the provider rejects the signature. `folder` is sent only when non-empty.

`max_file_size` is returned but is **not** in the signed set and must **not** be sent to the provider. It
is an upload-*preset* parameter, not an upload-endpoint one: the provider recomputes the signature from
the parameters this endpoint accepts, so including it made the signatures disagree and rejected the upload
with 401 after the entire file had transferred. It is advisory only — the client uses it to refuse an
oversized file before transferring.

---

## POST `/courses/video/<lecture_id>/confirm/` — promote a completed upload

Called by the client once the provider has accepted the upload. Promotes the in-flight asset to be the
lecture's live video. **New in 006.**

- **Request** (JSON): `public_id` (str, required — must equal the lecture's `pending_video_public_id`).
- **200** → the updated lecture (`LectureSerializer`), now `video_status: "PROCESSING"`, `has_video: true`.
- **400** → `{ "error": "public_id is required." }` or
  `{ "error": "This upload is no longer the pending upload for this lecture." }` (stale or mismatched —
  e.g. a second upload was signed after this one).
- **403** / **404** → as above.
- **429** → throttled (`video_signature` scope).

**Side effects**: `video_public_id ← pending_video_public_id`; `pending_video_public_id ← NULL`;
`video_status ← PROCESSING`. The **superseded** live asset is destroyed (best-effort). `duration` is not
touched here — the measured length arrives with the completion notification.

**Idempotency**: calling it twice returns 400 the second time (the pending id is already cleared), which is
safe — the first call already promoted. Clients should treat a mismatch after a successful promotion as
success, not as an error to surface.

**Not required for correctness**: if this call never happens (tab closed, network drop), the completion
notification performs the same promotion. Confirm exists to make the interface honest immediately.

---

## DELETE `/courses/video/<lecture_id>/` — remove the lecture's video

- **204** → no content. *(006 change: was 200-with-body; the client re-reads the lecture.)*
- **403** / **404** → as above.
- **429** → throttled (`video_signature` scope, shared with signing and confirm).

**Side effects**: destroys **both** the live and any pending asset (best-effort);
`video_public_id ← NULL`; `pending_video_public_id ← NULL`; `video_status ← PENDING`. The lecture's
`title`, `order`, and `duration` are **not** touched — duration is an instructor-owned field, and clearing
it would destroy data this action was never asked to touch.

**Available from every state**, including `PROCESSING` (FR-021). A notification that later arrives for a
destroyed asset finds no lecture referencing it and is ignored.

**Provider failure**: if the asset cannot be destroyed, the lecture is **still** reset and the call still
succeeds; the failure is logged server-side. The instructor is never stranded with an unremovable video by
a provider outage (FR-018).

---

## POST `/courses/video/webhook/` — provider processing notification

Called by the media provider, not by any client. No session auth; authenticity is the provider signature.

- **Headers**: `X-Cld-Signature`, `X-Cld-Timestamp`.
- **Request**: the provider's JSON notification body (raw bytes are what is signed).
- **200** → `{ "message": "ok" }` — accepted, ignored-as-duplicate, ignored-as-not-decisive, or
  ignored-because-no-matching-lecture. All four are successes: the notification was handled, and the
  provider must not retry.
- **400** → `{ "error": "Invalid webhook signature" }` — bad signature **or** outside the freshness window.
- **429** → throttled (`video_webhook` scope, 120/min).

**Processing order** (each step can end the request):

1. **Authenticate** — SHA1 over `raw_body + timestamp + secret`, compared with `hmac.compare_digest`.
2. **Freshness** — reject if the timestamp is older than `CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS` (7200s).
3. **Deduplicate** — key `"{notification_type}:{public_id}:{version}"` (or a body hash) against
   `ProcessedWebhookEvent(gateway="cloudinary_video")`. Already seen ⇒ 200, no action.
4. **Classify** — only the eager-transcode outcome is decisive (`error` ⇒ `FAILED`, else `COMPLETED`).
   Any other notification type ⇒ 200, no action.
5. **Locate** — the lecture whose `video_public_id` matches; else the one whose
   `pending_video_public_id` matches, which is **promoted** first (the confirm-call backstop). No match ⇒
   200, no action.
6. **Guard** — apply only if the new status moves the lecture **forward** (`PENDING < PROCESSING <
   COMPLETED`, plus `PROCESSING → FAILED`). A `COMPLETED` lecture is never moved by a notification.
7. **Apply** — write the status; on `COMPLETED` also write `duration`, converted seconds → minutes and
   clamped to `[0.01, 9999.99]`.

---

## Serializer shape (`LectureSerializer`, all lecture reads)

```json
{
  "id": 42, "section": 7, "title": "Installing Python",
  "duration": "4.33", "order": 0,
  "video_status": "COMPLETED",
  "video_url": "https://…/lms/lectures/lecture_42_9f3c….m3u8",
  "has_video": true
}
```

- `video_status` is **read-only**; no client may write it.
- `video_url` is non-null only when the video is `COMPLETED` **and** the caller may stream it (existing
  access rule: owning instructor, admin, or actively enrolled student — unchanged by this feature).
- `has_video` reports whether a **live** asset is attached. It exists so a client can tell a processing
  lecture from an empty one, which `video_url` alone cannot (both are null).
- `video_public_id` and `pending_video_public_id` are **never** serialized.

---

## Test checklist

**Ownership & access**
- [ ] Instructor A signing / confirming / deleting on instructor B's lecture → 403, B's lecture unchanged.
- [ ] Unknown `lecture_id` → 404.
- [ ] Staff account with no instructor profile → refused cleanly, no 5xx.
- [ ] Unauthenticated → 401 on signature/confirm/delete.
- [ ] Superuser may act on any lecture.

**Signature**
- [ ] Missing `lecture_id` → 400.
- [ ] Success sets `pending_video_public_id` and leaves `video_public_id`, `video_status`, `duration`
      **unchanged** on a lecture that already has a `COMPLETED` video.
- [ ] A second signature destroys the first (abandoned) pending asset and replaces the pending id.
- [ ] `allowed_formats` is present in the response AND inside the signed parameter set.
- [ ] `max_file_size` is present in the response but **NOT** in the signed parameter set (regression: signing
      it caused a 401 after a full transfer).

**Confirm**
- [ ] Correct `public_id` → promotes, `PROCESSING`, pending cleared, superseded asset destroyed.
- [ ] Promotion on a lecture with no prior video destroys nothing.
- [ ] Mismatched / stale `public_id` → 400, nothing changes.
- [ ] Missing `public_id` → 400.

**Delete**
- [ ] Destroys live + pending, resets to `PENDING`, → 204.
- [ ] `duration` and `title` survive a delete.
- [ ] Works while `PROCESSING`.
- [ ] Provider `destroy` raising → still 204, lecture still reset, error logged, no stack trace returned.

**Webhook**
- [ ] Invalid signature → 400, no write.
- [ ] Timestamp older than the freshness window → 400, no write.
- [ ] Duplicate delivery → 200, applied exactly once (status and duration written once).
- [ ] Non-decisive notification type → 200, no status change.
- [ ] Out-of-order: `COMPLETED` then a generic/`PROCESSING` notification → stays `COMPLETED`.
- [ ] Notification for an unknown `public_id` → 200, no error.
- [ ] Notification matching only `pending_video_public_id` → promotes, then applies status.
- [ ] `COMPLETED` with `duration: 260` (seconds) → stored `4.33` (minutes).
- [ ] `COMPLETED` with an absurd duration → clamped to `9999.99`, no exception, no retry loop.
- [ ] `COMPLETED` with no duration → status written, `duration` untouched.
- [ ] `error` in payload → `FAILED`.

**Cleanup**
- [ ] Deleting a lecture destroys its live and pending assets.
- [ ] Deleting a section destroys its lectures' assets (cascade).
- [ ] Deleting a course destroys all its lectures' assets (cascade).
- [ ] A destroy failure during cascade does not prevent the deletion.

**Throttling**
- [ ] Signature requests beyond the `video_signature` rate → 429.
- [ ] Webhook requests beyond the `video_webhook` rate → 429.
