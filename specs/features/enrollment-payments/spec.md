# Feature: Enrollment & Payments

## Overview

The Enrollment & Payments system handles the complete e-commerce flow for course purchases, integrating with Stripe for payment processing and managing course access through enrollments.

---

## What This Feature Does

1. **Payment Processing**: Create Stripe PaymentIntents for course purchases
2. **Webhook Handling**: Process Stripe webhooks for payment confirmation/failure
3. **Order Management**: Track payment attempts with order records
4. **Transaction Logging**: Store detailed transaction records for auditing
5. **Automatic Enrollment**: Grant course access upon successful payment
6. **Status Tracking**: Monitor payment status (pending, paid, failed, refunded)

---

## Status: BACKEND COMPLETE / FRONTEND COMPLETE

This feature has a fully functional backend. Frontend uses **TanStack Query** for state management (no Zustand).

---

## Backend Endpoints

### Payment Endpoints

| Endpoint                             | Method | Auth | Description                          |
| ------------------------------------ | ------ | ---- | ------------------------------------ |
| `/enrollment/create-payment-intent/` | POST   | Yes  | Create Stripe PaymentIntent          |
| `/enrollment/get-order-details/`     | POST   | Yes  | Get order details for state recovery |
| `/enrollment/payment-webhook/`       | POST   | No   | Stripe webhook handler               |

### Create Payment Intent

**Request:**

```bash
POST /enrollment/create-payment-intent/
Authorization: Cookie with JWT
Content-Type: application/json

{
    "course": 123
}
```

**Process:**

1. Validate user authentication
2. Check course exists and is published
3. Create Order record with "pending" status
4. Create Stripe PaymentIntent with metadata
5. Update Order with PaymentIntent ID
6. Return client_secret and order summary

**Response (200):**

```json
{
  "client_secret": "pi_3TDL3cEzoqWKETIS0_secret_abc123",
  "order": {
    "id": 456,
    "currency": "USD",
    "amount": "29.99",
    "status": "pending"
  }
}
```

**Error Responses:**

- 400: Invalid course ID
- 401: Not authenticated
- 404: Course not found
- 502: Stripe error
- 500: Internal error

### Get Order Details

**Request:**

```bash
POST /enrollment/get-order-details/
Authorization: Cookie with JWT
Content-Type: application/json

{
    "order_id": 456
}
```

**Response (200):**

```json
{
  "order_id": 456,
  "client_secret": "pi_3TDL3cEzoqWKETIS0_secret_abc123",
  "status": "pending",
  "amount": "29.99",
  "currency": "USD",
  "course": {
    "id": 123,
    "title": "Course Title",
    "thumbnail": "/media/courses/thumb.jpg",
    "instructor_name": "John Doe",
    "price": "29.99"
  }
}
```

### Stripe Webhook

**Request:**

```bash
POST /enrollment/payment-webhook/
Stripe-Signature: t=1234567890,v1=signature

{
    "type": "payment_intent.succeeded",
    "data": {
        "object": {
            "id": "pi_3TDL3cEzoqWKETIS0",
            "metadata": {
                "order_id": "456",
                "course_id": "123",
                "user_id": "789"
            }
        }
    }
}
```

**Process:**

1. Verify webhook signature
2. Parse event type
3. Extract metadata (order_id, course_id, user_id)
4. Handle event:
   - `payment_intent.succeeded`: Complete order, create enrollment
   - `payment_intent.payment_failed`: Mark order failed
5. Return 200 (always, even on error)

**Response:**

```json
{
  "status": "received"
}
```

---

## Data Models

### Order

| Field                    | Type                    | Description                  |
| ------------------------ | ----------------------- | ---------------------------- |
| id                       | AutoField               | Primary key                  |
| course                   | ForeignKey → Course     | Course being purchased       |
| user                     | ForeignKey → CustomUser | Purchasing user              |
| status                   | CharField               | pending/paid/failed/refunded |
| amount                   | Decimal(6,2)            | Purchase amount              |
| currency                 | CharField               | USD                          |
| stripe_payment_intent_id | TextField               | Stripe PaymentIntent ID      |

**Status Flow:**

```
pending → paid (on webhook success)
pending → failed (on webhook failure or error)
paid → refunded (manual refund)
```

### Transaction

| Field                    | Type               | Description                  |
| ------------------------ | ------------------ | ---------------------------- |
| id                       | AutoField          | Primary key                  |
| order                    | ForeignKey → Order | Related order                |
| status                   | CharField          | pending/paid/failed/refunded |
| amount                   | Decimal(6,2)       | Transaction amount           |
| currency                 | CharField          | usd/USD                      |
| stripe_payment_intent_id | TextField          | Stripe PI ID                 |
| stripe_charge_id         | TextField          | Stripe Charge ID             |
| stripe_receipt_id        | TextField          | Stripe Receipt ID            |

**Note:** Transaction duplicates some Order data for audit trail integrity.

### Enrollment

| Field       | Type                    | Description          |
| ----------- | ----------------------- | -------------------- |
| id          | AutoField               | Primary key          |
| course      | ForeignKey → Course     | Enrolled course      |
| user        | ForeignKey → CustomUser | Student              |
| order       | ForeignKey → Order      | Purchase record      |
| is_active   | BooleanField            | Access status        |
| enrolled_at | DateTimeField           | Enrollment timestamp |

**Constraints:**

- Unique together: (user, course) - prevents duplicate enrollments

---

## Payment Flow

### Complete Flow Diagram

```
Student                               Frontend                              Backend                           Stripe
  │                                      │                                     │                                  │
  │-- Click "Enroll Now" -------------->│                                     │                                  │
  │                                      │-- POST /create-payment-intent/ --->│                                  │
  │                                      │   {course_id}                       │                                  │
  │                                      │                                     │-- Create Order (pending)         │
  │                                      │                                     │-- Create PaymentIntent ---------->│
  │                                      │                                     │                                  │
  │                                      │<-- Return: client_secret, order ---│                                  │
  │                                      │                                     │<-- Return: PI details -----------│
  │                                      │                                     │                                  │
  │                                      │-- TanStack Query caches the data    │                                  │
  │                                      │                                     │                                  │
  │<-- Redirect to checkout -----------│-- /courses/checkout/{order.id}/     │                                  │
  │                                      │                                     │                                  │
  │                                      │                                     │                                  │
  │◄── CHECKOUT PAGE LOAD ──────────────│                                     │                                  │
  │                                      │                                     │                                  │
  │                                      │-- useGetOrderDetail() hook          │                                  │
  │                                      │-- Uses TanStack Query cache         │                                  │
  │                                      │   (populated by createPaymentIntent)│                                  │
  │                                      │                                     │                                  │
  │                                      │   [On refresh/stale]                │                                  │
  │                                      │-- POST /get-order-details/ -------->│                                  │
  │                                      │   {order_id}                        │                                  │
  │                                      │                                     │-- Validate ownership             │
  │                                      │                                     │-- Return fresh data              │
  │                                      │<-- {client_secret, course, ...} ----│                                  │
  │                                      │                                     │                                  │
  │<-- Show Stripe payment form --------│                                     │                                  │
  │                                      │                                     │                                  │
  │-- Enter card details --------------->│                                     │                                  │
  │                                      │-- Stripe.js confirmCardPayment() --->│                                  │
  │                                      │   {client_secret, card}             │                                  │
  │                                      │                                     │-- Process payment --------------->│
  │                                      │                                     │                                  │
  │                                      │                                     │<-- Payment result ---------------│
  │                                      │                                     │                                  │
  │                                      │<-- Return: paymentResult -----------│                                  │
  │                                      │                                     │                                  │
  │<-- Show processing -----------------│                                     │                                  │
  │                                      │                                     │                                  │
  │                                      │                                     │-- Webhook: payment_intent.     │
  │                                      │                                     │   succeeded --------------------->│
  │                                      │                                     │                                  │
  │                                      │-- POST /payment-webhook/ ----------->│                                  │
  │                                      │                                     │-- Verify signature               │
  │                                      │                                     │-- Update Order → paid             │
  │                                      │                                     │-- Create Transaction              │
  │                                      │                                     │-- Create Enrollment (active)     │
  │                                      │                                     │                                  │
  │                                      │<-- Return: 200 OK ----------------│                                  │
  │                                      │                                     │                                  │
  │<-- Redirect to dashboard -----------│                                     │                                  │
```

### Webhook Handling Detail

```python
class StripeWebhookView(APIView):
    def post(self, request):
        # 1. Verify signature
        event = stripe.Webhook.construct_event(
            payload=request.body,
            sig_header=request.META['HTTP_STRIPE_SIGNATURE'],
            secret=settings.STRIPE_WEBHOOK_SECRET
        )

        # 2. Extract payment intent
        payment_intent = event['data']['object']
        order_id = payment_intent['metadata']['order_id']

        # 3. Handle event
        if event['type'] == 'payment_intent.succeeded':
            self.handle_payment_succeeded(payment_intent)
        elif event['type'] == 'payment_intent.payment_failed':
            self.handle_payment_failed(payment_intent)

        # 4. Always return 200
        return Response({'status': 'received'})

    def handle_payment_succeeded(self, payment_intent):
        with transaction.atomic():
            order = Order.objects.select_for_update().get(
                id=payment_intent['metadata']['order_id']
            )

            if order.status == 'paid':
                return  # Already processed

            # Update order
            order.status = 'paid'
            order.save()

            # Create transaction record
            Transaction.objects.create(
                order=order,
                status='paid',
                amount=payment_intent['amount'] / 100,
                currency=payment_intent['currency'],
                stripe_payment_intent_id=payment_intent['id'],
                # ... other fields
            )

            # Create enrollment
            Enrollment.objects.get_or_create(
                user_id=payment_intent['metadata']['user_id'],
                course_id=payment_intent['metadata']['course_id'],
                order=order,
                is_active=True
            )
```

---

## Frontend Payment Flow

### Overview

The checkout flow uses **TanStack Query** for state management with a **cache-first strategy**:

- `createPaymentIntent` mutation populates the query cache for `['order', order_id]`
- Checkout page reads from cache on first load (no network request)
- On refresh or cache stale (5 min), refetches from `/get-order-details/`

### Flow Diagram

```
Student                               Frontend                              Backend
  │                                      │                                     │
  │-- Click "Enroll Now" -------------->│                                     │
  │                                      │-- POST /create-payment-intent/ --->│
  │                                      │                                     │
  │                                      │<-- {client_secret, order} ---------│
  │                                      │                                     │
  │                                      │-- TanStack Query caches order data  │
  │                                      │   Key: ['order', order.id]          │
  │                                      │                                     │
  │<-- Redirect to checkout -----------│-- /courses/checkout/{order.id}/     │
  │   (with order_id in route)           │                                     │

  │                                      │                                     │
  │◄── CHECKOUT PAGE LOAD ──────────────│                                     │
  │                                      │                                     │
  │                                      │-- useGetOrderDetail(orderId)        │
  │                                      │                                     │
  │   ┌──────────────────────────────────┤                                     │
  │   │ CACHE EXISTS (first load)        │                                     │
  │   └──────────────────────────────────┤                                     │
  │                                      │-- Returns cached data immediately   │
  │                                      │-- No network request                │
  │                                      │                                     │
  │   ┌──────────────────────────────────┤                                     │
  │   │ CACHE STALE/MISSING (refresh)    │                                     │
  │   └──────────────────────────────────┤                                     │
  │                                      │-- POST /get-order-details/ -------->│
  │                                      │   {order_id}                        │
  │                                      │                                     │
  │                                      │<-- {client_secret, course, status} -│
  │                                      │                                     │
  │                                      │-- Updates TanStack Query cache       │
  │                                      │                                     │

  │                                      │                                     │
  │-- Enter card details --------------->│                                     │
  │                                      │-- confirmCardPayment() ------------>│
  │                                      │                                     │
  │                                      │                                     │-- Webhook
  │                                      │                                     │
  │<-- Redirect to dashboard -----------│                                     │
```

### State Management

**TanStack Query Cache Structure:**

```typescript
// Query key: ['order', orderId]
interface OrderDetails {
  order_id: number;
  client_secret: string;
  status: "pending" | "paid" | "failed" | "refunded";
  amount: string;
  currency: string;
  course: Course;
}
```

**Cache Strategy:**
| Data | Location | Reason |
|------|----------|--------|
| client_secret | TanStack Query cache | Sensitive, refetched on stale |
| order_id | URL route | User can refresh, share URL |
| course data | TanStack Query cache | Refetched when cache stale |

**No localStorage/sessionStorage used** - all state in memory (XSS safe for sensitive data).

### Checkout Page Security

**1. Initial Load (Cache Hit):**

```typescript
// On checkout page mount
const { data: orderData } = useGetOrderDetail(orderId);
// Returns cached data from createPaymentIntent's onSuccess
```

**2. Recovery Function (Cache Miss/Stale):**

```typescript
// useGetOrderDetail hook automatically refetches when:
// - Cache is stale (staleTime: 5 minutes)
// - Page is refreshed
// - Component remounts after navigation

async function getOrderDetails(orderId: string) {
  const response = await enrollmentAPI.getOrderDetail(orderId);

  // Security: verify order belongs to current user
  if (response.data.user_id !== currentUser.id) {
    redirect("/"); // Not your order
    return;
  }

  // Security: verify order is still pending
  if (response.data.status !== "pending") {
    redirect("/"); // Already paid/failed
    return;
  }

  return response.data;
}
```

**3. Tampering Protection:**

- Changing URL `orderID` parameter → triggers fetch → validation fails → redirect
- Accessing another user's order → `user_id` mismatch → redirect (403)
- Accessing paid order → `status !== 'pending'` → redirect (404)
- No localStorage/sessionStorage used (XSS safe)

### Required Stripe Integration

```typescript
// Required npm packages:
// @stripe/stripe-js
// @stripe/react-stripe-js

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Checkout page uses Stripe Elements with client_secret
export function CheckoutForm({ clientSecret }: { clientSecret: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm />
    </Elements>
  );
}
```

---

## Edge Cases Handled

### Backend

1. **Duplicate Webhook Calls:**
   - Check if order already paid before processing
   - Idempotent processing

2. **Order Not Found:**
   - Log error
   - Return 404

3. **Already Enrolled:**
   - `get_or_create` prevents duplicates
   - Returns existing enrollment

4. **Payment Amount Mismatch:**
   - Not currently validated (recommend adding)

5. **Webhook Secret Invalid:**
   - Return 400 (Stripe will retry)

6. **Database Transaction Failure:**
   - Atomic block rolls back on error
   - Stripe payment succeeds, order stays pending
   - Manual reconciliation required

### Security

1. **Webhook Signature Verification:**
   - Prevents spoofed webhooks
   - Required for all webhook endpoints

2. **CSRF Exemption:**
   - Webhook endpoint exempt from CSRF
   - Signature verification provides security

3. **Metadata Validation:**
   - Metadata from Stripe used to identify order
   - Prevents tampering with order_id

4. **Order Ownership Validation:**
   - `/get-order-details/` validates order belongs to current user
   - Returns 403 if user mismatch

---

## Known Limitations / TODOs

### Backend

1. **No Refund API:** Manual refund only through Stripe dashboard
2. **No Payment Method Storage:** One-time payments only, no saved cards
3. **No Invoice Generation:** No PDF receipt generation
4. **No Email Receipts:** No automatic email on successful payment
5. **No Retry Logic:** Failed payments not retried automatically
6. **No Payment Analytics:** No metrics on conversion rates

### Frontend

1. **No Stripe Integration:** "Enroll Now" button is non-functional
2. **No Payment Form:** No card input UI
3. **No Loading States:** No payment processing feedback
4. **No Error Handling:** No payment failure UI
5. **No Receipt Page:** No post-purchase confirmation

### Missing Features

1. **Cart System:** Can only buy one course at a time
2. **Discount Codes:** No coupon/promo code support
3. **Subscriptions:** No recurring payments
4. **Payment Plans:** No installment options
5. **Multiple Payment Methods:** Cards only, no PayPal, Apple Pay
6. **Tax Calculation:** No sales tax computation

---

## Configuration

### Environment Variables

```bash
# Stripe Keys
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (public)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Stripe Setup

1. Create Stripe account
2. Get API keys from Dashboard
3. Configure webhook endpoint: `https://api.example.com/enrollment/payment-webhook/`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### Testing

```bash
# Test card numbers
4242 4242 4242 4242  # Success
4000 0000 0000 0002  # Declined
4000 0000 0000 9995  # Insufficient funds
```

---

## Dependencies

### Backend

- `stripe` - Stripe Python SDK
- `django` - Transaction management

### Frontend

- `@tanstack/react-query` - Server state management
- `@stripe/stripe-js` - Stripe.js loader
- `@stripe/react-stripe-js` - React components
