# Research: Production Readiness Audit

**Date**: 2026-07-15 | **Branch**: `002-production-readiness-audit`

## 1. Email Delivery — SendGrid via django-anymail

**Decision**: Use `django-anymail[sendgrid]` to replace the console email backend.

**Rationale**: django-anymail provides a provider-agnostic abstraction over Django's `send_mail()` — existing code works without modification. SendGrid offers a free tier (100 emails/day), simple API key auth, and high deliverability.

**Current state**:
- `EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'` (settings.py:182)
- Single email sender: `send_otp_email()` in `authentication/utils.py:218-250` using `django.core.mail.send_mail()`
- No `DEFAULT_FROM_EMAIL` configured (defaults to `webmaster@localhost`)
- No anymail package in `requirements.txt`

**Changes needed**:
- Install `django-anymail[sendgrid]`, add `'anymail'` to `INSTALLED_APPS`
- Replace `EMAIL_BACKEND` with `'anymail.backends.sendgrid.EmailBackend'`
- Add `ANYMAIL = {'SENDGRID_API_KEY': env('SENDGRID_API_KEY')}` to settings
- Add `DEFAULT_FROM_EMAIL` and `SERVER_EMAIL` from env vars
- Add anymail-specific exception handling (`AnymailRequestsAPIError`, `AnymailRecipientsRefused`) to `send_otp_email()`
- Create a reusable email service for payment confirmation emails (SOLID: Single Responsibility)

**Alternatives considered**:
- AWS SES: Cheaper at scale but more complex setup (AWS account, domain verification, sandbox exit). Overkill for current scale.
- Direct SMTP: No delivery tracking, no bounce handling, less reliable.

---

## 2. Stripe Refunds, Receipts, Payment Methods, Free Enrollment, Payment Retry

### 2a. Refund Endpoint

**Decision**: Admin-only refund endpoint with 14-day window, using `stripe.Refund.create()`.

**Current state**:
- Order model already has `"refunded"` status choice but no code path sets it
- No refund endpoint or webhook handler exists

**Changes needed**:
- New `AdminRefundOrderView` (POST) — admin-only permission
- Validate: order is `paid`, within 14 days of `created_at`
- Call `stripe.Refund.create(payment_intent=order.stripe_payment_intent_id)`
- Update order status to `refunded`, set `enrollment.is_active = False`
- Manually decrement `subscribers_count` / `students_count` (deactivating doesn't trigger `post_delete` signal)
- Send refund confirmation email via email service
- Add `charge.refunded` webhook handler for Stripe Dashboard-initiated refunds

### 2b. Receipt URLs

**Decision**: Use Stripe-hosted receipt URLs from Charge objects.

**Current state**:
- `Transaction.stripe_receipt_id` exists but is never populated and is NOT NULL
- `Transaction.stripe_charge_id` also never populated and NOT NULL
- This means Transaction creation is currently **broken** for both success and failure webhooks

**Changes needed**:
- Make `stripe_charge_id` and `stripe_receipt_id` nullable (`null=True, blank=True`)
- Rename `stripe_receipt_id` to `stripe_receipt_url` (it stores a URL, not an ID)
- In `payment_intent.succeeded` webhook: retrieve `latest_charge`, get `charge.receipt_url`
- Expose `stripe_receipt_url` in `StudentOrderHistorySerializer`

### 2c. Multiple Payment Methods

**Decision**: Enable via Stripe's `automatic_payment_methods` (already configured).

**Current state**:
- Backend already sets `automatic_payment_methods={'enabled': True}` on PaymentIntent creation
- Frontend already uses `PaymentElement` (not `CardElement`) — this supports Apple Pay, Google Pay, etc.
- `allow_redirects: 'never'` blocks redirect-based methods but NOT Apple Pay/Google Pay
- Apple Pay requires domain verification in Stripe Dashboard
- `StudentOrderHistorySerializer.get_method()` hardcodes `"card"`

**Changes needed**:
- Add `payment_method_type` field to Transaction model
- Populate it from the Charge object in webhook handler
- Update `StudentOrderHistorySerializer` to return actual payment method type
- Remove hardcoded `"card"` return

### 2d. Free Course Enrollment

**Decision**: Bypass Stripe entirely for price=0 courses, create Order with sentinel value.

**Current state**:
- No handling for free courses — Stripe rejects amount=0
- `Order.stripe_payment_intent_id` is NOT NULL
- `Enrollment.order` FK is NOT NULL

**Changes needed**:
- Branch in `CreatePaymentIntentView`: if `course.price == 0`, create Order with `status='paid'`, `stripe_payment_intent_id='free'`, create Enrollment directly
- OR make `stripe_payment_intent_id` nullable and create a separate `FreeEnrollmentView`
- Recommended: keep `stripe_payment_intent_id` NOT NULL with placeholder `'free_enrollment'` to avoid nullable FK complexity

### 2e. Payment Retry

**Decision**: Reuse existing PaymentIntent — allow failed orders to be retried.

**Current state**:
- `GetOrderDetailsView` only returns orders with `status == 'pending'`, rejecting failed orders
- Stripe PaymentIntents with `requires_payment_method` status can be confirmed again

**Changes needed**:
- Modify `GetOrderDetailsView` to accept `status in ('pending', 'failed')`
- Reset order status to `pending` on retry
- Check PaymentIntent status via Stripe API — if terminal (`canceled`), create a new PaymentIntent and update the order
- Frontend: allow navigation to checkout with a failed order ID

---

## 3. Security Hardening

### 3a. Rate Limiting

**Decision**: Use DRF's built-in throttling with ScopedRateThrottle.

**Current state**: No throttle configuration exists in `REST_FRAMEWORK` settings.

**Changes needed**:
- Add `DEFAULT_THROTTLE_CLASSES` and `DEFAULT_THROTTLE_RATES` to settings
- Apply `ScopedRateThrottle` scopes: `login` (5/min), `otp` (3/5min), `register` (3/5min)
- Add `throttle_scope` to relevant views

### 3b. Print Statements — 10 Found

| File | Lines | Content |
|------|-------|---------|
| `authentication/views.py` | 50, 54, 80, 482 | request.data, serializer.data, JWT cookies, token errors |
| `authentication/serializers.py` | 84, 110, 111 | validated_data (includes passwords), serialized data |
| `authentication/utils.py` | 250 | email error details |
| `progress/views.py` | 43, 103 | enrollment queryset, sorted courses |

**Lines 50 and 84 are critical** — they print passwords in plaintext. All must be replaced with `logging` at appropriate levels, with sensitive data redacted.

### 3c. CORS

**Current**: `CORS_ALLOW_ALL_ORIGINS = True` (settings.py:114) overrides `CORS_ALLOWED_ORIGINS`.

**Fix**: Delete `CORS_ALLOW_ALL_ORIGINS = True`. Read allowed origins from env var for production flexibility.

### 3d. DEBUG Parsing

**Current**: `DEBUG = env('DEBUG')` reads as string — `'False'` is truthy.

**Fix**: `DEBUG = env.bool('DEBUG', default=False)`

### 3e. JWT Token Rotation

**Current**: `ROTATE_REFRESH_TOKENS: False` — stolen tokens valid for 7 days.

**Fix**: Set `ROTATE_REFRESH_TOKENS: True` (already has `BLACKLIST_AFTER_ROTATION: True`).

### 3f. Auth Class Inconsistency

**Found**: `UserSetPasswordView` (views.py:258) uses `JWTAuthentication` instead of `CookieJWTAuthentication`. `CloudinarySignatureView` correctly falls back to DRF default. Dead import of `JWTAuthentication` in `course/views.py:12`.

### 3g. ALLOWED_HOSTS

**Current**: `ALLOWED_HOSTS = []` — rejects all requests when DEBUG=False.

**Fix**: `ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])`

### 3h. Password Validation

**Current**: Django's 4 default validators configured (settings.py:259-272). Adequate but uses default minimum length of 8.

### 3i. datetime.utcnow() — 3 Occurrences

| File | Line |
|------|------|
| `authentication/views.py` | 475 |
| `authentication/utils.py` | 135, 143 |

**Fix**: Replace with `datetime.now(timezone.utc)`.

### 3j. Duplicate URL Names — 6 Conflicts

**authentication/urls.py**:
- Line 21: `name="user_verifyOTP"` → should be `"user_resendOTP"`
- Line 23: `name="user_login"` → should be `"user_logout"`

**progress/urls.py**:
- Lines 4-7: Four views all named `"homepage"` → unique names needed
- Line 10: `SubmitQuizView` named `"mark_lecture_complete"` → should be `"submit_quiz"`

---

## 4. Cloudinary Video Validation

**Decision**: Validate that `video_url` matches Cloudinary URL pattern.

**Current state**: `Lecture.video_url` is `CharField(max_length=255555)` — accepts any string with no validation.

**Changes needed**:
- Add URL validation to `LectureSerializer` — check URL matches Cloudinary domain pattern (`res.cloudinary.com`)
- Existing Cloudinary integration already handles uploads for images (course thumbnails, profile pictures)
- Frontend video upload will use the same Cloudinary signature endpoint (`CloudinarySignatureView`) already in authentication app
- The existing HTML `<video>` player in the frontend works with Cloudinary-hosted MP4 URLs
