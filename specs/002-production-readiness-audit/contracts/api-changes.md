# API Contract Changes: Production Readiness Audit

**Branch**: `002-production-readiness-audit` | **Date**: 2026-07-15

---

## New Endpoints

### 1. POST `/enrollment/refund-order/` (Admin only)

**Request**:
```json
{
  "order_id": 42
}
```

**Success Response** (200):
```json
{
  "message": "Refund processed successfully",
  "order_id": 42,
  "refund_amount": "29.99",
  "stripe_refund_id": "re_xxx"
}
```

**Error Responses**:
- 400: `{"error": "Order is not eligible for refund"}` (not paid status)
- 400: `{"error": "Refund window expired. Refunds are only allowed within 14 days of purchase."}` (older than 14 days)
- 404: `{"error": "Order not found"}`
- 502: `{"error": "Payment provider error: <details>"}` (Stripe failure)

**Auth**: `CookieJWTAuthentication` + `isAdmin`

---

### 2. POST `/enrollment/enroll-free/` (Authenticated students)

**Request**:
```json
{
  "course_id": 7
}
```

**Success Response** (201):
```json
{
  "message": "Successfully enrolled",
  "enrollment_id": 15,
  "course_id": 7
}
```

**Error Responses**:
- 400: `{"error": "This course is not free"}`
- 400: `{"error": "Already enrolled in this course"}`
- 404: `{"error": "Course not found"}`

**Auth**: `CookieJWTAuthentication` + `IsAuthenticated`

---

## Modified Endpoints

### 3. POST `/enrollment/get-order-details/` — Now accepts failed orders

**Change**: Previously rejected orders with `status != 'pending'`. Now accepts `status in ('pending', 'failed')`.

When retrying a failed order:
- Checks PaymentIntent status via gateway's `retrieve_attempt()`
- If PI status is `succeeded`: reconciles via `fulfillment.activate_enrollment()`, returns `{"already_paid": true, "message": "..."}`
- If PI status is `canceled`: creates new PaymentIntent, updates order, returns new `client_secret`
- Otherwise (e.g. `requires_payment_method`): returns existing `client_secret`, resets order to `pending`

**Response** (extended shape):
```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "order_id": 42,
  "amount": "29.99",
  "currency": "usd",
  "status": "pending",
  "course": { "id": 7, "title": "..." },
  "already_paid": false
}
```

---

### 4. POST `/enrollment/payment-webhook/` — New event handlers

**New events handled**:
- `charge.refunded`: Updates order to `refunded`, deactivates enrollment, creates refund transaction, sends confirmation email

**Modified handlers**:
- `payment_intent.succeeded`: Now populates `stripe_charge_id`, `stripe_receipt_url`, `payment_method_type` on Transaction. Sends confirmation email with receipt link.
- `payment_intent.payment_failed`: Now handles nullable `stripe_charge_id` and `stripe_receipt_url`.

**Later renamed** (gateway abstraction, FR-020a): `/enrollment/payment-webhook/` →
`/enrollment/webhook/<gateway>/`, so a second provider gets its own endpoint without
a second view class. The old path stays as an alias until the Stripe dashboard
endpoint is updated, then is removed.

**Deduplication** (FR-020c): each delivery's provider event ID is recorded before
its handler runs. Re-delivered events are acknowledged with 200 and skipped, so a
provider retry cannot double-fulfill. Response shape is unchanged.

---

### 6. Provider-agnostic error contract (FR-020a)

Once payment logic sits behind the provider abstraction, SDK exceptions are
translated at the adapter boundary and never reach the client. All payment
endpoints map domain errors through one shared table:

| Domain exception | HTTP | Body |
|---|---|---|
| `PaymentDeclinedError` | 402 | `{"error": "Payment was declined"}` |
| `RefundNotAllowedError` | 400 | `{"error": "<reason>"}` |
| `WebhookVerificationError` | 400 | `{"error": "Invalid signature"}` |
| `GatewayError` | 502 | `{"error": "Payment provider unavailable"}` |
| duplicate `idempotency_key` | 409 | `{"error": "Duplicate payment request"}` |

No vendor error code, SDK exception name, or provider decline reason appears in a
response body. Conforms to the project's `{"error": "message"}` standard.

---

### 7. POST `/enrollment/create-payment-intent/` — Idempotency (FR-020b)

Accepts an optional `Idempotency-Key` request header. Replaying the same key
returns 409 rather than creating a second order and charge. Enforced by a unique
DB constraint, not an application-level existence check, so concurrent duplicates
are also caught.

Response shape is unchanged on the success path — this endpoint continues to
create a Stripe **PaymentIntent** and return its `client_secret` for the embedded
`PaymentElement`. The gateway abstraction wraps that flow; it does not migrate to
Stripe's hosted Checkout Session product, which would redirect the user off-site
and emit different webhook events.

When a second gateway is added the response carries either `client_secret`
(Stripe) or `approval_url` (PayPal) and the frontend branches on which is present.
This is the one place the abstraction cannot fully hide the provider: completing a
payment is a client-side interaction, and providers differ in whether that is
embedded or a redirect/popup. The backend contract stays uniform; the checkout
component needs a branch.

---

### 5. GET `/enrollment/student/orders/` — Receipt URL added

**Change**: Response now includes `receipt_url` and actual `payment_method` instead of hardcoded "card".

**Updated item shape**:
```json
{
  "id": 42,
  "course_title": "Python Basics",
  "amount": "29.99",
  "status": "paid",
  "payment_method": "card",
  "receipt_url": "https://pay.stripe.com/receipts/xxx",
  "created_at": "2026-07-15T10:00:00Z"
}
```

---

## Unchanged Endpoints (Security fixes applied transparently)

All existing endpoints receive:
- Rate limiting via DRF throttling (no response shape changes — returns 429 when throttled)
- Consistent error format (`{"error": "message"}` or `{"field": ["message"]}`)
- Proper logging instead of print statements

**Throttle scopes applied**:

| Endpoint Pattern | Scope | Rate |
|---|---|---|
| `/auth/user/login/` | `login` | 5/min |
| `/auth/user/register/*` | `register` | 3/5min |
| `/auth/user/forgetpassword/*` | `otp` | 3/5min |
| `/auth/google/user/*` | `login` | 5/min |

**429 Response** (standard DRF):
```json
{
  "detail": "Request was throttled. Expected available in 45 seconds."
}
```
