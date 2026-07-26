# Data Model Changes: Production Readiness Audit

**Branch**: `002-production-readiness-audit` | **Date**: 2026-07-15

This feature modifies existing models via new migrations, and adds one new model
(`ProcessedWebhookEvent`) for webhook deduplication.

---

## Modified Entities

### 1. Transaction (enrollment app)

**Current problems**:
- `stripe_charge_id` is NOT NULL but never populated → IntegrityError on every webhook
- `stripe_receipt_id` is NOT NULL but never populated → same crash
- No `payment_method_type` field — billing history hardcodes "card"

**Changes**:

| Field | Current | New | Reason |
|-------|---------|-----|--------|
| `stripe_charge_id` | `TextField(null=False)` | `TextField(null=True, blank=True)` | Failed payments and free enrollments have no charge |
| `stripe_receipt_id` | `TextField(null=False)` | Rename to `stripe_receipt_url`, `URLField(null=True, blank=True)` | Stores a URL, not an ID; nullable for failures/free |
| `payment_method_type` | *(does not exist)* | `CharField(max_length=50, default='card')` | Track actual payment method (card, apple_pay, google_pay) |
| `status` choices | `set` literal `{}` | `list` of tuples `[]` | Fix Python set → ordered list |
| `currency` choices | `set` literal `{}` | `list` of tuples `[]` | Same fix |

### 2. Order (enrollment app)

**Changes**:

| Field | Current | New | Reason |
|-------|---------|-----|--------|
| `status` choices | `set` literal `{}` | `list` of tuples `[]` | Fix Python set → ordered list |
| `stripe_payment_intent_id` | `TextField(null=False)` | No change — use `'free_enrollment'` placeholder for free courses | Avoids nullable FK complexity |
| `payment_gateway` | *(does not exist)* | `CharField(max_length=20, default='stripe')` | Records which provider owns the order, so refunds and webhooks route correctly once a second gateway exists (FR-020a) |
| `idempotency_key` | *(does not exist)* | `CharField(max_length=255, null=True, blank=True, unique=True)` | Prevents double charges (FR-020b). The **unique constraint is the enforcement mechanism** — the create path must be `try: create() / except IntegrityError`, not check-then-create, which is a TOCTOU race under concurrency |

**State transitions** (updated):

```
pending → paid       (webhook: payment_intent.succeeded)
pending → failed     (webhook: payment_intent.payment_failed)
failed  → pending    (payment retry: user re-attempts checkout)
paid    → refunded   (admin refund endpoint, within 14 days)
```

### 3. Enrollment (enrollment app)

**Changes**:

| Field | Current | New | Reason |
|-------|---------|-----|--------|
| *(meta)* | No unique constraint | Add `unique_together = ['user', 'course']` | Prevent duplicate enrollments at DB level |

### 4. Lecture (course app)

**Changes**:

| Field | Current | New | Reason |
|-------|---------|-----|--------|
| `video_url` | `CharField(max_length=255555)` | Removed — replaced by `video_public_id` + `video_status` | Direct-to-Cloudinary upload pipeline; URL is computed at serialization time |
| `video_public_id` | *(does not exist)* | `CharField(max_length=255, null=True, blank=True)` | Cloudinary public_id, assigned at upload-signature time (race-free) |
| `video_status` | *(does not exist)* | `CharField(max_length=20, choices=PENDING/PROCESSING/COMPLETED/FAILED, default='PENDING')` | Tracks async Cloudinary transcoding state |

Serializer-level: `video_url` is a computed `SerializerMethodField` — returns Cloudinary HLS streaming URL only when `video_status == 'COMPLETED'` and the requester has access (enrolled student, course owner, or admin).

---

## New Entity

### 5. ProcessedWebhookEvent (enrollment app)

Required by FR-020c. Payment providers re-deliver webhook events on timeout or any
non-2xx response, so the same `payment_intent.succeeded` can legitimately arrive
several times. Order-status guards catch most of this, but they are per-flow and
easy to forget when adding a handler; a dedupe table makes it structural.

| Field | Type | Notes |
|-------|------|-------|
| `event_id` | `CharField(max_length=255, unique=True)` | Provider's event ID — the dedupe key |
| `gateway` | `CharField(max_length=20)` | Which provider sent it |
| `received_at` | `DateTimeField(auto_now_add=True)` | For pruning old rows |

The dispatcher inserts here **before** running a handler; a uniqueness violation
means the event was already processed and is skipped.

---

## Provider-Neutral Field Naming

Once payment logic moves behind the provider abstraction (FR-020a), Stripe-specific
field names on Transaction become misleading for rows originating from another gateway:

| Current | Renamed to |
|---------|-----------|
| `stripe_payment_intent_id` | `gateway_reference` |
| `stripe_charge_id` | `gateway_charge_id` |
| `stripe_receipt_url` | `receipt_url` |

Rename-only migration, no data loss. `StudentOrderHistorySerializer` reads these
fields and must be updated in the same change.

---

## Service Layer

The service layer (email senders, checkout service, refund service, fulfillment,
webhook dispatch) is implemented as Python classes and functions, not database
models. Notably there is **no `Payment` model and no repository layer** — the
existing `Order` / `Transaction` / `Enrollment` trio already models the domain,
and Django's Manager/QuerySet already provides the query seam a repository would
duplicate.

---

## Migration Plan

All changes are additive, nullable, or renames — no data loss risk:

1. **Migration 1**: Transaction — make `stripe_charge_id` nullable, rename `stripe_receipt_id` → `stripe_receipt_url` (nullable), add `payment_method_type`, fix choices format
2. **Migration 2**: Order — fix choices format
3. **Migration 3**: Enrollment — add `unique_together` constraint
4. **Migration 4**: Lecture — change `video_url` to URLField with max_length=500
5. **Migration 5** *(gateway abstraction)*: Order — add `payment_gateway`, add unique `idempotency_key`; create `ProcessedWebhookEvent`; rename Transaction's three `stripe_*` fields to provider-neutral names

**Order matters**: Migration 1 must run before any code changes to the webhook handler, since the current handler crashes on Transaction creation. Migration 5 must run before the provider adapter is wired into the views, since the serializers read the renamed fields.
