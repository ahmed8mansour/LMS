# Tasks: Production Readiness Audit

**Input**: Design documents from `/specs/002-production-readiness-audit/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `backend/` (Django)
- **Frontend**: `front-end/src/` (Next.js)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and prepare configuration

- [x] T001 Install `django-anymail[sendgrid]` and update `backend/requirements.txt`
- [x] T002 Add `SENDGRID_API_KEY`, `DEFAULT_FROM_EMAIL`, and `SERVER_EMAIL` entries to `backend/.env` (placeholder values)
- [x] T003 [P] Add `ALLOWED_HOSTS` env var entry to `backend/.env`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Settings hardening and database migrations that MUST complete before any user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Settings Hardening

- [x] T004 Fix `DEBUG = env('DEBUG')` → `DEBUG = env.bool('DEBUG', default=False)` in `backend/config/settings.py:22`
- [x] T005 [P] Fix `ALLOWED_HOSTS = []` → `ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])` in `backend/config/settings.py:24`
- [x] T006 [P] Remove `CORS_ALLOW_ALL_ORIGINS = True` (line 114) and add `CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=['http://localhost:3000'])` in `backend/config/settings.py`
- [x] T007 [P] Add `'anymail'` to `INSTALLED_APPS`, configure `EMAIL_BACKEND = 'anymail.backends.sendgrid.EmailBackend'`, add `ANYMAIL` dict and `DEFAULT_FROM_EMAIL` in `backend/config/settings.py`
- [x] T008 [P] Set `ROTATE_REFRESH_TOKENS: True` in `SIMPLE_JWT` config in `backend/config/settings.py:221`
- [x] T009 [P] Add DRF throttle configuration (`DEFAULT_THROTTLE_CLASSES`, `DEFAULT_THROTTLE_RATES` with scopes: `login: 5/min`, `otp: 3/min`, `register: 3/min`) to `REST_FRAMEWORK` dict in `backend/config/settings.py`
- [x] T010 [P] Fix `Order.status` and `Transaction.status` field choices from set literals `{}` to list of tuples `[]` in `backend/apps/enrollment/models.py`
- [x] T011 [P] Fix `Transaction.currency` field choices from set literal to list of tuples in `backend/apps/enrollment/models.py`

### Database Migrations

- [x] T012 Make `Transaction.stripe_charge_id` nullable (`null=True, blank=True`), rename `stripe_receipt_id` → `stripe_receipt_url` (`URLField, null=True, blank=True`), add `payment_method_type = CharField(max_length=50, default='card')` in `backend/apps/enrollment/models.py`
- [x] T013 [P] Add `unique_together = ['user', 'course']` to `Enrollment.Meta` in `backend/apps/enrollment/models.py`
- [x] T014 [P] Change `Lecture.video_url` from `CharField(max_length=255555)` to `URLField(max_length=500)` in `backend/apps/course/models.py`
- [x] T015 Run `python manage.py makemigrations enrollment course` and `python manage.py migrate` to apply all model changes

**Checkpoint**: Settings are hardened, database schema is production-ready. User story implementation can now begin.

---

## Phase 3: User Story 1 — Students Receive Real Emails (Priority: P1) 🎯 MVP

**Goal**: Replace console email backend with SendGrid via django-anymail. All OTP and password-reset emails are delivered to real inboxes.

**Independent Test**: Register a new account with a real email address → OTP arrives in inbox within 30 seconds.

### Implementation for User Story 1

- [x] T016 [US1] Create Strategy-pattern email system in `backend/apps/enrollment/service.py`: `Sender` (ABC), `EmailService` (context with centralized `AnymailRequestsAPIError`/`AnymailRecipientsRefused`/`Exception` handling), `OTPEmailSender`, `PaymentConfirmationEmailSender`, `RefundConfirmationEmailSender`
- [x] T017 [US1] Remove old `send_otp_email()` from `backend/apps/authentication/utils.py`, clean unused `send_mail` import, remove `send_otp_email` from views.py import, update 3 remaining callers in serializers.py to use `EmailService(OTPEmailSender(...)).process_sending()`
- [x] T018 [US1] All 4 serializer call sites now check `process_sending()` return value and raise `ValidationError({'error': 'Failed to send OTP email. Please try again.'})` on failure. `CustomUserRegisterSendOTPSerializer.create()` wrapped in `transaction.atomic()` to rollback user+OTP creation if email fails.
- [x] T019 [US1] OTP expiry check active in `UserForgetPasswordSendOTPSerializer` in `backend/apps/authentication/serializers.py`

**Checkpoint**: Real emails are sent for registration, forget-password, and Google set-password flows. Email failures surface errors to users.

---

## Phase 4: User Story 2 — Students Watch Real Course Videos (Priority: P1) ✅ DONE

**Goal**: Videos upload directly from the browser to Cloudinary (chunked, no server passthrough). Cloudinary transcodes to adaptive HLS. Students stream with an adaptive (Vidstack/hls.js) player. The playback URL is a computed field on the lecture representation — no dedicated per-video endpoint, no N+1.

**Provider**: Cloudinary (managed) with `sp_auto` streaming profile, eager-async HLS generation, public delivery (token/signed delivery is a paid feature — deferred).

**Architecture**: `apps/course/video/` package — `VideoProvider` ABC (Strategy/DIP), `CloudinaryVideoProvider` (Adapter over Cloudinary SDK), `get_video_provider()` (Factory), `VideoUploadService` + `VideoWebhookService` (Facades). Swapping to Mux/Cloudflare later = one new provider class.

**Race-free by design**: the signature endpoint assigns a deterministic `public_id` to the lecture and persists it *before* the upload starts, so the completion webhook always finds the row to update regardless of upload/webhook ordering. This replaced an earlier fragile "PATCH-attach + check_status polling" approach that got stuck at PROCESSING whenever the webhook (fast transcode) beat the client's attach call.

**Verified end-to-end**: instructor requests signature (via Apidog) → direct chunked upload to Cloudinary → webhook marks lecture COMPLETED → enrolled student streams adaptive HLS in the browser via the Vidstack player. Confirmed working.

**Scope note**: T028 (instructor upload UI) is deferred — there is no instructor lecture-authoring page in the frontend yet (lectures are created via Django admin/API only), consistent with course-management/authoring UI being a future feature outside this audit. The backend upload-signature endpoint exists and is ready for that future UI to call.

### Configuration (manual, one-time — done)

- [x] T020a [US2] Cloudinary dashboard: create a **signed** upload preset `lms_lecture_video` (resource type Video, folder `lms/lectures`, eager `sp_auto/m3u8` with eager-async ON); set the Notification URL (webhook) to the backend video webhook endpoint
- [x] T020b [US2] Add `VIDEO_PROVIDER = 'cloudinary'` and `CLOUDINARY_VIDEO_WEBHOOK_URL = env('CLOUDINARY_VIDEO_WEBHOOK_URL')` to `backend/config/settings.py`

### Backend — Model & Migration

- [x] T020 [US2] `Lecture.video_url` replaced with `video_public_id` (`CharField`, nullable) and `video_status` (`CharField(max_length=20)`, choices `PENDING/PROCESSING/COMPLETED/FAILED`, default `PENDING`) in `backend/apps/course/models.py`. Fixed two bugs found during review: missing `max_length` on `video_status` (Django requires it, was silently passing only because migrations ran with `--skip-checks`), and default `'pending'` not matching any uppercase choice. New migration `0016_alter_lecture_video_status.py` (never edits the existing `0015_...`) alters the field and data-migrates any stray lowercase `'pending'` rows to `'PENDING'`. Applied.

### Backend — Video Provider Package (SOLID + GoF)

- [x] T021 [US2] `backend/apps/course/video/base.py` — `VideoProvider` ABC + `UploadCredentials` / `WebhookResult` dataclass DTOs
- [x] T022 [US2] `backend/apps/course/video/cloudinary_provider.py` — `CloudinaryVideoProvider(VideoProvider)` (Adapter): `generate_upload_credentials(folder, public_id=None)` (pins a provided public_id and drops `folder` to avoid double-nesting), `build_streaming_url` (sp_auto/m3u8), `verify_webhook` (Cloudinary's `SHA1(body + timestamp + api_secret)` scheme — **not** `api_sign_request`, which is for outgoing API calls and would have rejected every real webhook), `parse_webhook` (returns uppercase `COMPLETED`/`PROCESSING`/`FAILED` matching the model choices).
- [x] T023 [US2] `backend/apps/course/video/factory.py` — `get_video_provider()` reading `settings.VIDEO_PROVIDER`
- [x] T024 [US2] `backend/apps/course/video/service.py` — `VideoUploadService.credentials_for(lecture=None)` (when a lecture is passed, generates `lms/lectures/lecture_<id>_<uuid>`, saves it on the lecture as `PENDING` before upload, then signs it in) and `VideoWebhookService.handle(...)` (verify → parse → update lecture by `video_public_id`).
- [x] T024a [US2] `backend/apps/course/video/access.py` (new) — `can_access_lecture_video(request, course)`: gates the streaming URL to the course-owning instructor, any admin, or an actively enrolled student; memoizes per-course on the request object so a section/course response with N lectures does one enrollment query, not N.

### Backend — Endpoints

- [x] T025 [US2] `POST /courses/video/upload-signature/` — `VideoUploadSignatureView`, `IsAuthenticated` + `(isInstructor | isAdmin)`. Accepts optional `lecture_id`: when present, resolves the lecture with an ownership check (owner-instructor or admin) and binds the upload to it (race-free public_id assignment); when absent, issues generic folder-based credentials. Registered in `backend/apps/course/urls.py`.
- [x] T026 [US2] `POST /courses/video/webhook/` — `VideoWebhookView`, `AllowAny` (verified via Cloudinary's `X-Cld-Signature`/`X-Cld-Timestamp` headers instead of JWT). Registered.
- [x] T027 [US2] `LectureSerializer` rewritten in `backend/apps/course/serializers.py`: explicit `fields` (the old `exclude = ['video_url']` referenced a field that no longer existed and would have crashed at import time); `video_url` is a `SerializerMethodField` returning `None` unless `video_status == 'COMPLETED'` **and** `can_access_lecture_video()` passes; `video_status` is read-only; `video_public_id` is NOT client-writable (managed entirely by the video subsystem — assigned at signature time, updated by the webhook — so the earlier PATCH-attach `create`/`update` overrides were removed). Also fixed `SectionSerializer.to_representation()`, which built `LectureSerializer(...)` **without** `context=self.context` — the request (and therefore all access-gating) would never have reached the lecture serializer.
- [x] T027a [US2] Fixed a second, independent break in `backend/apps/progress/serializers.py`: `LectureProgressSerializer` (the serializer actually used by the student lecture-detail endpoint, `EnrolledLectureDetailView`) still declared `'video_url'` as a `Meta.fields` entry referencing the old model field — this predates this session and would have crashed on first use. Replaced with a computed `video_url` (`SerializerMethodField`) plus exposed `video_status`; enrollment/unlock access is already enforced at the view level before this serializer runs, so it only checks `video_status == 'COMPLETED'`.

### Frontend — Playback

- [x] T029 [US2] Installed **Vidstack** `@vidstack/react@1.15.6` (the modern React-19-compatible line ships under the npm `next` dist-tag; plain `@latest`/`*` resolves to the ancient React-18-only `0.6.15`, which is what silently blocked the first attempt) + `hls.js`. Rewrote `HlsVideoPlayer` (`front-end/src/components/molecules/HlsVideoPlayer.tsx`) to use Vidstack's `MediaPlayer` + `DefaultVideoLayout` (full controls: play/pause/seek/volume/fullscreen/quality/settings), wired to the locally bundled `hls.js` via `onProviderChange` (no runtime CDN dependency), with "processing"/"failed" placeholder states when `video_status !== 'COMPLETED'`. Wired into `LectureContent.tsx`, replacing the plain `<video>` that could never play adaptive `.m3u8` outside Safari. Updated `Lecture` type in `progress.types.ts` (`video_url: string | null`, added `video_status`). Typechecks clean; confirmed playing in the browser.
- [ ] T028 [US2] Deferred — see scope note above (instructor upload UI, future feature/spec).

**Checkpoint**: ✅ Full pipeline verified end-to-end — signature (race-free public_id binding) → direct chunked upload to Cloudinary → webhook → computed, access-gated streaming URL → adaptive HLS playback in the Vidstack player. Provider-swappable via `settings.VIDEO_PROVIDER`. Only the instructor upload UI (T028) is intentionally deferred to a future course-authoring feature.

---

## Phase 5: User Story 3 — Payment Confirmation & Invoice (Priority: P1)

**Goal**: Send confirmation emails on successful payment with Stripe-hosted receipt links. Show receipt links in billing dashboard.

**Independent Test**: Complete a course purchase → confirmation email arrives with receipt link → billing dashboard shows receipt link for the order.

### Implementation for User Story 3

- [x] T030 [US3] Update `handle_payment_succeeded` in `StripeWebhookView` to: retrieve `latest_charge` from Stripe, populate `stripe_charge_id`, `stripe_receipt_url`, and `payment_method_type` on Transaction in `backend/apps/enrollment/views.py`
- [x] T031 [US3] Send payment confirmation via `EmailService(PaymentConfirmationEmailSender(...)).process_sending()` (the Strategy-pattern API established in Phase 3) in `handle_payment_succeeded` after enrollment creation in `backend/apps/enrollment/views.py`
- [x] T032 [US3] Fix `handle_payment_failed` to handle nullable `stripe_charge_id` and `stripe_receipt_url` when creating Transaction in `backend/apps/enrollment/views.py`
- [x] T033 [US3] Update `StudentOrderHistorySerializer` to expose `stripe_receipt_url` as `receipt_url` field and replace hardcoded `"card"` with actual `payment_method_type` from Transaction in `backend/apps/enrollment/serializers.py`
- [x] T034 [P] [US3] Update `TransactionHistory.tsx` to display receipt link (clickable URL to Stripe-hosted receipt) and actual payment method instead of hardcoded "Card" in `front-end/src/featuers/enrollment/components/billing/TransactionHistory.tsx`

**Checkpoint**: Payments trigger confirmation emails. Billing dashboard shows receipt links and actual payment methods.

---

## Phase 6: User Story 4 — Security Hardening (Priority: P1)

**Goal**: Rate-limit auth endpoints, remove debug output, fix auth inconsistencies, fix datetime usage.

**Independent Test**: Attempt 6+ rapid login attempts → 6th returns 429. Check server output → zero sensitive data visible.

### Implementation for User Story 4

- [x] T035 [US4] Add `throttle_scope = 'login'` to `UserLoginView`, `GoogleLoginAPIView`, `GoogleRegisterAPIView` in `backend/apps/authentication/views.py`
- [x] T036 [P] [US4] Add `throttle_scope = 'otp'` to `UserForgetPasswordSendOTPView`, `GoogleSetPasswordSendOTPView` in `backend/apps/authentication/views.py`. **Extended beyond the original task scope** (flagged post-review, spec's FR-003/FR-008/FR-009 only covered OTP-*sending* endpoints, leaving OTP-*verification* unthrottled and brute-forceable): also added `throttle_scope = 'otp'` to `UserRegisterVerifyOTPView`, `UserForgetPasswordVerifyOTPView`, and `GoogleSetPasswordVerifyOTPView`
- [x] T037 [P] [US4] Add `throttle_scope = 'register'` to `UserRegisterSendOTPView`, `UserResendOTPView` in `backend/apps/authentication/views.py`
- [x] T038 [US4] Replace all `print()` statements with `logging` calls in `backend/apps/authentication/views.py` (registration request/OTP-sent flow, JWT-cookie-set flow, token refresh failure) — sensitive values (password, cookie/token contents) are never logged, only ids/emails
- [x] T039 [P] [US4] Removed the two leftover debug `print(data)` calls in `CustomUserRegisterSendOTPSerializer.to_representation()` in `backend/apps/authentication/serializers.py` — `data` already excludes the write-only password field, and the duplicate prints carried no operational value
- [x] T040 [P] [US4] No-op: `backend/apps/authentication/utils.py` no longer contains a `print()` call — the old `send_otp_email()` (and its print) was already removed in Phase 3 (T017)
- [x] T041 [P] [US4] Replace `print()` statements with `logging` calls in `backend/apps/progress/views.py` (dashboard overview/courses flow events)
- [x] T042 [US4] Fix `UserSetPasswordView` to use `authentication_classes = [CookieJWTAuthentication]` instead of `JWTAuthentication` in `backend/apps/authentication/views.py`
- [x] T043 [P] [US4] Remove dead `JWTAuthentication` import in `backend/apps/course/views.py`
- [x] T044 [P] [US4] Replace `datetime.utcnow()` with `datetime.now(timezone.utc)` in `backend/apps/authentication/views.py` and `backend/apps/authentication/utils.py` (both access/refresh token cookie expirations)

**Checkpoint**: Auth endpoints are rate-limited. Zero sensitive data in logs. All endpoints use consistent cookie-based auth.

---

## Phase 7: User Story 5 — Refunds & Multiple Payment Methods (Priority: P2)

**Goal**: Admin-only refund endpoint with 14-day window. Enable additional Stripe payment methods (Apple Pay, Google Pay). Then refactor payment handling behind a provider abstraction so a second gateway (PayPal) is one new class plus one settings value.

**Independent Test**: As admin, POST to refund endpoint with a paid order → refund processed, enrollment deactivated, email sent. On checkout, additional payment methods appear.

**Two parts**: T045–T050 (refund feature, **done**) delivered the behaviour directly against the Stripe SDK. T050a–T050n then relocate that same behaviour behind a `PaymentGateway` abstraction — no user-visible change, but it is what makes FR-020's multi-gateway goal reachable. The refund/webhook logic written in T045–T048 is **moved, not rewritten**, by T050f–T050i.

### Implementation for User Story 5

- [x] T045 [US5] Create `RefundService` (+ `RefundError`) in `backend/apps/enrollment/service.py` (kept in the existing Phase-3 `service.py`, not a new `services.py`, to match the file already established for `EmailService`) with method `process_refund()` — validates eligibility (paid status, within 14 days), calls `stripe.Refund.create()`, atomically updates order to `refunded`, deactivates the enrollment, decrements `subscribers_count`/`students_count` via F-expressions, creates a `refunded` Transaction record, sends refund confirmation email. Idempotent (re-checks status under `select_for_update()`) so it can't double-process against the `charge.refunded` webhook.
- [x] T046 [US5] Create `AdminRefundOrderView` (POST) with `isAdmin` permission and `CookieJWTAuthentication` in `backend/apps/enrollment/views.py` — accepts `order_id`, 404s if missing, delegates to `RefundService`, returns `{message, order_id, refund_amount, stripe_refund_id}` per contracts/api-changes.md
- [x] T047 [US5] Create `RefundOrderSerializer` for request-shape validation in `backend/apps/enrollment/serializers.py` (existence check left to the view so a missing order returns 404, not a 400 field error)
- [x] T048 [US5] Add `charge.refunded` webhook event handler (`handle_charge_refunded`) in `StripeWebhookView.post()` — finds order by `payment_intent`, updates order/enrollment/transaction atomically, idempotent against `RefundService` in `backend/apps/enrollment/views.py`
- [x] T049 [US5] Register refund endpoint URL `refund-order/` in `backend/apps/enrollment/urls.py`
- [x] T050 [P] [US5] Verified by code inspection: `PaymentElement` in `CourseCheckout.tsx` is the generic Stripe element with no method allowlist, and `CreatePaymentIntentView` already sets `automatic_payment_methods={'enabled': True, 'allow_redirects': 'never'}` (`backend/apps/enrollment/views.py`) — Apple Pay/Google Pay render automatically when the Stripe account has them enabled and the browser/device supports them. No code changes needed; end-to-end wallet testing requires a real device with a wallet configured, which isn't available in this environment.

**Checkpoint**: Admins can process refunds within 14 days. Refund webhooks handled. Multiple payment methods visible at checkout.

---

### Payment Gateway Abstraction (T050a–T050n)

**Why this is in US5 and not a separate feature**: US5's story text already scopes "students can choose between multiple payment methods (card, PayPal)", and FR-020 requires provider extensibility. T045–T050 satisfied the *refund* half of US5 but hardcoded Stripe throughout, so the multi-gateway half is unreachable without this refactor.

**Mirrors the existing `apps/course/video/` package** (`VideoProvider` ABC → `CloudinaryVideoProvider` adapter → `get_video_provider()` factory → thin service facades). Deliberately reuses that structure so the codebase has **one** provider-abstraction idiom, not two competing ones.

**Design decisions (and what was rejected)** — recorded so they aren't re-proposed later:

| Decision | Rationale |
|---|---|
| `initiate_payment()`, **not** `pay()` | Stripe and PayPal are both two-phase (create → client approves → webhook fulfills). `pay()` implies a synchronous charge neither provider does — a `PaymentIntent` is `requires_payment_method` immediately after creation, so a `success = status == 'succeeded'` check would always be False. |
| Named `initiate_payment`/`PaymentAttempt`, **avoiding** "checkout"/"session" | **The existing PaymentIntents flow is preserved — this is not a move to Stripe Checkout.** Stripe ships a separate product whose API object is literally `stripe.checkout.Session`: a hosted redirect page emitting `checkout.session.completed`, incompatible with the embedded `PaymentElement` already built. Naming the DTO `CheckoutSession` would invite exactly that wrong implementation. `PaymentAttempt` collides with no object in either provider's SDK. |
| Factory takes **no** gateway-specific kwargs | Each gateway reads its own settings, exactly like `CloudinaryVideoProvider()`. Passing `api_key=`/`client_id=` at the call site leaks the provider into the composition root and defeats the factory. |
| if/elif factory, **no** `register()` registry | Two self-owned gateways. A runtime plugin registry is for third-party extension, which is not a requirement here. |
| **No** repository layer | Django's Manager/QuerySet is already the repository. A wrapper adds a layer with no new seam, and assumes a single `Payment` model that does not match this project's `Order`/`Transaction`/`Enrollment` schema. |
| **No** gateway decorators | Logging goes in the service as plain `logger` calls. Decorators pay off when stacking retry + metrics + circuit-breaker; a single logging decorator adds an interface-conformance burden and silently drops any capability it forgets to re-declare. |
| Combined `parse_and_verify()` | Stripe's `construct_event()` verifies and parses in one call. Splitting them parses an **unverified** payload and constructs the event twice — a regression against the T026/T048 code. |
| Flat ABC — no `Refundable`/`WebhookVerifiable` split | The ISP split forces `isinstance(gateway, Refundable)` checks at every call site, reintroducing the type-coupling the abstraction removes. Both target gateways support all four operations. Revisit only if a gateway that genuinely cannot refund is added. |
| Full refunds only — no `amount` param, no `PARTIALLY_REFUNDED` status | Current product rule (FR-018) is a full refund within 14 days. Add when actually required. |
| Fulfillment is a **separate layer** from the gateway | Enrollment activation, counter updates and emails are domain concerns, not provider concerns. Keeping them split is what stops logic drifting back into the view. |

**Target structure** — `backend/apps/enrollment/payments/`: `exceptions.py`, `dto.py`, `base.py`, `stripe_gateway.py`, `factory.py`, `service.py`, `fulfillment.py`, `webhooks.py` (+ `paypal_gateway.py` in future). `apps/enrollment/service.py` keeps the existing `EmailService` strategy classes; only `RefundService` moves.

#### Models & migrations (new migrations only — never edit existing ones)

- [x] T050a [US5] Add `Order.payment_gateway = CharField(max_length=20, default='stripe')` in `backend/apps/enrollment/models.py` — needed to route refunds and webhooks for orders created under a different gateway. **Correction applied**: this and T050b were first implemented on `Transaction` (self-implemented before this pass); moved to `Order` via a follow-up migration (see T050e) since `Transaction` rows don't exist yet at checkout-initiation time, when the idempotency check actually needs to fire, and a paid Order can accumulate several Transaction rows (failed retry, then paid, then refunded) with no single one authoritative for "which gateway owns this order"
- [x] T050b [US5] Add `Order.idempotency_key = CharField(max_length=255, null=True, blank=True, unique=True)` in `backend/apps/enrollment/models.py`. The unique constraint is the actual guard; `CheckoutService.start_checkout` (T050l) creates the Order inside `try: / except IntegrityError:`, never check-then-create
- [x] T050c [US5] Create `ProcessedWebhookEvent` model (`event_id` unique, `gateway`, `received_at`) in `backend/apps/enrollment/models.py`
- [x] T050d [US5] Rename `Transaction.stripe_payment_intent_id`/`stripe_charge_id`/`stripe_receipt_url` → `gateway_reference`/`gateway_charge_id`/`receipt_url` in `backend/apps/enrollment/models.py`; `StudentOrderHistorySerializer.get_receipt_url` updated to read `receipt_url`. `Order.stripe_payment_intent_id` is intentionally left unrenamed — no task scoped that rename, and `Order` is otherwise gateway-agnostic already via `payment_gateway`
- [x] T050e [US5] `makemigrations enrollment` + `migrate`. Two migrations, not one: `0019_processedwebhookevent_and_more` (T050c/T050d, pre-existing) plus a new `0020_remove_transaction_idempotency_key_and_more` (the T050a/T050b correction — moves the two fields Transaction→Order). `0019` was never edited, per the no-edit-existing-migrations rule

#### Package: DTOs, exceptions, ABC

- [x] T050f [P] [US5] `payments/exceptions.py` — base is `PaymentException` (not `PaymentError` — kept the self-implemented name to avoid rewriting already-correct code). Trimmed the self-implemented version back toward the agreed set: `CardDeclinedError` renamed to `PaymentDeclinedError` (matches the T050n mapping table), `InsufficientFundsError` dropped (pure duplicate of `PaymentDeclinedError` with nothing anywhere to distinguish it). Kept beyond the original 5: `PaymentNotFoundError` (gateway doesn't recognize a reference — mapped from Stripe's `InvalidRequestError` in `get_status`/`refund`/`retrieve_attempt`) and `DuplicatePaymentError` (carries `order_id`; raised by `CheckoutService` on the idempotency-key `IntegrityError` so the view never sees a raw DB exception — same pattern as the existing `RefundError`)
- [x] T050g [P] [US5] `payments/dto.py` — all four DTOs now `@dataclass(frozen=True)` (self-implemented version wasn't frozen). Renamed `CheckoutRequest`/`CheckoutSession` → `PaymentRequest`/`PaymentAttempt` (see the naming row above — avoids colliding with Stripe's own `checkout.Session` object). `PaymentEvent` gained `event_id: str` (the provider's own event id, e.g. Stripe `evt_xxx`) — an omission in this task's original field list, needed because `event_id` is what `ProcessedWebhookEvent` (T050c) actually dedupes on; `reference` is the payment_intent/charge id and is *shared* across multiple distinct events, so it can't serve that purpose. `RefundResult` gained `charge_id: Optional[str]` so `fulfillment.deactivate_enrollment` can record the correct charge on the refund Transaction row (previously only the refund's own id was available). `charge_id`/`receipt_url` on `PaymentEvent` are `Optional[str]`, matching T032's nullable-on-failure handling
- [x] T050h [P] [US5] `payments/base.py` — `PaymentGateway` ABC. Gained a 5th method beyond this task's original four: `retrieve_attempt(reference) -> PaymentAttempt`, discovered during T050n — `GetOrderDetailsView` (payment-retry / refresh recovery) needs a fresh `client_secret`, which `get_status()` (returns only a `PaymentStatus` enum) can't provide

#### Adapter & wiring

- [x] T050i [US5] `payments/stripe_gateway.py` — `StripeGateway(PaymentGateway)`. Stayed on the PaymentIntents API as planned. Implements all five ABC methods (including `retrieve_attempt`, added at T050h). `stripe.error.InvalidRequestError` → `PaymentNotFoundError`; every other `stripe.error.StripeError` → `GatewayError`; `stripe.error.CardError` → `PaymentDeclinedError`. Verified: this is the **only** file in the app importing `stripe` or calling `stripe.*` (see exit criterion)
- [x] T050j [US5] `payments/factory.py` — `get_payment_gateway(name=None)` reading `settings.PAYMENT_GATEWAY` (added, default `'stripe'`), no kwargs, `ImproperlyConfigured` on unknown
- [x] T050k [US5] `payments/fulfillment.py` — `activate_enrollment(order, event)`, `deactivate_enrollment(order, event)`, plus one not originally scoped here: `record_failed_payment(order, event)` for the `payment_intent.payment_failed` path (T032), which has no enrollment/email side effects so didn't fit either named function. All three take a `PaymentEvent` — including the admin-refund path, where `RefundService` (T050l) adapts its `RefundResult` into a synthetic `PaymentEvent` before calling `deactivate_enrollment`, so both the webhook and the admin-refund path finalize through identical code
- [x] T050l [US5] `payments/service.py` — `CheckoutService.start_checkout(user, course)`: builds a deterministic `idempotency_key = f"user:{user.id}:course:{course.id}"`, creates the Order inside `try:/except IntegrityError:`, and on collision looks up the existing pending Order and raises `DuplicatePaymentError(order_id=...)` — the frontend isn't wired to branch on this yet (that's the existing, still-open T070 payment-retry task), but the backend contract is in place. `RefundService` moved from `apps/enrollment/service.py` (which now holds only `EmailService` + the three `*Sender` classes again); routes refunds through `get_payment_gateway(order.payment_gateway)` so a future PayPal-originated order refunds via PayPal, not whatever `settings.PAYMENT_GATEWAY` currently defaults to
- [x] T050m [US5] `payments/webhooks.py` — `WebhookDispatcher(gateway_name=...).dispatch(payload, signature)`. Plain `_HANDLERS` dict, no `Protocol`/registry. Dedupes on `ProcessedWebhookEvent.event_id` **after** `parse_and_verify()` but **before** invoking the handler — verified by test that a re-delivered event triggers no second email/Transaction. Note: parsing still re-fetches the Stripe Charge on every delivery (even ones that turn out to be dupes), since verification necessarily precedes the dedupe check; this matches pre-refactor behavior, not a new inefficiency

#### Views

- [x] T050n [US5] `CreatePaymentIntentView`, `GetOrderDetailsView`, `AdminRefundOrderView` now thin; `StripeWebhookView` renamed to `PaymentWebhookView(gateway='stripe')` (URL kwarg) so a second provider gets its own endpoint without a new view class. One shared `_EXCEPTION_STATUS` mapping in `views.py`: `PaymentDeclinedError`→402, `RefundNotAllowedError`→400, `WebhookVerificationError`→400, `PaymentNotFoundError`→404, `DuplicatePaymentError`→409 (body includes `order_id` when available), `GatewayError`→502. `backend/apps/enrollment/urls.py`: added `webhook/<str:gateway>/` (`payment_webhook`), kept `payment-webhook/` (`intent_webhook`) as an alias to both point at `PaymentWebhookView` until the Stripe dashboard endpoint is updated. Signature-header extraction (`HTTP_STRIPE_SIGNATURE`) is still Stripe-specific in the view — noted as a known gap for when a second gateway with a different verification header shape is added

**Exit criterion**: verified — `grep -rln "import stripe\|stripe\.[A-Za-z]" backend/apps/enrollment/ --include=*.py` returns only `payments/stripe_gateway.py`. (The bare string `"stripe"` still appears elsewhere — the `payment_gateway='stripe'` config value, the unrenamed `Order.stripe_payment_intent_id` column, and `stripe_refund_id` in the API response body — none of which are the SDK.)

**Verification**: full mocked smoke test (Stripe calls patched, run inside a rolled-back DB transaction) exercised: checkout creation → duplicate-checkout rejection with correct `order_id` → `payment_intent.succeeded` webhook (enrollment activated, Transaction recorded with renamed fields, counters incremented via the existing signal) → re-delivered webhook deduped (no second email) → admin refund (order refunded, enrollment deactivated, counters decremented) → `charge.refunded` webhook arriving after the admin refund (idempotent, no duplicate Transaction row). All passed. `manage.py check` clean.

**Checkpoint**: Admins can process refunds within 14 days. Refund webhooks handled. Multiple payment methods visible at checkout. Payment provider is swappable via `settings.PAYMENT_GATEWAY`, with no `stripe` import outside the adapter.

### Future: adding PayPal (out of scope for this audit)

Not tasks — the acceptance test for whether T050a–T050n actually worked. Adding PayPal should be exactly: (1) `paypal_gateway.py` implementing the four ABC methods, (2) one `elif` in `factory.py`, (3) a PayPal settings block, (4) its own webhook event-name mapping into the same `PaymentEvent` DTO, (5) frontend branching on `approval_url` vs `client_secret` in `CourseCheckout.tsx`. **No changes to services, fulfillment, views, or models.** If any of those need touching, the abstraction has a leak worth fixing before the gateway ships.

---

## Phase 8: User Story 6 — Data Integrity Protections (Priority: P2)

**Goal**: Enforce data integrity at backend level — password validation, serializer validation, broken serializer fix.

**Independent Test**: Submit weak password via API → rejected. Submit quiz without serializer → proper 400 error.

### Implementation for User Story 6

- [x] T051 [US6] Add backend password strength validation to registration and password-change serializers (call `django.contrib.auth.password_validation.validate_password()`) in `backend/apps/authentication/serializers.py`
- [x] T052 [P] [US6] Fix `GoogleSetPasswordNewPasswordSerializer` — remove reference to non-existent `user.can_change_password` field in `backend/apps/authentication/serializers.py`
- [x] T053 [P] [US6] Create `MarkLectureCompleteSerializer` with `lecture_id` field validation, replace raw `request.data['lecture_id']` access in `MarkLectureCompleteView` in `backend/apps/progress/views.py`
- [x] T054 [P] [US6] Create `SubmitQuizSerializer` with `quiz_id` and `answers` field validation, replace raw `request.data` access in `SubmitQuizView` in `backend/apps/progress/views.py`
- [x] T055 [US6] Add free course enrollment: create `FreeEnrollmentView` (POST) in `backend/apps/enrollment/views.py` — validate `course.price == 0`, create Order with `stripe_payment_intent_id='free_enrollment'` and `status='paid'`, create Enrollment directly
- [x] T056 [US6] Create `FreeEnrollmentSerializer` for request validation in `backend/apps/enrollment/serializers.py`
- [x] T057 [US6] Register free enrollment URL `enroll-free/` in `backend/apps/enrollment/urls.py`
- [x] T058 [US6] Add payment retry: modify `GetOrderDetailsView` to accept orders with `status in ('pending', 'failed')`, check PaymentIntent status via Stripe API, reset order to `pending` or create new PaymentIntent if terminal in `backend/apps/enrollment/views.py`

**Checkpoint**: Backend rejects weak passwords. Serializer validation prevents raw KeyError crashes. Free courses enrollable. Failed payments retryable.

---

## Phase 9: User Story 7 — Code Quality & Consistency Cleanup (Priority: P3)

**Goal**: Fix duplicate URL names, remove dead code, standardize errors, clean up frontend.

**Independent Test**: All API errors follow `{"error": "message"}` or `{"field": ["message"]}` format. No console.log in frontend. No hardcoded fake data in UI.

### Implementation for User Story 7

- [x] T059 [US7] Fix duplicate URL names in `backend/apps/authentication/urls.py`: line 21 `"user_verifyOTP"` → `"user_resendOTP"`, line 23 `"user_login"` → `"user_logout"`
- [x] T060 [P] [US7] Fix duplicate URL names in `backend/apps/progress/urls.py`: assign unique names to all 4 views currently named `"homepage"` (e.g., `student_overview`, `student_courses`, `enrolled_course_detail`, `enrolled_section_detail`), fix `SubmitQuizView` name from `"mark_lecture_complete"` to `"submit_quiz"`
- [x] T061 [P] [US7] Remove no-op `save_user_profile` signal handler (function body is just `pass`) in `backend/apps/authentication/signals.py`
- [x] T062 [P] [US7] Fix `UserProfileUpdateView` to return `HTTP_400_BAD_REQUEST` instead of `HTTP_404_NOT_FOUND` on validation errors in `backend/apps/authentication/views.py:219`
- [x] T063 [P] [US7] Set production pagination page sizes from 2 to 10 in `backend/apps/enrollment/pagination.py` and `backend/apps/reviews/pagination.py`
- [x] T064 [US7] Permanently remove "Add to Cart" button from `front-end/src/featuers/enrollment/components/CourseEnrollCard.tsx`
- [x] T065 [P] [US7] Permanently remove hardcoded "$149.99" and "40% Off" discount display from `front-end/src/featuers/enrollment/components/CourseEnrollCard.tsx`
- [x] T066 [P] [US7] Fix stale TypeScript types: remove `tokens` field from `VerifyOTPResponse`, fix `ForgetPasswordResetResponse.user_data` from `string` to object, fix `SpecificData = any` in `front-end/src/featuers/auth/types/auth.types.ts`
- [x] T067 [P] [US7] Remove all `console.log` statements from frontend production code — search across `front-end/src/` and delete
- [x] T068 [P] [US7] Replace `any` types with proper types in frontend hooks and types — `error: any` → `error: AxiosError` in `onError` callbacks and `data: any` → proper response types in `onSuccess` callbacks across 18+ hooks in `front-end/src/featuers/`
- [x] T069 [US7] Add free enrollment support to frontend: create `useFreeEnrollment` hook and API function in `front-end/src/featuers/enrollment/`, update `CourseEnrollCard.tsx` to call free enrollment endpoint when `course.price === 0`
- [x] T070 [P] [US7] Update `CourseCheckout.tsx` to support payment retry — `useEffect` redirects when `already_paid` is true, `!client_secret` guard prevents rendering `Elements` without a secret in `front-end/src/featuers/enrollment/components/CourseCheckout.tsx`
- [x] T071 [US7] Standardize error response format: audited all views across 5 apps, fixed 9 issues — `{"error": [list]}` → joined string, `{"error": serializer.errors}` → direct `serializer.errors`, `{"error": ...}` with 200 → proper empty-state responses, non-standard keys → `{"error": "message"}`, `{"detail": ...}` → `{"error": ...}`

**Checkpoint**: All URL names unique. No dead code. Frontend has no hardcoded fake data, no console.log, proper types. Error formats consistent.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates and final validation

- [x] T072 Update `specs/_overview.md` to reflect: reviews system is fully complete (not placeholder), student dashboard complete (frontend + backend), video streaming (Cloudinary + Vidstack), enrollment has refund/free enrollment/payment retry features and a swappable payment-gateway layer (`apps/enrollment/payments/`), security hardening (rate limiting, logging, password validation), all error formats standardized
- [x] T073 [P] Spec sync: updated spec.md status to Complete, synced data-model.md (Lecture fields reflect video_public_id/video_status pipeline), synced api-changes.md (get-order-details already_paid response, payment retry PI status branching), synced _overview.md (all features current). Runtime verification (email delivery, video playback, rate limiting, refund, payment retry) requires live services and is deferred to deployment testing.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 Email (Phase 3)**: Depends on Foundational — BLOCKS US3 (payment confirmation) and US5 (refund emails)
- **US2 Video (Phase 4)**: Depends on Foundational — independent of other stories
- **US3 Payment Confirmation (Phase 5)**: Depends on US1 (EmailService)
- **US4 Security (Phase 6)**: Depends on Foundational — independent of other stories
- **US5 Refunds (Phase 7)**: Depends on US1 (EmailService) and US3 (webhook fixes). Within the phase, the gateway abstraction (T050a–T050n) depends on T045–T050 being complete — it relocates that code rather than writing it fresh
- **US6 Data Integrity (Phase 8)**: Depends on Foundational — independent of other stories
- **US7 Code Quality (Phase 9)**: Depends on Foundational — mostly independent, some tasks reference US5/US6 endpoints
- **Polish (Phase 10)**: Depends on all user stories complete

### User Story Dependencies

```
Foundational (Phase 2)
├── US1 Email (Phase 3)          ← MVP: start here
│   ├── US3 Payment Confirm (Phase 5)
│   │   └── US5 Refunds (Phase 7)
│   └── US5 Refunds (Phase 7)
├── US2 Video (Phase 4)          ← independent
├── US4 Security (Phase 6)       ← independent
├── US6 Data Integrity (Phase 8) ← independent
└── US7 Code Quality (Phase 9)   ← mostly independent
```

### Within Each User Story

- Models/migrations before services
- Services before views/endpoints
- Backend before frontend
- Core implementation before integration

### Parallel Opportunities

- **Phase 2**: T005, T006, T007, T008, T009, T010, T011 all modify different settings sections or files — can run in parallel after T004
- **Phase 2**: T013, T014 modify different app models — can run in parallel with T012
- **Phase 4 (US2)**: Can run entirely in parallel with Phase 3 (US1)
- **Phase 6 (US4)**: Can run entirely in parallel with Phase 3-5 (US1-US3)
- **Phase 8 (US6)**: T052, T053, T054 modify different files — can run in parallel
- **Phase 9 (US7)**: T060-T063, T065-T068 all modify different files — heavy parallelism

---

## Parallel Example: Foundational Phase

```
# These can all run in parallel (different sections of settings.py or different files):
Task T005: Fix ALLOWED_HOSTS in backend/config/settings.py
Task T006: Fix CORS in backend/config/settings.py
Task T007: Configure email backend in backend/config/settings.py
Task T008: Set JWT rotation in backend/config/settings.py
Task T009: Add throttle config in backend/config/settings.py
Task T010: Fix Order/Transaction choices in backend/apps/enrollment/models.py
Task T011: Fix Transaction currency choices in backend/apps/enrollment/models.py

# These can run in parallel (different model files):
Task T012: Transaction nullable fields in backend/apps/enrollment/models.py
Task T013: Enrollment unique constraint in backend/apps/enrollment/models.py
Task T014: Lecture video_url field in backend/apps/course/models.py

# Then run migrations after all model changes:
Task T015: makemigrations + migrate
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T015) — CRITICAL, blocks everything
3. Complete Phase 3: US1 Email (T016-T019)
4. **STOP and VALIDATE**: Register a real user → OTP arrives in inbox
5. This is the minimum viable improvement — real emails work

### Incremental Delivery

1. Setup + Foundational → Database and config are production-ready
2. Add US1 (Email) → Real emails work → **MVP!**
3. Add US2 (Video) → Video validation works
4. Add US3 (Payment Confirmation) → Payment emails + receipts work
5. Add US4 (Security) → Rate limiting + logging active
6. Add US5 (Refunds) → Admins can process refunds, then payment provider becomes swappable
7. Add US6 (Data Integrity) → Backend validation solid
8. Add US7 (Code Quality) → Codebase clean and consistent
9. Polish → Documentation current

### Single Developer Strategy (Recommended)

Follow phases sequentially in order (1 → 2 → 3 → ... → 10). Each phase builds on the previous. Commit after each phase checkpoint.

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its checkpoint
- Commit after each phase or logical group
- The `featuers/` directory typo is intentionally preserved — renaming is a separate task
- Stripe remains in test mode throughout — all fixes prepare for live key swap
