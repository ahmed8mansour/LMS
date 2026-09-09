# Phase 0 Research: Instructor Lecture Video Upload

All unknowns from the Technical Context are resolved below. Each decision records what was chosen, why,
and the alternatives rejected. There are **no remaining NEEDS CLARIFICATION** items (the spec-level
ambiguities were settled in the 2026-09-07 clarification session).

A note on framing: unlike 005, part of this research is **corrective**. A first implementation pass
already landed on the branch, and several decisions below exist to replace a choice made there. Those are
marked **(replaces)** with the behaviour being replaced, so the reasoning is not lost.

---

## R1 — Upload lifecycle: reserve, confirm, promote *(replaces: promote-at-signature)*

**Decision**: Split the lecture's video identity into two fields and promote between them.

- `Lecture.video_public_id` — the **live** asset. What the lecture actually plays. Only ever set to an
  asset confirmed to exist.
- `Lecture.pending_video_public_id` — the **in-flight** upload target (new field, additive migration).

The flow becomes:

1. **Sign** (`POST /courses/video/upload-signature/`): generate a fresh public_id, store it in
   `pending_video_public_id`, and **touch nothing else** — not `video_public_id`, not `video_status`, not
   `duration`. If a different pending id was already sitting there, destroy that abandoned asset first
   (best-effort), satisfying FR-012.
2. **Upload**: browser → provider, directly, using the signed credentials.
3. **Confirm** (`POST /courses/video/<lecture_id>/confirm/`, body `{public_id}`): verify the id matches the
   lecture's pending id, then **promote** — move pending into live, clear pending, set status
   `PROCESSING`, and destroy the *superseded* live asset (best-effort). This is the fast path that gives
   the instructor immediate feedback.
4. **Notification backstop**: if the confirm call never arrives (tab closed, network drop), the provider's
   completion notification finds the lecture by its *pending* id and performs the same promotion before
   applying the status. The client is therefore an optimisation, never a correctness dependency.

**Rationale**: The previous behaviour overwrote `video_public_id` and reset status to `PENDING` at
*signature* time — before a single byte had been sent. Three failures followed from that one choice, and
all three disappear here:

- Abandoning a file picker permanently destroyed the pointer to a working video (the asset survived at the
  provider, unreachable and still billed).
- A lecture with no real video sat in `PENDING` *with* an id attached, which is precisely the ambiguity
  FR-009 outlaws.
- Because the old id was already gone from the row, "replace" had to be implemented as destroy-then-upload
  — so any failure in the upload step destroyed working content (FR-008).

Promote-on-confirm is the standard direct-upload pattern for exactly these reasons: the database only ever
points at media that is known to exist.

**Alternatives considered**:
- *Keep promote-at-signature, add an "undo" path* — rejected: there is nothing to undo to; the previous id
  has already been overwritten and is unrecoverable.
- *Client sends the old id back so the server can restore it* — rejected: makes the client authoritative
  over which asset a lecture points at, which is a data-integrity hole reachable by a crafted request.
- *Confirm-only, no notification backstop* — rejected: a closed tab would strand the lecture forever.
- *Notification-only, no confirm endpoint* — viable and safe, but the instructor stares at an unchanged
  screen for the whole transcode. Confirm costs one small endpoint and makes the UI honest immediately.

---

## R2 — Status semantics and the monotonic guard *(replaces: infer-from-payload-shape)*

**Decision**: Four states with the strict meanings in FR-009, and a **forward-only** transition rule.

| State | Meaning | Reached by |
|-------|---------|-----------|
| `PENDING` | No video attached | Model default; removal |
| `PROCESSING` | Asset attached, transcoding | Promotion (confirm or notification) |
| `COMPLETED` | Ready to stream | Successful transcode notification |
| `FAILED` | Transcode failed | Failed transcode notification |

Rank them `PENDING(0) < PROCESSING(1) < COMPLETED(2)`. A notification may only move a lecture **forward**,
plus `PROCESSING → FAILED`. Specifically: **`COMPLETED` is never left via a notification** — only an
explicit instructor replace or remove takes a lecture out of it.

Notification classification changes from "does the payload have an `eager` array?" to an explicit read of
the provider's `notification_type`, treating only the eager-transcode outcome as decisive and ignoring the
rest.

**Rationale**: The previous rule — `error` → FAILED, `eager` present → COMPLETED, otherwise → PROCESSING —
made every notification decisive, including ones that carry no transcode outcome at all. The provider
sends a plain upload notification *and* an eager notification for the same asset, and delivery is not
ordered. If the plain one landed second, a ready lecture silently regressed to `PROCESSING` and its video
vanished from the interface with nothing in the logs. Reading the notification type is the direct fix;
the monotonic guard is the belt-and-braces one that also covers duplicate delivery and any future
notification type.

**Alternatives considered**:
- *Order notifications by the payload's version field* — rejected: versions are per-asset and not
  guaranteed monotonic across notification types; the rank rule is simpler and strictly safer.
- *Only ever accept the first notification per asset* — rejected: would drop a legitimate
  `PROCESSING → COMPLETED` transition.

---

## R3 — Notification authenticity, replay, and deduplication

**Decision**: Three independent hardening measures on the notification endpoint.

1. **Constant-time comparison.** Replace `expected == signature` with `hmac.compare_digest`. The signature
   algorithm itself is unchanged (the provider's own scheme: SHA1 over raw body + timestamp + secret).
2. **Freshness window.** Reject notifications whose timestamp is older than
   `CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS` (default 2 hours), so a captured body cannot be replayed
   indefinitely. Two hours is generous enough to absorb provider retries and clock skew while bounding the
   replay window.
3. **Deduplication.** Reuse the existing `ProcessedWebhookEvent` model (already used by payments) with
   `gateway="cloudinary_video"` and an event key of
   `"{notification_type}:{public_id}:{version}"`, falling back to a hash of the raw body when the payload
   carries no version. A duplicate is acknowledged with success and does nothing.

**Rationale**: The signature check was correct in substance but three details short of safe: a
non-constant-time compare leaks a timing oracle against the secret, an unbounded timestamp makes any
captured notification a permanent forgery, and no dedupe means a provider retry (which providers do
routinely) applies twice — including a second duration write. The payments side already solved dedupe with
a model that is deliberately gateway-agnostic; reusing it avoids a second table for the same idea. The
`course` app already imports from `enrollment`, so the coupling is not new.

**Alternatives considered**:
- *A new `ProcessedVideoEvent` model in the course app* — rejected: a second table modelling exactly the
  same concept, for no isolation benefit.
- *Idempotency by making the write naturally repeatable* — insufficient on its own: the monotonic guard
  makes the *status* write idempotent, but the duration write and the promotion step still need dedupe.

---

## R4 — Duration: unit conversion and clamping *(replaces: raw seconds into a minutes field)*

**Decision**: On an accepted completion notification, convert the provider's measured length from
**seconds** to **decimal minutes**, quantise to 2 decimal places, clamp to `[0.01, 9999.99]`, and write it
as authoritative over whatever the instructor entered. Skip the write entirely if the provider reports no
duration.

```
minutes = clamp(round(Decimal(seconds) / 60, 2), 0.01, 9999.99)
```

**Rationale**: `Lecture.duration` is `decimal(6,2)` and means **minutes** everywhere in this codebase —
`lib/duration.ts` states it, the student player renders `{duration} min`, and course-length totals sum it
as minutes. The notification handler wrote the provider's raw seconds into it, so every processed lecture
reported a length 60× too large the moment its video went ready, silently overwriting the instructor's
own entry. This is the single most user-visible defect in the first pass.

Clamping matters independently: `decimal(6,2)` maxes out at `9999.99`, so any video over 9,999.99 *seconds*
(2h46m) previously overflowed on save. That raised inside the notification handler, returned a 5xx, and the
provider then retried the same failing notification — leaving the lecture wedged in processing forever.
Clamping converts a hard failure into a slightly-wrong number on an absurdly long lecture.

Authority is the one genuinely debatable half. The measured length is what students actually experience
and what makes course-length totals honest; the instructor's mm:ss entry is necessarily a guess typed
before the file existed. Recorded as a clarification so it can be revisited without archaeology.

**Alternatives considered**:
- *Write the measured length only when the instructor left duration unset* — rejected: `duration` is
  required at lecture creation with no default, so the condition is never true and the code would be dead.
- *Store seconds and convert at every read site* — rejected: would change the meaning of an existing field
  that the student experience already consumes, for no gain.
- *Widen the field to hold long videos exactly* — rejected: a migration altering an existing field to fix a
  bug that clamping handles, for content lengths nobody ships.

---

## R5 — Upload limits enforced in the signature *(replaces: advisory client text only)*

**Decision**: Sign **`allowed_formats`** into the upload authorisation; return **`max_file_size`** in the
credentials but do **not** sign or send it. Driven by two settings:

- `VIDEO_MAX_UPLOAD_BYTES` (default 2 GiB) — advisory; enforced client-side
- `VIDEO_ALLOWED_FORMATS` (default `mp4, mov, webm, mkv, m4v`) — signed; enforced by the provider

Both are returned in the credentials so the client can (a) state the real limit up front and (b) reject a
bad file before transferring. Only `allowed_formats` is echoed back as a signed parameter.

> **Corrected after implementation.** This originally signed *both*, which was wrong and shipped a real
> defect. `max_file_size` is an upload-**preset** parameter, not an upload-**endpoint** one. Cloudinary
> recomputes the signature from the parameters its upload endpoint accepts, so signing and sending one it
> does not recognise there made the two signatures disagree — and the upload failed with **401 "Invalid
> Signature"** only *after* the entire file had transferred. The 401 was then mistranslated by
> `handleAuthError` into "please sign in first", hiding the cause completely (see R11).
>
> Enforcing size server-side is still worth doing, but needs a different mechanism: an account-level limit,
> or a signed upload preset carrying `max_file_size`, referenced via `upload_preset`. Deferred — not in
> this feature's scope. `CloudinarySignedParamsTests` pins the corrected signed set so this cannot regress.

**Rationale**: The dropzone advertised "(4MB max)" — copy inherited from the *image* uploader — while
nothing anywhere enforced any limit at all. Every part of that was wrong: the number was off by orders of
magnitude for video, and the enforcement did not exist. Signing the constraints makes the provider itself
the enforcement point, so bypassing the client changes nothing.

**Consequence, deliberately accepted**: signed parameters must be echoed back verbatim or the signature
fails, so adding these two fields **requires** a matching client change in the same phase. It is not
optional and cannot be deferred — see the phasing note in `plan.md`.

**Alternatives considered**:
- *Client-side size check only* — rejected: trivially bypassed, and the endpoint mints credentials against
  the platform's own paid storage.
- *Validate size server-side after upload* — rejected: the bytes never reach our server by design; the
  file is already stored and billed by the time we could look.

---

## R6 — Large files and segmented upload

**Decision**: Uploads use the provider's **chunked** upload endpoint with a ~20 MB chunk size, rather than
a single request.

**Rationale**: The provider rejects single-request uploads above 100 MB, and real lecture video is
routinely several hundred megabytes. The first pass used one plain `POST` while the server's own docstring
claimed the upload was chunked — so the stated design and the actual behaviour disagreed, and any
realistic file failed with an opaque provider error and no message. Chunked upload also degrades better on
flaky connections, since a failure costs one chunk rather than the whole transfer.

**Scope note**: this is client-side work and lands in the frontend phase; the signed credentials produced
in this phase are already valid for chunked upload without further change.

**Alternatives considered**:
- *Raise the single-request limit* — not available; it is a provider constraint.
- *Proxy uploads through Django* — rejected: defeats the entire point of direct upload, and puts
  multi-gigabyte transfers through the application server.

---

## R7 — Cleanup of orphaned media

**Decision**: Destroy stored assets at every point where the pointer to them would otherwise be lost:

1. **Superseded on replace** — in the promotion step (R1).
2. **Abandoned pending** — when a new signature supersedes an unconfirmed one (R1), and on removal.
3. **Row deleted** — a `post_delete` signal on `Lecture` destroys both its live and pending assets. Django's
   collector fires per-instance delete signals for cascades, so deleting a **section** or an entire
   **course** is covered by the same handler with no extra wiring.

Every destroy is best-effort: wrapped, logged on failure, and never allowed to break the operation that
triggered it.

**Rationale**: The first pass built a `destroy()` capability and wired it to exactly one path — the
explicit "remove video" button. Every other route to losing a pointer (replace, abandon, delete a lecture,
delete a section, delete a course) leaked the asset permanently: once the row is gone, nothing in the
system can ever name that asset again, and it is billed forever.

**Alternatives considered**:
- *Explicit destroy calls in each viewset's `perform_destroy`* — rejected: three viewsets plus two cascade
  paths, each an opportunity to forget one. The signal is a single choke point.
- *A scheduled sweep reconciling storage against the database* — rejected for this spec: no job runner
  exists (discovery §13.7), and it is the wrong primary mechanism regardless. Reasonable future hardening
  as a backstop.

---

## R8 — Rate limiting the video endpoints

**Decision**: Use the project's already-configured `ScopedRateThrottle` by giving each view a scope:

- `video_signature` — `20/min`, on the signing and confirm endpoints.
- `video_webhook` — `120/min`, on the notification endpoint.

**Rationale**: `ScopedRateThrottle` is the project's default throttle class, which means a view without a
`throttle_scope` is **not throttled at all** — and both video endpoints were in exactly that state. The
signing endpoint mints credentials against paid storage, so it is a direct cost vector; 20/min is far
above any human authoring rate. The notification endpoint is unauthenticated and public, so it needs a
ceiling, but the ceiling must sit well above the provider's legitimate burst and retry behaviour — hence
120/min, which throttles abuse without dropping real callbacks.

**Alternatives considered**:
- *Allow-list the provider's IP ranges on the notification endpoint* — rejected: the ranges are not
  contractually stable, and the signature check is the real authenticity gate.
- *No throttle on notifications* — rejected: an unauthenticated public endpoint doing database writes.

---

## R9 — Every signed upload is bound to an owned lecture *(replaces: optional lecture binding)*

**Decision**: `lecture_id` becomes **required** on the signing endpoint. The unbound "generic upload" mode
is removed.

**Rationale**: The unbound branch handed any account passing the instructor gate a signed credential to
upload arbitrary content into the platform's storage, with no owner, no size limit, and no format limit —
and, because that gate is `is_staff`, to a broader set of accounts than "instructors" strictly means. It
had no caller: the only consumer of this endpoint is the lecture uploader, which always has a lecture. It
was an unused branch that was also the single largest abuse surface, so it goes.

**Alternatives considered**:
- *Keep it for future non-lecture video* — rejected: speculative, and re-addable in one line the day a real
  caller exists. There is no cost to removing an unused branch and a real cost to keeping it.

---

## R10 — Recovery from every state

**Decision**: Remove and replace/retry are enabled in **all four** states, including `PROCESSING`. The
interface stops actively polling after a bounded window but then presents a "still processing" state with
a manual re-check, never an indefinite spinner.

**Rationale**: The first pass disabled Remove while processing and offered Replace only for
`COMPLETED`/`FAILED`. Combined with promote-at-signature (R1), which made bogus `PENDING`-with-an-asset
states easy to reach, a lecture could enter a state offering neither remove nor replace — an unescapable
dead end, and a direct contradiction of discovery US-18. Polling that simply stops after five minutes with
no change in what the instructor sees has the same effect at the interface level: a spinner that will
never resolve, with no indication that watching has stopped.

**Scope note**: client-side; lands in the frontend phase. The backend requirement it depends on — that
remove works from any state, including mid-processing — is satisfied by the removal path in R1/R7.

**Alternatives considered**:
- *Poll forever* — rejected: unbounded request load with no infrastructure for push updates.
- *Block remove during processing to avoid racing the notification* — rejected: the race is already handled,
  since a notification for an asset the lecture no longer references is ignored (FR-010, R2). Protecting
  against a handled race by stranding the user is the wrong trade.

---

## R11 — Third-party failures must not be reported as session failures

**Decision**: Errors from the media provider are converted into explicitly-attributed errors
(`asProviderError` in `front-end/src/lib/cloudinary.ts`) before they reach the upload mutation's error
handler. `handleAuthError` is reserved for responses from **our** API.

**Rationale**: `handleAuthError` encodes assumptions that are only true of our own backend — that a `401`
means the session expired, and that the failure detail lives at `data.error` as a string. Cloudinary
violates both: it answers signature problems with `401`, and puts its reason in `data.error.message`, an
object.

Feeding a provider error into it produced the worst possible outcome. A signature rejection — a bug in our
signed parameter set (R5) — was reported to the instructor as **"please sign in first"**, while the actual
reason was discarded entirely: the string check `typeof message === 'string'` fails on Cloudinary's object,
so even non-401 provider errors collapsed to "Something went wrong". The message pointed at the one thing
that was not wrong, and there was no path to the truth short of opening the network tab.

The cost of this is measured in debugging time, not in code: a genuine bug stayed invisible behind a
confident, wrong explanation.

**Rules**:
1. A provider `401` is reported as a signature/authorisation problem with the provider, and says explicitly
   that it is *not* a sign-in problem.
2. The provider's own message is surfaced verbatim when present.
3. Cancellation (`ERR_CANCELED`) passes through untouched — it is control flow, not failure.
4. Errors from our API keep going through `handleAuthError`, where its assumptions hold.

**Alternatives considered**:
- *Make `handleAuthError` defensive about response shapes* — rejected: it would still guess at whose 401 it
  was holding. The caller knows which host it just talked to; the shared helper cannot.
- *Log the real error and keep the friendly message* — rejected: the "friendly" message actively misdirected
  the reader. A wrong explanation is worse than a vague one.
