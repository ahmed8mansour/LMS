# Implementation Plan: Instructor Lecture Video Upload

**Branch**: `006-instructor-video-upload` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-instructor-video-upload/spec.md`

## Summary

Fill the lecture editor's placeholder video slot (005 FR-006) with a working uploader: pick or drag a
video, watch real transfer progress, see it process through to ready, replace it, retry it, remove it —
and see the same truth in the curriculum list.

The media pipeline underneath already exists and is production-shaped: a signed direct-to-Cloudinary
upload, adaptive-HLS eager transcoding, a signature-verified completion webhook, and an access rule that
already grants playback to the owning instructor. This plan **extends** that pipeline; it does not rebuild
it and it does not change the provider abstraction's shape.

What is genuinely new on the backend is a **safe upload lifecycle** and the integrity work around it:

1. **Reserve → confirm → promote.** A second identifier (`pending_video_public_id`) holds the in-flight
   upload so signing an upload no longer overwrites the lecture's working video. Promotion happens only
   once the upload is confirmed — by the client for immediacy, by the webhook as the backstop (research
   R1). This is what makes "replace" safe and abandoned uploads harmless.
2. **Trustworthy status.** Explicit notification-type classification plus a forward-only transition guard,
   so an out-of-order or repeated webhook can no longer walk a ready lecture backwards (R2).
3. **Webhook hardening.** Constant-time signature comparison, a freshness window against replay, and
   deduplication via the `ProcessedWebhookEvent` model payments already uses (R3).
4. **Duration in the right unit.** The webhook converts the provider's measured **seconds** into the
   **decimal minutes** the field has always meant, clamped to the column's range (R4). This is the most
   user-visible defect in the first pass: every processed lecture was reporting a length 60× too large.
5. **No orphaned media.** Assets are destroyed at every point a pointer would be lost — supersession,
   abandonment, removal, and lecture/section/course deletion via a single `post_delete` signal (R7).
6. **Limits and rate limits.** Size and format constraints signed into the upload authorisation so the
   provider enforces them, `lecture_id` made mandatory, and throttle scopes on both endpoints — none of
   which existed (R5, R8, R9).

**One additive migration** (`Lecture.pending_video_public_id`, nullable). No existing migration is
modified and no existing field changes type or meaning — `video_status`'s *semantics* are tightened
(PENDING now strictly means "no video"), but its values and column are untouched.

The frontend work is the instructor experience itself: chunked upload for files above the provider's
100 MB single-request ceiling (R6), recovery actions available from every state (R10), an honest
"still processing" state when polling stops, confirmation before destroying media, playback of a ready
video, a corrected curriculum badge, and a retheme onto the house design tokens.

### Phasing

Delivered in two increments, matching how the work was reviewed:

- **Phase 1 — backend correctness and integrity.** Everything numbered above. This is where the data
  corruption, media leaks, and abuse surface live, and none of it needs the UI to be finished.
- **Phase 2 — instructor experience.** Chunked upload, recovery from every state, confirmation dialogs,
  playback, the curriculum badge, and the retheme.

**Phase 2 is frontend-only.** FR-003 requires the accepted formats and size limit to be stated *before*
the instructor picks a file, which needs those values earlier than any request that carries them. Options
were a read-only endpoint serving the settings, or client-side constants. **Decision (product owner): a
client-side constant** — `VIDEO_UPLOAD_LIMITS` in `front-end/src/lib/video.ts` — no new endpoint.

The cost is that the limit now lives in two places, and only the backend's copy is enforced (it is signed
into the credentials, so the provider applies it regardless of what the client believes). The mitigation
is that drift cannot be silent: the upload re-validates the file against the limits **returned with the
signature** before transferring, so a stale constant produces a clear message rather than an opaque
provider rejection after a long upload. The constant carries a comment pointing at the setting it mirrors.

**One deliberate exception to that split.** Signing `allowed_formats` (R5) and moving
promotion to confirm-time (R1) both change the client's obligations: signed parameters must be echoed
verbatim or the provider rejects the upload, and without a confirm call the UI would not reflect a new
upload until the webhook lands. So Phase 1 includes the **minimal** client edits that keep the feature
working end-to-end — forwarding the two new signed fields and calling confirm after a successful upload.
Everything else on the client stays in Phase 2. Shipping Phase 1 without those edits would leave uploads
broken between phases, which is not an acceptable intermediate state.

## Technical Context

**Language/Version**: Python 3 / Django 6.0 + DRF backend; TypeScript 5 (Next.js 16.1 / React 19.2) frontend
**Primary Dependencies**: Backend — DRF `APIView`, `ScopedRateThrottle`, `transaction.atomic`, Django
signals, `cloudinary` SDK (`uploader.destroy`, `utils.api_sign_request`), `hmac`, `decimal`. Frontend —
Axios (plain instance for provider calls, shared `@/lib/axios` for ours), TanStack Query, Tailwind v4,
existing atoms. **No new dependency in either tier.**
**Storage**: PostgreSQL — **one additive migration** (`0018_lecture_pending_video_public_id`, nullable
`CharField`). Reuses `apps.enrollment.ProcessedWebhookEvent` for webhook dedupe (no migration).
**Testing**: Backend — Django `APITestCase` in `backend/apps/course/tests_video.py` covering ownership,
the signature/confirm/delete lifecycle, webhook authenticity/freshness/dedupe/ordering, the duration
conversion and clamp, and cascade cleanup. The video provider is **mocked** throughout (`get_video_provider`
patched) so no test touches Cloudinary. Frontend interaction tests for the uploader are Phase 2.
**Target Platform**: Responsive web (desktop-first instructor workspace)
**Project Type**: Web application (Next.js frontend + Django REST backend)
**Performance Goals**: File bytes never traverse the application server; webhook handling stays synchronous
and O(1) per notification (indexed lookups on both public-id columns); status polling is bounded and stops
on a terminal state
**Constraints**: Ownership enforced server-side on every video operation (defense in depth); a lecture's
live video is never replaced by an unconfirmed upload; status never regresses via a notification; duration
always stored in decimal minutes; no raw exceptions to clients; no new infrastructure (no queue, no
scheduler, no realtime layer); provider abstraction and student playback rules unchanged
**Scale/Scope**: One video per lecture, tens of lectures per course. Phase 1 touches 6 backend files plus
one migration, one new test module, two settings additions, and two small frontend edits

## Constitution Check

*GATE: evaluated against `.specify/memory/constitution.md` v1.0.0.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | ✅ PASS | Phase 1's client edits are typed against the credentials contract (`max_file_size: number`, `allowed_formats: string`), no `any`. The duplicated `VideoStatus` unions and the missing `has_video` on the curriculum `Lecture` type are consolidated in Phase 2. Backend uses `Decimal` (never float) for the duration conversion so no binary-float drift reaches a `decimal(6,2)` column. |
| II. Component-First Architecture | ✅ PASS | Phase 1 adds no components. Phase 2 keeps the uploader composed from atoms (`file-dropzone`, `file-item`, `file-list`, `alert-dialog`, `button`) with explicit prop interfaces, and rethemes them onto the house tokens per FR-031. |
| III. Security-First Development | ✅ PASS | Materially **improves** the posture: constant-time webhook comparison, replay rejection via a freshness window, dedupe, mandatory lecture binding (removing an unbounded credential-minting branch), signed size/format limits, and throttle scopes on two previously unthrottled endpoints. Ownership stays queryset/explicit-check enforced; auth stays `CookieJWTAuthentication`; ORM only, no raw SQL. Asset identifiers are never serialized to clients. |
| IV. Testing Discipline | ✅ PASS | `tests_video.py` covers the service and webhook logic (mandated for models/services) and the full webhook integration path (mandated for webhooks) — ownership, lifecycle, authenticity, freshness, dedupe, ordering, duration conversion/clamp, and cascade cleanup. The first pass shipped **zero** video tests; this closes that. |
| V. Documentation as Code | ✅ PASS | This plan plus research/data-model/contract/quickstart; the non-obvious "why" (promote-on-confirm, the monotonic guard, the seconds→minutes clamp, best-effort destroy) is captured inline at each call site as well as here. |

**Result**: PASS — no violations. Complexity Tracking not required.

**Migration note (not a violation)**: Constitution "Backend changes affecting models MUST include migration
files" — satisfied by `0018_lecture_pending_video_public_id`. It is purely additive and nullable; no
existing migration is edited, per the project Hard Rules.

**Backward-compatibility note**: "API contracts remain backward compatible" is met for every consumer that
exists. Three shapes do change, all on endpoints whose only caller is the instructor uploader shipped on
this same branch: `lecture_id` becomes required on the signature endpoint (the unbound branch had no
caller — research R9), the signed credential set gains two fields (client updated in the same phase), and
`DELETE` returns 204 rather than 200-with-body. The student-facing serializer shape is unchanged apart
from the additive, non-sensitive `has_video`.

**Process note (recorded, not excused)**: implementation preceded this specification on this branch,
contrary to the project's spec-first Hard Rule. The specification was written retroactively over the
delivered code, and every requirement it introduces is tagged *(shipped)* / *(corrects)* / *(new)* so the
gap between what exists and what was intended is explicit rather than glossed over.

## Project Structure

### Documentation (this feature)

```text
specs/006-instructor-video-upload/
├── plan.md              # This file
├── spec.md              # What/why, tagged against the first implementation pass
├── research.md          # Phase 0 — decisions (lifecycle, status, webhook, duration, limits, cleanup)
├── data-model.md        # Phase 1 — fields, status invariants, duration rules, asset lifecycle
├── quickstart.md        # Manual verification walkthrough
├── contracts/
│   └── video-upload.md  # signature / confirm / delete / webhook + test checklist
├── checklists/
│   └── requirements.md  # specification quality gate
└── tasks.md             # Phase 2 breakdown (backend = Phase 1 here, frontend = Phase 2)
```

### Source Code (repository root)

```text
backend/apps/course/
├── models.py                     # + Lecture.pending_video_public_id (nullable)
├── migrations/
│   └── 0018_lecture_pending_video_public_id.py   # NEW, additive
├── video/
│   ├── base.py                   # UploadCredentials + max_file_size, allowed_formats
│   ├── cloudinary_provider.py    # sign the new limits; hmac.compare_digest; freshness;
│   │                             #   notification_type classification; destroy() unchanged in shape
│   ├── service.py                # VideoUploadService: reserve-only (no live mutation)
│   │                             # + VideoLifecycleService: promote / remove / cleanup (best-effort destroy)
│   │                             # VideoWebhookService: dedupe → classify → locate → guard → apply
│   └── signals.py                # NEW: post_delete on Lecture → destroy live + pending assets
├── apps.py                       # register signals in ready()
├── views.py                      # signature (lecture_id required, throttled)
│                                 # + VideoConfirmView; VideoDeleteView → 204; webhook throttled
├── urls.py                       # + video/<int:lecture_id>/confirm/
└── tests_video.py                # NEW: ownership, lifecycle, webhook, duration, cleanup (provider mocked)

backend/config/
└── settings.py                   # + VIDEO_MAX_UPLOAD_BYTES, VIDEO_ALLOWED_FORMATS,
                                  #   CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS,
                                  #   throttle rates: video_signature, video_webhook

front-end/src/                    # Phase 1: minimal edits only (see Phasing)
└── lib/cloudinary.ts             # forward max_file_size + allowed_formats; call confirm on success
```

**Phase 2 (frontend), for context — not built here**: chunked upload in `lib/cloudinary.ts`; recovery
actions from every state and a "still processing" state in `featuers/instructor-video-uploading/`;
`alert-dialog` confirmation before removal; `HlsVideoPlayer` playback of a ready video; `has_video`
consumed by `VideoStatusBadge`/`LectureRow`; retheme onto house tokens; dead-code removal
(`VideoSlotPlaceholder`, the unused `uploadVideo` API function, the commented-out JSX in `LectureEditor`);
a populated feature-module `index.ts`; and one `VideoStatus` definition instead of three.

**Structure Decision**: Web application. Backend changes stay inside `apps/course` — the existing
`video/` subpackage keeps its Strategy/Factory/Facade shape, gaining one service (lifecycle) and one
signal module rather than a new layer. The webhook-dedupe model is **reused** from `apps.enrollment` rather
than duplicated; `apps.course` already imports from `apps.enrollment`, so no new coupling is introduced.
Frontend keeps the house feature-module convention (`featuers/instructor-video-uploading/`), with Phase 1
limited to the two client edits that a Phase-1-only deploy would otherwise break.

## Complexity Tracking

No constitution violations — table intentionally omitted.
