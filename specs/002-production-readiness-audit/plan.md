# Implementation Plan: Production Readiness Audit

**Branch**: `002-production-readiness-audit` | **Date**: 2026-07-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/002-production-readiness-audit/spec.md`

## Summary

Harden and fix 6 existing LMS features for production readiness: replace console email backend with SendGrid via django-anymail, fix broken Stripe webhook handler, add refund/free enrollment/payment retry endpoints, enable multiple Stripe payment methods, add rate limiting and security hardening, and clean up code quality issues (print statements, stale types, hardcoded UI, duplicate URLs). Follows SOLID principles with service abstractions throughout.

## Technical Context

**Language/Version**: Python 3.11+ (Django 6.0), TypeScript (strict mode, Next.js 16 + React 19)
**Primary Dependencies**: Django REST Framework, django-anymail[sendgrid], stripe, djangorestframework-simplejwt, Cloudinary, TanStack Query, Zustand, shadcn/ui
**Storage**: PostgreSQL
**Testing**: Manual verification (no test framework configured yet)
**Target Platform**: Web application (Django API server + Next.js frontend)
**Project Type**: Web service (REST API backend + SPA frontend)
**Performance Goals**: Email delivery <30s, API responses <500ms, rate limiting active
**Constraints**: Stripe test mode, SendGrid free tier (100/day), existing `featuers/` typo preserved
**Scale/Scope**: Single-server deployment, <1000 users initially

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type Safety First | **PASS** | FR-042 fixes `any` types, FR-034 fixes stale types |
| II. Component-First Architecture | **PASS** | No new components; existing atomic design preserved |
| III. Security-First Development | **PASS** | FR-008–015 directly address security. CORS, cookies, rate limiting, auth consistency all fixed |
| IV. Testing Discipline | **DEFERRED** | No automated tests exist in the project. Manual verification defined in quickstart.md. Testing infrastructure is a separate future feature. |
| V. Documentation as Code | **PASS** | FR-038 updates docs. research.md, data-model.md, contracts/ all created |

**Post-Phase 1 Re-check**: All gates still pass. No new complexity violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/002-production-readiness-audit/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research findings
├── data-model.md        # Phase 1: model changes
├── quickstart.md        # Phase 1: setup & verification guide
├── contracts/
│   └── api-changes.md   # Phase 1: API contract changes
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2: task breakdown (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── config/
│   └── settings.py              # Email, CORS, DEBUG, throttling, JWT, ALLOWED_HOSTS
├── apps/
│   ├── authentication/
│   │   ├── views.py             # print→logging, auth class fix, datetime fix
│   │   ├── serializers.py       # print→logging, password validation
│   │   ├── utils.py             # Email error handling, datetime fix
│   │   ├── urls.py              # Fix duplicate URL names
│   │   └── signals.py           # Remove no-op signal
│   ├── course/
│   │   ├── models.py            # Lecture.video_url → URLField
│   │   ├── serializers.py       # Cloudinary URL validation
│   │   └── views.py             # Remove dead import
│   ├── enrollment/
│   │   ├── models.py            # Transaction nullable fields, Enrollment unique_together,
│   │   │                        #   Order.payment_gateway/idempotency_key, ProcessedWebhookEvent
│   │   ├── views.py             # Refund, free enrollment, webhook fixes, payment retry
│   │   ├── serializers.py       # Receipt URL, payment method type
│   │   ├── urls.py              # New endpoints
│   │   ├── service.py           # EmailService + sender strategies
│   │   └── payments/            # NEW package: provider abstraction (mirrors course/video/)
│   │       ├── exceptions.py    #   domain errors — SDK exceptions translated here
│   │       ├── dto.py           #   frozen dataclasses; no ORM object crosses this line
│   │       ├── base.py          #   PaymentGateway ABC
│   │       ├── stripe_gateway.py#   Adapter — the ONLY module importing `stripe`
│   │       ├── factory.py       #   get_payment_gateway() reading settings.PAYMENT_GATEWAY
│   │       ├── service.py       #   CheckoutService / RefundService (Facades)
│   │       ├── fulfillment.py   #   enrollment activation, counters, emails
│   │       └── webhooks.py      #   event_type -> handler dict + dedupe
│   └── progress/
│       ├── views.py             # print→logging, serializer validation
│       └── urls.py              # Fix duplicate URL names
└── requirements.txt             # Add django-anymail[sendgrid]

front-end/src/
├── featuers/
│   ├── courses/
│   │   └── components/
│   │       └── CourseEnrollCard.tsx    # Remove cart button, remove 40% off
│   ├── enrollment/
│   │   ├── components/
│   │   │   ├── CourseCheckout.tsx      # Payment retry, free course handling
│   │   │   └── TransactionHistory.tsx  # Receipt URL, payment method display
│   │   ├── api/enrollment.api.ts      # New endpoints (refund, free enroll)
│   │   ├── hooks/                     # New hooks for free enrollment
│   │   └── types/enrollment.types.ts  # Updated types
│   └── auth/
│       └── types/auth.types.ts        # Fix stale types
└── (various files)                    # Remove console.log, fix any types
```

**Structure Decision**: Existing web application structure (backend/ + front-end/) preserved. New `enrollment/services.py` added for SOLID service layer. No new apps or packages created.

## Implementation Phases

### Phase 1: Database & Configuration Fixes (Foundation)

**Why first**: Fixes crashes (Transaction IntegrityError) and security holes that block all other work.

1. **Settings hardening** (settings.py):
   - `DEBUG = env.bool('DEBUG', default=False)`
   - `ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])`
   - Remove `CORS_ALLOW_ALL_ORIGINS = True`, read origins from env
   - Add `'anymail'` to `INSTALLED_APPS`, configure email backend
   - Add DRF throttle classes and rates
   - Set `ROTATE_REFRESH_TOKENS: True`

2. **Model migrations**:
   - Transaction: nullable stripe fields, add `payment_method_type`, fix choices
   - Order: fix choices format
   - Enrollment: `unique_together = ['user', 'course']`
   - Lecture: `video_url` → `URLField(max_length=500)`

3. **Auth class fix**: `UserSetPasswordView` → `CookieJWTAuthentication`

### Phase 2: Email Service (SendGrid)

**Why second**: Needed by payment confirmation (Phase 3) and refunds (Phase 4).

1. Install `django-anymail[sendgrid]`, update requirements.txt
2. Create `enrollment/services.py` with `EmailService` class (Single Responsibility):
   - `send_otp_email()` — refactored from utils.py with anymail exception handling
   - `send_payment_confirmation()` — new, includes receipt URL
   - `send_refund_confirmation()` — new
3. Update `send_otp_email()` in utils.py to use EmailService
4. Add proper `logging` to replace all 10 print statements

### Phase 3: Payment Enhancements

**Why third**: Builds on working email (Phase 2) and fixed models (Phase 1).

1. **Webhook handler fixes**:
   - Populate `stripe_charge_id`, `stripe_receipt_url`, `payment_method_type` from Charge object
   - Send payment confirmation email on success
   - Add `charge.refunded` event handler

2. **Free enrollment endpoint** (`POST /enrollment/enroll-free/`):
   - Validate course price is 0
   - Create Order with `stripe_payment_intent_id='free_enrollment'`
   - Create Enrollment directly
   - Trigger signals for counter updates

3. **Payment retry**:
   - Modify `GetOrderDetailsView` to accept failed orders
   - Check PaymentIntent status, reuse or create new as needed
   - Reset order to pending

4. **Receipt URLs**:
   - Update `StudentOrderHistorySerializer` with `receipt_url` and `payment_method`
   - Remove hardcoded `"card"` method

### Phase 4: Refund System & Payment Gateway Abstraction

**Why fourth**: Depends on email service (Phase 2) and fixed webhook (Phase 3).

**4a — Refund feature** (delivered directly against the Stripe SDK):

1. Create `RefundService` in `enrollment/service.py`:
   - Validate refund eligibility (paid status, within 14 days)
   - Process via `stripe.Refund.create()`
   - Update order status, deactivate enrollment
   - Decrement subscriber/student counts
   - Send refund confirmation email

2. Create `AdminRefundOrderView` with `isAdmin` permission
3. Add refund endpoint to URLs
4. Add `charge.refunded` webhook handler, idempotent against 1

**4b — Gateway abstraction** (relocates 4a's logic; no user-visible change):

Satisfies FR-020a/b/c. Structured to mirror the already-working
`apps/course/video/` package so the codebase has one provider-abstraction idiom
rather than two competing ones.

5. Models: `Order.payment_gateway`, unique `Order.idempotency_key`,
   `ProcessedWebhookEvent`, and rename Transaction's `stripe_*` fields to
   provider-neutral names
6. `payments/` package: domain exceptions, frozen DTOs, `PaymentGateway` ABC
7. `StripeGateway` adapter — ports the Phase 3/4a logic; becomes the only module
   importing `stripe`. **Stays on the PaymentIntents API**: the abstraction wraps
   the existing `PaymentIntent` + embedded `PaymentElement` flow. Stripe's separate
   hosted-page product (`stripe.checkout.Session`, `checkout.session.completed`) is
   explicitly *not* adopted — that would be a UX change (redirect off-site) and
   would discard the `PaymentElement` integration already working. Hence the ABC
   method is `initiate_payment()` returning a `PaymentAttempt`, deliberately named
   to avoid collision with Stripe's `checkout.Session` object.
8. `get_payment_gateway()` factory reading `settings.PAYMENT_GATEWAY`, taking no
   arguments (each gateway reads its own settings, as `CloudinaryVideoProvider` does)
9. `CheckoutService` / `RefundService` facades + `fulfillment.py` for the
   enrollment/counter/email side effects ("checkout" naming the domain flow, as in
   `CourseCheckout.tsx` — not Stripe's product of that name)
10. Webhook dispatcher: `event_type -> function` dict with event-ID dedupe
11. Views become thin: validate → call service → map domain exception to HTTP

**Deliberately rejected** (recorded in full, with rationale, in the `tasks.md`
Phase 7 design-decision table): repository layer over the ORM, gateway
decorators, a runtime `register()` registry, `Refundable`/`WebhookVerifiable`
interface splitting, partial-refund support, and class-per-event webhook
handlers. Each was evaluated and judged disproportionate to this codebase's
scale — FR-023's proportionality clause.

**Exit criterion**: no `stripe` import anywhere in `apps/enrollment/` outside
`payments/stripe_gateway.py` (SC-013).

### Phase 5: Security & Rate Limiting

**Why fifth**: Non-blocking fixes that layer on top of working features.

1. Apply `throttle_scope` to auth views (login, register, OTP, forget-password)
2. Fix `datetime.utcnow()` → `datetime.now(timezone.utc)` (3 occurrences)
3. Fix duplicate URL names (auth: 2 fixes, progress: 5 fixes)
4. Remove dead import in `course/views.py`
5. Remove no-op `save_user_profile` signal
6. Add backend password validation to serializers
7. Fix `GoogleSetPasswordNewPasswordSerializer` `user.can_change_password` reference
8. Fix `UserProfileUpdateView` 404→400
9. Add serializer validation for `lecture_id`/`quiz_id` in progress views
10. Cloudinary URL validation on `LectureSerializer`

### Phase 6: Frontend Cleanup

**Why last**: Cosmetic and type fixes that don't affect backend functionality.

1. Remove "Add to Cart" button from `CourseEnrollCard.tsx`
2. Remove hardcoded "40% Off" from `CourseEnrollCard.tsx`
3. Update `TransactionHistory.tsx` — receipt URL link, payment method display
4. Update `CourseCheckout.tsx` — payment retry support, free course handling
5. Fix stale TypeScript types (`VerifyOTPResponse`, etc.)
6. Remove all `console.log` statements
7. Replace `any` types with proper types
8. Add free enrollment API + hook
9. Set pagination page sizes to 6+

### Phase 7: Documentation Updates

1. Update `specs/_overview.md`:
   - Reviews system is complete (not placeholder)
   - CourseFeedback component deleted
   - Price range filtering implemented
   - Enrollment has refund, free enrollment, payment retry
2. Standardize error response format documentation

## Complexity Tracking

No constitution violations. All changes use existing patterns:
- DRF throttling (built-in)
- django-anymail (standard Django email abstraction)
- Stripe API (existing integration extended)
- Python logging (stdlib)
- No new architectural patterns beyond service classes (SOLID)
