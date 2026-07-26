# Quickstart: Production Readiness Audit

**Branch**: `002-production-readiness-audit`

## Prerequisites

1. SendGrid account with API key (free tier: 100 emails/day)
2. Verified sender identity in SendGrid (must match `DEFAULT_FROM_EMAIL`)
3. Stripe account with Apple Pay domain verification (for Apple Pay support)

## New Environment Variables

Add to `backend/.env`:

```env
# Email (SendGrid via django-anymail)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
DEFAULT_FROM_EMAIL=noreply@yourdomain.com

# Production settings
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com,localhost

# Payment provider selection (gateway abstraction)
PAYMENT_GATEWAY=stripe
```

## New Dependencies

```bash
cd backend
pip install "django-anymail[sendgrid]"
pip freeze > requirements.txt
```

## Database Migrations

After pulling the branch:

```bash
cd backend
python manage.py migrate
```

5 new migrations will run:
1. Transaction: nullable stripe fields, add payment_method_type
2. Order: fix choices format
3. Enrollment: add unique_together constraint
4. Lecture: video_url → URLField
5. Gateway abstraction: Order gets `payment_gateway` + unique `idempotency_key`, new `ProcessedWebhookEvent` table, Transaction `stripe_*` fields renamed to provider-neutral names

## Verification

1. **Email**: Register a new account → OTP should arrive in real inbox
2. **Video**: Upload a video via Cloudinary → should play in lecture page
3. **Rate limiting**: Hit login 6 times rapidly → 6th should return 429
4. **Refund**: As admin, POST to `/enrollment/refund-order/` with a paid order → should refund
5. **Free enrollment**: Create a course with price=0 → POST to `/enrollment/enroll-free/` → should enroll without payment
6. **Payment retry**: Fail a payment → return to checkout → should allow retry
7. **Receipt URL**: Complete a payment → check billing dashboard → receipt link should work

### Gateway abstraction (after T050a–T050n)

8. **Provider isolation** (SC-013): `grep -rn "stripe" backend/apps/enrollment/ --include=*.py`
   → hits only in `payments/stripe_gateway.py`. This is the check that distinguishes
   a real abstraction from a decorative one.
9. **Idempotency** (SC-014): POST `create-payment-intent/` twice with the same
   `Idempotency-Key` header → second returns 409, and only one Order exists
10. **Webhook dedupe** (SC-014): replay a `payment_intent.succeeded` event from the
    Stripe CLI → second delivery returns 200 but creates no second Transaction and
    no duplicate enrollment
11. **Error translation**: force a decline with test card `4000000000000002` →
    response is `{"error": "..."}` with status 402, containing no Stripe error code
12. **Unknown provider**: set `PAYMENT_GATEWAY=paypal` before the PayPal adapter
    exists → app raises `ImproperlyConfigured` at startup, not a runtime 500

## Key Files Changed

### Backend
- `config/settings.py` — email backend, CORS, DEBUG, throttling, JWT rotation, ALLOWED_HOSTS
- `apps/authentication/views.py` — print→logging, auth class fix, datetime fix
- `apps/authentication/serializers.py` — print→logging, password validation
- `apps/authentication/utils.py` — email error handling, datetime fix
- `apps/authentication/urls.py` — fix duplicate URL names
- `apps/enrollment/models.py` — Transaction nullable/renamed fields, Enrollment unique constraint, Order gateway + idempotency key, ProcessedWebhookEvent
- `apps/enrollment/views.py` — refund endpoint, free enrollment, webhook enhancements, payment retry; later thinned to service calls + exception mapping
- `apps/enrollment/serializers.py` — receipt URL, payment method type
- `apps/enrollment/urls.py` — new endpoints; webhook route renamed to `webhook/<gateway>/`
- `apps/enrollment/service.py` — EmailService + sender strategies
- `apps/enrollment/payments/` — **new package**: provider abstraction (exceptions, DTOs, `PaymentGateway` ABC, Stripe adapter, factory, checkout/refund facades, fulfillment, webhook dispatch)
- `apps/enrollment/signals.py` — no changes (existing signals work)
- `apps/course/models.py` — Lecture video_url field type
- `apps/course/serializers.py` — Cloudinary URL validation
- `apps/progress/views.py` — print→logging, serializer validation for lecture_id/quiz_id
- `apps/progress/urls.py` — fix duplicate URL names

### Frontend
- `featuers/courses/components/CourseEnrollCard.tsx` — remove "Add to Cart", remove "40% Off"
- `featuers/enrollment/components/CourseCheckout.tsx` — payment retry support
- `featuers/enrollment/components/TransactionHistory.tsx` — receipt URL link, payment method display
- `featuers/auth/types/auth.types.ts` — fix stale types
- Various files — remove console.log, replace `any` types
