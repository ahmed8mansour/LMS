# Feature Specification: Instructor Lecture Video Upload

**Feature Branch**: `006-instructor-video-upload`
**Created**: 2026-09-07
**Status**: Draft (written retroactively over a partial implementation — see *Implementation Status*)
**Input**: User description: "read planning/instructor-experience-discovery.md — the 006 spec for the
instructor experience: direct-to-Cloudinary lecture video upload UI with progress and processing-status
polling, on the existing signature/webhook pipeline."

## Overview

Spec 005 gave instructors a curriculum they can build — sections, lectures, quizzes — but every lecture is
silent. Its video slot is a labelled placeholder (005 FR-006) and its video status is read-only. This
feature makes that slot **real**: an instructor can attach an actual video file to a lecture they own,
watch it upload and process, replace it, retry it when it fails, and remove it.

The media pipeline itself already exists and is production-shaped: the backend issues signed
direct-to-Cloudinary upload credentials, the browser uploads the file straight to Cloudinary (the bytes
never pass through the API), Cloudinary transcodes to adaptive HLS, and a signed webhook reports the
outcome. What is missing is the **instructor-facing experience** on top of it, and a set of **correctness
and safety guarantees** the pipeline does not yet make.

Concretely, this feature makes five things true for an instructor inside a lecture they own:

1. **They can attach a video** — pick or drag a file, see a real progress indicator while it uploads, and
   see the lecture move to *processing* when the upload lands.
2. **They can see truthful status, everywhere** — the lecture editor and the curriculum list agree on
   whether a lecture has no video, is processing, is ready, or has failed, without a manual refresh.
3. **They can always recover** — replace a video, retry a failed one, and remove a video, from *any*
   state. A stuck or abandoned upload never becomes a dead end.
4. **They never silently lose a working video** — replacing a video keeps the existing one playable until
   the replacement is safely in place; a failed replacement leaves the original intact.
5. **The system never lies about a lecture's length** — a lecture's stored duration always means the same
   unit no matter whether a human typed it or the video pipeline measured it.

Alongside the instructor-facing behaviour, this feature closes the correctness, integrity, and abuse gaps
in the existing pipeline: duration units, out-of-order and replayed webhooks, orphaned paid media, and an
unthrottled signing endpoint.

## Implementation Status

This specification was written **after** a first implementation pass had landed on the feature branch,
which is a deviation from the project's spec-first rule and is recorded here deliberately. The
specification is therefore both a description of intended behaviour and the acceptance checklist for
completing and correcting that pass. Requirements are tagged:

- **(shipped)** — implemented and believed correct in the first pass.
- **(corrects)** — the first pass implemented this incorrectly or incompletely; this requirement defines
  the correct behaviour.
- **(new)** — not attempted in the first pass.

## Clarifications

### Session 2026-09-07

- Q: A lecture's duration is entered by the instructor as mm:ss and stored as decimal **minutes** (the 005
  convention), but the video pipeline reports the measured length in **seconds**. Which wins, and in what
  unit? → A: The stored value is **always decimal minutes**, without exception. When processing completes,
  the **measured length is authoritative** and replaces the instructor's pre-upload estimate, converted
  seconds → minutes and clamped to the field's supported range. Rationale: the measured length is the real
  thing students experience, and the instructor's entry is necessarily a guess made before the file
  existed. The conversion is the non-negotiable part; the authority choice is the one that keeps course
  length totals honest.
- Q: What exactly does each video status mean, now that a lecture can hold a video mid-upload? → A: Four
  strictly-defined states. **PENDING = no video attached** (the default, and the state after removal).
  **PROCESSING = a video is attached and being transcoded.** **COMPLETED = ready to stream.** **FAILED =
  transcoding failed; the instructor must retry or replace.** A lecture MUST NOT sit in PENDING while an
  asset is attached to it — that ambiguity is what made "no video" and "still uploading" indistinguishable.
- Q: An upload is signed before the file is sent. If the instructor abandons it, or it fails, what happens
  to the lecture? → A: **Nothing.** Signing an upload MUST NOT alter the lecture's current video, status,
  or duration. A new upload becomes the lecture's video only once it is confirmed to have actually
  arrived. An abandoned upload leaves the lecture exactly as it was, and its half-uploaded asset is
  cleaned up rather than left to be paid for.
- Q: When replacing a video, is the old one removed before or after the new one arrives? → A: **After.**
  The existing video stays the lecture's video and stays playable until the replacement is confirmed;
  only then is the old asset destroyed. Removing first is unacceptable because any failure in the second
  step destroys working content with no undo.
- Q: The transcoding provider can deliver notifications out of order and more than once. How is status
  protected? → A: Notifications MUST be **deduplicated** and MUST NOT move a lecture **backwards**. Once a
  video is ready, only an explicit instructor action (replace or remove) may take it out of that state; a
  late or repeated notification MUST be ignored rather than applied.
- Q: What happens to the stored media when a lecture, section, or course is deleted? → A: Its video assets
  MUST be destroyed too. Media storage is paid and, once the owning row is gone, an orphaned asset is
  unreachable and unrecoverable — nothing else in the system can ever find or delete it.
- Q: Is there a limit on what can be uploaded? → A: Yes. The system MUST constrain accepted uploads by
  **file size and media format**, and MUST enforce those limits **server-side as part of the signed
  upload** — not only as client-side advice, which any caller can bypass.
- Q: Who may sign an upload, and how often? → A: Only an instructor acting on a lecture in a course they
  own, or an admin. Signing MUST be **rate-limited**, and an upload that is not bound to a specific owned
  lecture MUST NOT be offered — a signing endpoint that mints unbounded upload credentials for any staff
  account is an abuse and cost vector.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Attach a video to a lecture (Priority: P1)

Inside a lecture they own, an instructor drags in (or browses for) a video file. They see the file
accepted, a progress indicator that reflects real upload progress, and — once the upload lands — a clear
"processing" state. When transcoding finishes, the lecture shows as ready without them having to refresh,
and its duration reflects the real length of the video.

**Why this priority**: This is the feature. Without it, a course cannot contain any teaching content, and
specs 004 and 005 produce only empty shells. It is the discovery document's named #2 platform gap.

**Independent Test**: Open an owned lecture with no video, upload a valid video file, observe progress
through to a processing state, wait for processing to finish, and confirm the lecture reports ready with a
duration matching the file's real length — all without a manual page refresh.

**Acceptance Scenarios**:

1. **Given** a lecture the instructor owns with no video, **When** they open the lecture editor, **Then**
   the video area invites them to add a video and states the accepted formats and size limit.
2. **Given** the video area, **When** the instructor selects or drops a valid video file, **Then** the
   upload begins and a progress indicator reflects actual upload progress rather than an indeterminate
   spinner.
3. **Given** an upload that has finished transferring, **When** the transfer completes, **Then** the
   lecture is shown as *processing* and remains so until the outcome is known.
4. **Given** a lecture whose processing has finished successfully, **When** the outcome arrives, **Then**
   the lecture is shown as *ready* without a manual refresh, and the instructor is told it is ready.
5. **Given** a lecture whose processing has completed, **When** its duration is displayed anywhere in the
   product, **Then** it reflects the video's real length in the same unit used everywhere else — a
   ten-minute video never displays as "600 min".
6. **Given** a file that is not an accepted video format, or exceeds the size limit, **When** the
   instructor selects it, **Then** it is rejected before any upload starts, with a message naming the
   actual limit, and the lecture is unchanged.

---

### User Story 2 - Replace or remove a lecture's video (Priority: P1)

An instructor with a video already on a lecture decides to swap it for a better take, or to take it down
entirely. Replacing keeps the current video available until the new one is safely in place. Removing asks
for confirmation first — and says plainly what will be lost when students are already enrolled.

**Why this priority**: Content is iterated far more often than it is first created, and both actions are
irreversible against paid media storage. Getting them wrong destroys an instructor's work.

**Independent Test**: On a lecture with a ready video, start a replacement and cancel it — confirm the
original is still ready and playable. Start a replacement and let it fail — confirm the original survives.
Complete a replacement — confirm the new video is live. Remove a video — confirm it is gone and the
lecture returns to "no video".

**Acceptance Scenarios**:

1. **Given** a lecture with a ready video, **When** the instructor starts a replacement and cancels or the
   upload fails, **Then** the original video is still the lecture's video, still ready, and still playable.
2. **Given** a lecture with a ready video, **When** a replacement upload is confirmed, **Then** the new
   video becomes the lecture's video, the lecture returns to *processing*, and the superseded video's
   stored asset is destroyed rather than left behind.
3. **Given** a lecture with a video, **When** the instructor chooses to remove it, **Then** they MUST
   explicitly confirm before anything is destroyed.
4. **Given** a removal confirmed on a course with enrolled students, **When** the confirmation is shown,
   **Then** it states that enrolled students will immediately lose access to that video.
5. **Given** a confirmed removal, **When** it completes, **Then** the stored asset is destroyed, the
   lecture reports *no video*, and the lecture's own details (title, position, instructor-entered
   duration) are untouched.
6. **Given** a lecture in any video state, **When** the instructor views it, **Then** remove and
   replace/retry are available — no state leaves them without a way out.

---

### User Story 3 - Recover from a failed or stuck upload (Priority: P1)

An upload fails, a transcode fails, or a notification never arrives and the lecture sits in *processing*
indefinitely. The instructor is told what state it is in, is not left watching a spinner forever, and can
always retry or clear it themselves.

**Why this priority**: Video pipelines fail routinely — bad files, dropped connections, provider
incidents. The discovery document calls this out directly (US-18). A stuck lecture with no exit is worse
than no upload feature at all, because the instructor cannot even undo it.

**Independent Test**: Force a failed transcode and confirm the lecture reports failure with a retry
action. Leave a lecture in processing beyond the polling window and confirm the interface says so and
offers a manual re-check plus remove/replace — never an endless spinner.

**Acceptance Scenarios**:

1. **Given** an upload that fails mid-transfer, **When** it fails, **Then** the instructor is told it
   failed, the lecture keeps whatever video it had before, and they can retry.
2. **Given** a lecture whose transcoding failed, **When** the instructor views it, **Then** it clearly
   reports failure and offers retry (re-upload) and remove.
3. **Given** a lecture that has been *processing* longer than the interface actively watches for, **When**
   that window elapses, **Then** the interface says it is still processing and offers a manual re-check,
   rather than appearing to have hung.
4. **Given** a lecture stuck in *processing*, **When** the instructor chooses remove or replace, **Then**
   the action is available and succeeds — being mid-processing MUST NOT disable the escape routes.
5. **Given** the instructor cancels an in-flight upload, **When** they cancel, **Then** the transfer stops,
   no error is reported as if it were a failure, and the lecture is unchanged.

---

### User Story 4 - Trust the status shown across the product (Priority: P2)

An instructor scanning their curriculum sees, per lecture, whether it still needs a video, is processing,
is ready, or failed — and that matches what the lecture editor says. They can preview a ready video in
place rather than guessing.

**Why this priority**: The curriculum list is where an instructor decides what to work on next. If "no
video" and "uploading" look identical there, the list is worse than useless — it actively misleads. Also
the input to spec 007's publish-readiness gate.

**Independent Test**: Upload a video, then navigate to the curriculum list and confirm the lecture's badge
reads *processing* (not "no video"); when it finishes, confirm the badge reads *ready* and the editor
agrees; play the video back in the editor.

**Acceptance Scenarios**:

1. **Given** a lecture with an upload in progress or processing, **When** the instructor views the
   curriculum list, **Then** the lecture reads as processing — never as "no video".
2. **Given** a lecture with a ready video, **When** the instructor views the curriculum list and the
   lecture editor, **Then** both report *ready* and agree with each other.
3. **Given** a lecture with a ready video, **When** the instructor opens its editor, **Then** they can
   play the video back to check the right file landed.
4. **Given** any lecture, **When** its video state changes, **Then** the change is reflected without the
   instructor manually reloading the page.

---

### User Story 5 - Nobody touches another instructor's media (Priority: P1)

An instructor can only sign, confirm, replace, or remove video on lectures inside courses they own.
Attempts against anything else — by deep link, guessed ID, or crafted request — are refused with nothing
exposed.

**Why this priority**: Media is expensive and private. The signing endpoint mints credentials against the
platform's own storage account, so a weak gate here is both a data-integrity and a direct cost exposure.

**Independent Test**: As instructor A, attempt to sign, confirm, and delete video for a lecture belonging
to instructor B by ID; confirm every attempt is refused, no data is returned, and B's lecture is unchanged.

**Acceptance Scenarios**:

1. **Given** a lecture in another instructor's course, **When** instructor A attempts to sign an upload,
   confirm one, or remove its video by ID, **Then** each attempt is refused with no data exposed and no
   change to that lecture.
2. **Given** a staff account with no instructor profile, **When** it calls any video endpoint, **Then** it
   is refused cleanly rather than causing an error.
3. **Given** repeated upload-signing requests from one account, **When** they exceed a reasonable rate,
   **Then** further requests are refused until the rate falls back.
4. **Given** a request to sign an upload that is not bound to an owned lecture, **When** it is made,
   **Then** it is refused — every signed upload targets a specific owned lecture.

---

### Edge Cases

- **Abandoned upload.** An instructor signs an upload and never sends the file (closes the tab, cancels).
  The lecture MUST be exactly as it was — same video, same status, same duration — and the reserved,
  never-completed asset MUST NOT accumulate as paid storage.
- **Duplicate notification.** The same processing notification is delivered twice. It MUST be applied at
  most once, with no double duration write and no status churn.
- **Out-of-order notification.** A generic notification arrives after the completion notification for the
  same asset. It MUST NOT move a ready lecture back to processing or to "no video".
- **Notification for an asset the system no longer tracks.** A notification arrives for an asset belonging
  to a lecture that was deleted, or that was superseded by a replacement. It MUST be ignored without error.
- **Replayed or forged notification.** A captured notification body replayed later, or one with an invalid
  signature, MUST be rejected. Signature comparison MUST NOT leak timing information, and stale
  notifications MUST be rejected on age.
- **Very long video.** A video longer than the duration field can represent MUST be stored at the field's
  maximum rather than causing a failure, and MUST NOT wedge the lecture in processing via a failing,
  endlessly-retried notification.
- **Large file.** A file above the accepted size MUST be rejected before upload with the real limit named,
  and MUST also be refused by the upload itself if the client check is bypassed.
- **Wrong media type.** A non-video file, or a video in an unsupported container, MUST be rejected with a
  clear message; the accepted formats MUST be stated up front, not discovered by failure.
- **Multiple files selected.** A lecture holds exactly one video. Selecting or dropping several MUST be
  handled explicitly — one is used and the instructor is told — never silently discarded.
- **Navigating away mid-upload.** The instructor MUST be warned before leaving with a transfer in flight,
  and leaving MUST NOT corrupt the lecture's state.
- **Deleting content that holds video.** Deleting a lecture, or a section or course containing lectures,
  MUST destroy the associated stored assets as part of the deletion.
- **Removing video from a published course.** Allowed, but the confirmation MUST state that enrolled
  students immediately lose access to that video. This feature does not gate publishing (spec 007).
- **Network or provider failure on remove.** If the stored asset cannot be destroyed, the instructor MUST
  still be able to clear the video from the lecture, and MUST receive a clear, non-technical message —
  never a raw error — and MUST NOT be stranded with an unremovable video.
- **Instructor without an instructor profile.** Handled gracefully everywhere, consistent with 003/005.

## Requirements *(mandatory)*

### Functional Requirements

#### Uploading

- **FR-001** *(shipped)*: The system MUST let an instructor attach a video file to a lecture in a course
  they own, transferring the file **directly to the media provider** without routing its bytes through the
  application server.
- **FR-002** *(shipped)*: The system MUST display **real transfer progress** during an upload, and MUST
  let the instructor **cancel** an in-flight transfer; a cancelled transfer MUST NOT be reported as a
  failure and MUST leave the lecture unchanged.
- **FR-003** *(corrects)*: The system MUST accept only videos within a defined **maximum file size** and a
  defined set of **accepted formats**, MUST state both to the instructor before they choose a file, MUST
  reject a violating file client-side before any transfer begins, and MUST additionally enforce both
  limits **server-side within the signed upload authorisation** so a bypassed client check still fails.
  Any stated limit MUST be the limit actually enforced.
- **FR-004** *(corrects)*: The system MUST successfully upload files up to the stated maximum size,
  including files large enough to require a segmented/resumable transfer.
- **FR-005** *(new)*: The system MUST warn the instructor before they navigate away from an in-flight
  transfer.
- **FR-006** *(corrects)*: When more than one file is selected or dropped, the system MUST use exactly one
  and MUST tell the instructor that the others were not used.

#### Lifecycle & state integrity

- **FR-007** *(corrects)*: Authorising an upload MUST NOT change the lecture's current video, video status,
  or duration. A newly uploaded video MUST become the lecture's video only once its arrival has been
  **confirmed**.
- **FR-008** *(corrects)*: Replacing a video MUST keep the existing video in place and playable until the
  replacement is confirmed; only then MUST the superseded asset be destroyed. A failed, cancelled, or
  abandoned replacement MUST leave the original video intact and unchanged.
- **FR-009** *(corrects)*: Video status MUST carry exactly these meanings and no others: **no video
  attached**, **attached and processing**, **ready**, **failed**. A lecture MUST NOT report "no video"
  while an asset is attached to it, and MUST NOT report "processing" or "ready" with nothing attached.
- **FR-010** *(corrects)*: A lecture's video state MUST NOT move backwards on its own. Once ready, only an
  explicit instructor action (replace or remove) may change it; a late, repeated, or contradictory
  processing notification MUST be ignored.
- **FR-011** *(corrects)*: Processing notifications MUST be **deduplicated** so that a repeated delivery is
  applied at most once.
- **FR-012** *(new)*: An upload that is authorised but never confirmed MUST leave no accumulating reserved
  media; its abandoned asset MUST be cleaned up when the lecture's video is next changed or removed.

#### Duration

- **FR-013** *(corrects)*: A lecture's stored duration MUST **always** be expressed in the same unit
  (decimal minutes, the existing convention) regardless of whether an instructor entered it or the media
  pipeline measured it. A measured length reported in any other unit MUST be converted before storage.
- **FR-014** *(corrects)*: When processing completes, the **measured** length MUST replace the
  instructor's pre-upload estimate, and MUST be clamped to the supported range rather than causing a
  failure for an unusually long video.

#### Removal & cleanup

- **FR-015** *(shipped)*: The system MUST let an instructor remove a lecture's video, destroying the stored
  asset and returning the lecture to "no video", while leaving the lecture's own details (title, position,
  duration) untouched.
- **FR-016** *(corrects)*: Removing a video MUST require an explicit confirmation. When the containing
  course has enrolled students, the confirmation MUST state that they will immediately lose access to that
  video.
- **FR-017** *(new)*: Deleting a lecture — directly, or by deleting its section or course — MUST destroy
  the stored video assets belonging to it.
- **FR-018** *(corrects)*: A failure to destroy a stored asset MUST NOT prevent the instructor from
  clearing the video from the lecture, MUST be reported as a clear non-technical message, and MUST NOT
  surface a raw error or stack trace.

#### Visibility & recovery

- **FR-019** *(shipped)*: The lecture editor MUST reflect video state changes automatically, without a
  manual page reload, while the video is processing.
- **FR-020** *(corrects)*: Where the system stops actively watching for a change, it MUST say the video is
  still processing and offer a manual re-check — it MUST NOT present an indefinite indeterminate state.
- **FR-021** *(corrects)*: Remove and replace/retry MUST be available from **every** video state,
  including while processing. No state may leave the instructor without a recovery action.
- **FR-022** *(corrects)*: The curriculum list MUST distinguish "no video" from "processing" and MUST agree
  with the lecture editor for the same lecture.
- **FR-023** *(new)*: The lecture editor MUST let the instructor play back a ready video, reusing the
  existing player, to verify the correct file landed.
- **FR-024** *(shipped)*: Every video surface MUST present defined loading, empty, processing, failed, and
  retry-able error states rather than blank or broken regions.

#### Access & abuse

- **FR-025** *(shipped)*: The system MUST enforce that an instructor can sign, confirm, replace, or remove
  video only for lectures inside courses they own; any attempt against another instructor's lecture,
  including by deep link or guessed ID, MUST be refused with no data exposed. Backend ownership scoping is
  the authoritative gate.
- **FR-026** *(corrects)*: Every signed upload MUST be bound to a specific lecture the caller owns; the
  system MUST NOT issue upload credentials that are not bound to an owned lecture.
- **FR-027** *(new)*: Upload authorisation MUST be rate-limited per caller, and the notification endpoint
  MUST be rate-limited, so neither can be used to exhaust media-provider quota or cost.
- **FR-028** *(corrects)*: Notification authenticity checks MUST use a constant-time comparison and MUST
  reject notifications older than a defined freshness window, so a captured notification cannot be
  replayed.

#### Scope boundaries

- **FR-029**: This feature MUST NOT change the student-facing course, curriculum-preview, or player
  experience beyond a lecture's video becoming available, and MUST NOT alter who may stream a video (the
  existing access rule stands).
- **FR-030**: This feature MUST NOT publish or unpublish a course, and MUST NOT gate publishing on video
  readiness — that is spec 007. It MUST, however, expose the video state that gate will consult.
- **FR-031**: New video surfaces MUST reuse the project's existing design tokens and component library and
  MUST be visually consistent with the surrounding instructor experience.

### Key Entities *(include if feature involves data)*

- **Lecture (existing, extended)**: The unit a video attaches to. Relevant attributes: the identifier of
  its **live** stored video asset; the identifier of an **in-flight** upload not yet confirmed (new — this
  separation is what lets a replacement fail without destroying the original); its **video status** per
  FR-009; and its **duration** in decimal minutes, which the pipeline overwrites with the measured length
  on completion. Ownership flows through its section's course.
- **Stored video asset (external)**: The media held by the provider, addressed by an identifier the
  lecture holds. Created by a direct browser upload, transcoded to an adaptive-streaming rendition, and
  destroyed when superseded, removed, or when its lecture is deleted. Not a database entity, but the thing
  the integrity requirements are about — it is paid for and unreachable once its identifier is lost.
- **Upload authorisation (transient)**: A short-lived, signed permission for the browser to upload one
  specific asset for one specific owned lecture, carrying the size and format limits from FR-003. Not
  persisted beyond the in-flight identifier on the lecture.
- **Processing notification (transient)**: The provider's report of a transcode outcome, carrying the asset
  identifier, the outcome, and the measured length. Authenticated, deduplicated, age-checked, and applied
  only in the forward direction.
- **Course / Section (existing, referenced)**: The ownership root and the deletion cascade path;
  enrollment on the course determines which removal confirmation is shown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can attach a video to a lecture and reach a *ready* state entirely from the
  lecture editor, with no manual page reload, in 100% of successful uploads.
- **SC-002**: A video file at the stated maximum accepted size uploads successfully in 100% of attempts on
  a working connection; files above it are rejected before transfer in 100% of attempts, with the real
  limit named.
- **SC-003**: After processing completes, a lecture's displayed duration matches the video's true length
  within one second, in the same unit used everywhere else, in 100% of cases. Unit-mismatched durations
  occur 0 times.
- **SC-004**: A cancelled, failed, or abandoned replacement leaves the previously-working video live and
  playable in 100% of cases; videos lost to a failed replacement occur 0 times.
- **SC-005**: Remove and replace/retry are reachable from every video state in 100% of cases; states with
  no available recovery action occur 0 times.
- **SC-006**: Repeated and out-of-order processing notifications change a *ready* lecture's status 0 times,
  and a duplicated notification is applied more than once 0 times.
- **SC-007**: Deleting a lecture, section, or course leaves 0 orphaned stored video assets.
- **SC-008**: 100% of attempts to sign, confirm, or remove video on a lecture in a course the caller does
  not own are refused with no data exposed, verified independently of the frontend. Upload credentials
  issued without a bound owned lecture: 0.
- **SC-009**: 100% of removals require explicit confirmation, and 100% of removals on a course with
  enrolled students name the loss-of-access consequence.
- **SC-010**: For the same lecture, the curriculum list and the lecture editor report the same video state
  in 100% of cases; "no video" shown for a lecture that has one occurs 0 times.
- **SC-011**: Video endpoints return a raw error or stack trace to a client 0 times; 100% of provider
  failures surface as a clear message with the instructor still able to proceed.
- **SC-012**: Notifications with an invalid signature or older than the freshness window are applied 0
  times.

## Assumptions

- **The media pipeline exists and is reused, not rebuilt.** Signed direct-to-provider upload, the provider
  abstraction behind a factory, adaptive-streaming transcoding, the signed completion notification, and
  the existing rule governing who may stream a lecture's video are all in place and are extended — not
  replaced. This feature adds an in-flight/live separation, confirmation, cleanup, dedupe, and limits to
  that pipeline, and builds the instructor experience on top of it.
- **Duration stays in the existing field and unit.** Decimal minutes, as established by 005 and consumed by
  the student experience. No new duration field and no change of unit — the fix is that the pipeline now
  converts into that unit instead of writing a different one.
- **One video per lecture.** A lecture holds at most one video; there is no gallery, no ordering, and no
  multi-asset lecture. Replacing is the only way to change it.
- **Foundation from 003–005 is in place.** Role-aware routing, the instructor shell, the course workspace
  and its tab bar, the curriculum builder, and the lecture editor exist; this feature fills the lecture
  editor's video slot and corrects the curriculum list's video badge.
- **Ownership remains server-enforced.** The existing instructor gate and ownership-through-course scoping
  are the authoritative check; the frontend guard is defense in depth only.
- **Deletion stays irreversible.** No soft-delete, archive, versioning, or undo is introduced for video —
  destroying an asset is permanent, which is exactly why confirmation and replace-before-destroy are
  required.
- **Adding an in-flight identifier to the lecture requires a new, additive database migration.** No
  existing migration is modified, and no existing field changes meaning.
- **Reuse over rebuild on the frontend.** The video experience is built from the existing component
  library, design tokens, data-fetching, validation, and error-handling patterns, following the house
  feature-module convention.

## Dependencies

- **Spec 005 (curriculum builder)** — the lecture editor whose placeholder video slot this feature
  replaces, the curriculum list whose video badge it corrects, and the mm:ss duration convention it must
  keep honest.
- **Spec 004 (instructor course management)** and **spec 003 (instructor foundation)** — the course
  workspace, instructor shell, role-aware routing, and graceful no-instructor-profile handling.
- **The existing video subsystem** — provider abstraction and factory, signed upload authorisation, the
  transcoding notification endpoint, and the existing rule granting playback to the owning instructor,
  admins, and actively enrolled students.
- **The existing media provider account** — storage and transcoding are paid and quota-bound, which is why
  cleanup, limits, and rate-limiting are requirements rather than niceties.
- **The existing webhook-deduplication pattern** already used by payments.
- **The shared component library, design tokens, player, data-fetching, and confirmation-dialog
  conventions** established by the student experience and reused in 004/005.
- **Enrollment data (read-only)** — consulted only to decide which removal confirmation to present.

## Out of Scope

- **Publishing and publish-readiness** — the publish action and the gate that will require videos to be
  ready (spec 007). This feature exposes the state that gate consults but never blocks or triggers
  publishing.
- **Any change to student playback** — who may stream, the player itself, progress tracking, and the
  learn experience are unchanged.
- **Captions, subtitles, transcripts, chapters, thumbnails/posters, and video trimming or editing.**
- **Multiple videos per lecture, video reordering, or video reuse across lectures.**
- **Downloadable lecture resources or non-video attachments.**
- **Background job infrastructure** — no queue or scheduler is introduced; notification handling stays
  synchronous, and there is no scheduled reconciliation sweep for videos whose notification never arrives
  (the instructor-facing manual re-check in FR-020 is the mitigation; a sweep is future hardening).
- **Changing the media provider or adding a second one** — the abstraction stays, the implementation stays
  the one already in use.
- **Soft-delete, archive, versioning, or undo** for video assets.
- **Analytics on video** (watch time, drop-off) — spec 009.
