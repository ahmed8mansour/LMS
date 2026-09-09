# Tasks: Instructor Lecture Video Upload

**Input**: Design documents from `/specs/006-instructor-video-upload/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/video-upload.md, quickstart.md

**Tests**: Backend `APITestCase` tests are included and non-optional — Constitution IV mandates tests for
models/services *and* integration tests for webhooks, and the first implementation pass shipped zero video
tests. The provider is mocked throughout; no test touches Cloudinary. Frontend interaction tests are
optional (Constitution IV "SHOULD") and live in Polish.

**Organization**: Grouped by the two delivery phases in `plan.md`. **Phase A** (tasks T001–T021) is the
backend correctness/integrity increment; **Phase B** (T022–T041) is the instructor experience. Within
Phase A, tasks are ordered so the suite is green at the end of each block.

**Status legend**: `(shipped)` the first pass got this right and it is carried forward; `(corrects)` it
replaces something the first pass did wrong; `(new)` not attempted before. Matches the spec's FR tags.

## Path Conventions

- **Backend**: `backend/apps/course/` (Django app `course`), settings in `backend/config/settings.py`.
  **One additive migration** — never edit an existing one.
- **Frontend**: `front-end/src/` — feature module `featuers/instructor-video-uploading/` (house `featuers`
  spelling), shared upload helper in `lib/cloudinary.ts`.

---

# Phase A — Backend correctness & integrity

**Goal**: no data corruption, no orphaned paid media, no unbounded abuse surface, and a lifecycle that
cannot lose a working video. Independently deployable, with the two client edits in T019–T020 keeping the
feature working end to end.

## A1: Model & settings foundation

- [x] T001 Add `pending_video_public_id = CharField(max_length=255, null=True, blank=True)` to `Lecture` in
  `backend/apps/course/models.py`, with a comment stating the live/in-flight split and why it exists
  (research R1, data-model *Lecture*).
- [x] T002 Generate the additive migration `backend/apps/course/migrations/0018_lecture_pending_video_public_id.py`
  via `makemigrations`. Nullable, no backfill. **Do not modify any existing migration** (project Hard Rule).
- [x] T003 [P] *(new)* Add to `backend/config/settings.py`: `VIDEO_MAX_UPLOAD_BYTES` (default 2 GiB),
  `VIDEO_ALLOWED_FORMATS` (default `mp4,mov,webm,mkv,m4v`), `CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS`
  (default 7200), and throttle rates `video_signature: 20/min`, `video_webhook: 120/min` under
  `DEFAULT_THROTTLE_RATES` (research R5, R8).

**Checkpoint**: migration applies cleanly; settings resolve with defaults and no new env var is required.

## A2: Provider contract

- [x] T004 *(corrects)* Extend `UploadCredentials` in `backend/apps/course/video/base.py` with
  `max_file_size: int` and `allowed_formats: str`. Note in the docstring which fields are part of the
  signed set and must be echoed back verbatim — and that `max_file_size` is **not** one of them (see T005a).
- [x] T005 *(corrects)* In `backend/apps/course/video/cloudinary_provider.py`, sign `allowed_formats` into
  `generate_upload_credentials` and return both limits (research R5). Keep the existing
  `public_id`-vs-`folder` handling exactly as is.
- [x] T005a *(fixes a defect this spec introduced)* Remove `max_file_size` from the **signed** set — keep it
  in the returned credentials only. It is an upload-*preset* parameter, not an upload-endpoint one, so
  signing and sending it made Cloudinary's recomputed signature disagree with ours and the upload failed
  with **401 "Invalid Signature"** after the entire file had transferred (research R5, corrected).
  `CloudinarySignedParamsTests` pins the signed set against regression.
- [x] T006 *(corrects)* In the same provider, harden `verify_webhook`: `hmac.compare_digest` instead of
  `==`, plus rejection of timestamps older than `CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS` and of malformed
  timestamps (research R3).
- [x] T007 *(corrects)* Rewrite `parse_webhook` to classify on **`notification_type`** rather than the
  presence of an `eager` array: return a decisive `COMPLETED`/`FAILED` only for the eager-transcode
  outcome, and a non-decisive marker otherwise. Carry `notification_type` and `version` on `WebhookResult`
  for the dedupe key (research R2, R3).

**Checkpoint**: provider unit behaviour is correct in isolation; no view or service touched yet.

## A3: Upload lifecycle services

- [x] T008 *(corrects)* Rework `VideoUploadService.credentials_for` in `backend/apps/course/video/service.py`
  to **reserve only**: require a lecture, generate the public_id into `pending_video_public_id`, destroy any
  previously abandoned pending asset (best-effort), and **leave `video_public_id`, `video_status`, and
  `duration` untouched**. Document why promotion no longer happens here (research R1).
- [x] T009 *(new)* Add `VideoLifecycleService` to the same module with `promote(lecture, public_id)`:
  validate the id matches the lecture's pending id, move pending → live inside `transaction.atomic`, set
  `PROCESSING`, and destroy the **superseded** live asset best-effort. Raise a domain error on mismatch so
  the view can return a clean 400.
- [x] T010 *(corrects)* Move removal onto `VideoLifecycleService.remove(lecture)`: destroy **both** live and
  pending assets best-effort, reset to `PENDING`, and leave `duration`/`title` alone. A provider failure
  MUST still reset the row and MUST NOT propagate (spec FR-018).
- [x] T011 [P] *(new)* Add a shared best-effort `destroy` helper (wrap, log, never raise) used by T008–T010
  and by the deletion signal, so "cleanup never breaks the operation that triggered it" lives in one place.

## A4: Webhook pipeline

- [x] T012 *(corrects)* Restructure `VideoWebhookService.handle` into the documented order: authenticate →
  freshness → **deduplicate** → classify → locate → **monotonic guard** → apply
  (contracts/video-upload.md). Return a result the view can turn into 200/400 without leaking internals.
- [x] T013 *(new)* Implement dedupe against `apps.enrollment.models.ProcessedWebhookEvent` with
  `gateway="cloudinary_video"` and key `"{notification_type}:{public_id}:{version}"`, falling back to a
  SHA-256 of the raw body. A duplicate is a **success** with no action (research R3).
- [x] T014 *(new)* Implement locate-and-promote: match `video_public_id` first, else
  `pending_video_public_id` and promote via `VideoLifecycleService` (the missed-confirm backstop). No match
  ⇒ success, no action (research R1).
- [x] T015 *(corrects)* Implement the forward-only guard: rank `PENDING < PROCESSING < COMPLETED`, allow
  `PROCESSING → FAILED`, and **never** move a `COMPLETED` lecture via a notification (research R2).
- [x] T016 *(corrects)* Implement the duration write: **seconds → decimal minutes**, quantised to 2dp via
  `Decimal` and clamped to `[0.01, 9999.99]`; written only on an accepted `COMPLETED`, and skipped entirely
  when the provider reports no duration (research R4). This is the 60× bug.

**Checkpoint**: replaying, duplicating, and reordering notifications cannot corrupt a lecture.

## A5: Views, routing & cleanup

- [x] T017 *(corrects)* In `backend/apps/course/views.py`: make `lecture_id` **required** on
  `VideoUploadSignatureView` (400 when absent) and delete the unbound generic-upload branch (research R9);
  add `throttle_scope = 'video_signature'`; add `throttle_scope = 'video_webhook'` to `VideoWebhookView`;
  change `VideoDeleteView` to return **204**; add `VideoConfirmView` (POST, ownership-checked, 400 on a
  stale/mismatched `public_id`). Register `video/<int:lecture_id>/confirm/` in
  `backend/apps/course/urls.py`.
- [x] T018 *(new)* Add `backend/apps/course/video/signals.py` — a `post_delete` receiver on `Lecture` that
  destroys its live and pending assets best-effort — and register it from `CourseConfig.ready()` in
  `backend/apps/course/apps.py`. Django fires per-instance delete signals during cascades, so this covers
  section and course deletion with no extra wiring (research R7). Verify `apps.py` declares the app config.

**Checkpoint**: no route to losing an asset pointer leaves the asset behind.

## A6: Keep the client working (minimal, deliberate — see plan.md *Phasing*)

- [x] T019 *(corrects)* Sync the client to the three changed contracts. **Required, not cosmetic** — each
  one breaks the feature if skipped: (a) forward the new signed fields `max_file_size` / `allowed_formats`
  verbatim in `front-end/src/lib/cloudinary.ts`, since an unechoed signed field makes the provider reject
  every upload; (b) add both to the `Signature` type in
  `featuers/instructor-video-uploading/types/InstructorVideoUploading.types.ts`; (c) adapt `deleteVideo`
  and `useDeleteVideo` to the new **204** (no body) — the hook previously seeded the cache from the
  response payload, which would now seed `undefined`.
- [x] T020 *(new)* In `front-end/src/lib/cloudinary.ts`, call `POST /courses/video/<lectureId>/confirm/`
  with the uploaded `public_id` after the provider accepts the upload, so the lecture flips to *processing*
  immediately rather than waiting on the webhook. A failure here is swallowed — the webhook performs the
  same promotion, so it costs only immediacy. Everything else on the client stays in Phase B.

## A7: Tests

- [x] T021 *(new)* Create `backend/apps/course/tests_video.py` (`APITestCase`, `get_video_provider` patched
  so nothing touches Cloudinary) covering the full checklist in `contracts/video-upload.md`: ownership
  across all three instructor endpoints; signature reserving without disturbing a ready video; supersession
  of an abandoned pending asset; confirm promote / mismatch / missing id; delete resetting the row,
  preserving duration, working mid-processing, and surviving a provider failure; webhook bad signature,
  stale timestamp, duplicate, non-decisive type, out-of-order regression, unknown public_id,
  promote-from-pending, seconds→minutes conversion, clamp, and missing duration; and cascade cleanup on
  lecture/section/course delete.

**Phase A complete**: `python manage.py test apps.course` passes; uploads still work end to end.

---

# Phase B — Instructor experience

**Goal**: the uploader an instructor can actually live with — large files, recovery from any state,
honest status everywhere, and a surface that looks like the rest of the product.

## B1: Upload mechanics

- [x] T022 *(corrects)* Replace the single-request upload in `front-end/src/lib/cloudinary.ts` with the
  provider's **chunked** upload (~20 MB chunks) so files above the 100 MB single-request ceiling work
  (research R6). Keep real progress reporting and abort support across chunks.
- [x] T023 *(corrects)* Enforce size and format client-side **before** any transfer and state both in the
  dropzone. Delete the inherited "(4MB max)" text in
  `front-end/src/components/atoms/file-dropzone.tsx`. Validation lives in `front-end/src/lib/video.ts`
  (`validateVideoFile`, `formatBytes`) so the atoms can use it without importing a feature module.
- [x] T023a *(frontend)* Hold the advertised limits in a client-side constant — `VIDEO_UPLOAD_LIMITS` in
  `front-end/src/lib/video.ts` — rather than fetching them. **Product owner's call: no new endpoint.**
  Because this duplicates the backend setting, the upload re-validates against the limits returned *with
  the signature* before transferring, so drift surfaces as a clear message instead of an opaque provider
  rejection. The signed limits remain the only enforcement.
- [x] T024 [P] *(new)* Warn on navigation away from an in-flight transfer (`beforeunload`) (spec FR-005).
- [x] T025 [P] *(corrects)* Handle a multi-file selection or drop explicitly: use one, tell the instructor
  the rest were ignored (spec FR-006).

## B2: Recovery from every state

- [x] T026 *(corrects)* In `front-end/src/components/atoms/file-item.tsx`, stop disabling **Remove** while
  processing and offer **Replace/Retry** in every state (research R10, spec FR-021).
- [x] T027 *(corrects)* In `front-end/src/featuers/instructor-video-uploading/hooks/useLectureVideo.tsx`,
  surface a "still processing — re-check" state when the poll budget is exhausted, wired to the already
  returned `refetch`, instead of silently stopping (spec FR-020).
- [x] T028 *(corrects)* Rework replace in `InstructorVideoUpload.tsx` to **upload-then-confirm** rather than
  delete-then-upload, so a cancelled or failed replacement leaves the original video live (spec FR-008).
  The backend already guarantees this; the client must stop pre-deleting.
- [x] T029 *(corrects)* Require confirmation before removal using the existing `alert-dialog` atom, with
  enrollment-aware copy naming loss of student access, mirroring `DeleteCurriculumItemDialog` (spec
  FR-016).

## B3: Honest status everywhere

- [x] T030 *(corrects)* Drop the redundant `['instructor','lecture',lectureId]` invalidation from
  `useUploadVideo`/`useDeleteVideo` — it is a **prefix** of the video key, so it already invalidates it,
  and refetching the parent resets the lecture form and discards unsaved title/duration edits.
- [x] T031 *(corrects)* Consume `has_video` in `VideoStatusBadge`/`LectureRow` so the curriculum list stops
  showing "No video" for a lecture that is uploading or processing (spec FR-022).
- [x] T032 [P] *(new)* Render the ready video with the existing `HlsVideoPlayer` in the lecture editor;
  `video_url` is already fetched and currently unused (spec FR-023).

## B4: Consistency & cleanup

- [x] T033 *(corrects)* Retheme the video surfaces onto the house tokens (`darkmint`, `darktext`,
  `graytext2`, `lightbg`) — `--primary` resolves to near-black, so the progress bar and "ready" state
  currently render off-brand beside the darkmint controls in the same editor (spec FR-031).
- [x] T034 [P] Remove dead code: the unused `InstructorVideoUploadingAPI.uploadVideo`, the orphaned
  `VideoSlotPlaceholder.tsx`, and the commented-out JSX plus its now-unused import in `LectureEditor.tsx`.
- [x] T035 [P] Populate `featuers/instructor-video-uploading/index.ts` with the module's public surface and
  import through it, matching every other feature module.
- [x] T036 [P] Export the component as a named `InstructorVideoUpload` (the file default-exports
  `FileUpload` today) to match the codebase's named-export convention.
- [x] T037 [P] Collapse the three `VideoStatus` definitions into one shared type and add `has_video` to the
  curriculum `Lecture` type (Constitution I — prevent drift).
- [x] T038 [P] Give `file-dropzone` a keyboard-accessible activator (role/tabIndex/key handler), a unique
  input id instead of the hardcoded `fileUpload`, and drag-over visual feedback.

## B5: Polish

- [x] T039 [P] Distinguish "transferring" from "finalising" so the progress bar stops sitting at 100% while
  the provider responds.
- [ ] T040 [P] **Not done — optional** (Constitution IV "SHOULD" for frontend). Component tests for the
  uploader: state matrix, cancel, replace-safety, size and format rejection. The backend guarantees behind
  these are covered by `tests_video.py`; what is untested is the component wiring.
- [ ] T041 **Not done — needs a signed-in instructor and a webhook tunnel.** Run the full `quickstart.md`
  walkthrough: the >100 MB upload, the cancelled replacement (confirming the original survives), the
  duration check, recovery while processing, and the Cloudinary-console checks for orphaned assets. This
  is the only acceptance step that exercises the real provider end to end; automated coverage mocks it.

---

## Dependencies

- **T001 → T002** (model before migration); **T002 → everything in A3–A5** (the field must exist).
- **T004 → T005** (dataclass before the provider fills it); **T005 → T019** (client echoes what is signed).
- **T007 → T012** (classification before the pipeline that consumes it); **T009 → T014** (promote before
  the webhook backstop calls it); **T011 → T008, T010, T018** (shared best-effort destroy).
- **T017 → T020** (the confirm endpoint must exist before the client calls it).
- **T021** lands last in Phase A and gates it.
- **Phase A → Phase B**: T028 depends on the confirm/promote lifecycle (T009, T017); T031 depends on
  truthful `PENDING` semantics (T008, T015).

## Parallel opportunities

`[P]` tasks touch disjoint files and may be done in any order within their block: T003 (settings) is
independent of all provider work; T024/T025, T032, and T034–T039 touch separate frontend files.

## Out of scope for both phases

Publish-readiness gating (007), video analytics (009), captions/thumbnails/trimming, multiple videos per
lecture, a scheduled reconciliation sweep for videos whose notification never arrives, and any change to
student playback rules.
