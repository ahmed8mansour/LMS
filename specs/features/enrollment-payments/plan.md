# Enrollment & Payments - Architecture Plan

## Architecture Overview

The Enrollment & Payments system uses a **Stripe PaymentIntent-based architecture** with webhook confirmation for secure, PCI-compliant payment processing. The design separates payment creation (client-initiated) from payment confirmation (webhook-driven) for reliability.

---

## Key Architectural Decisions

### 1. PaymentIntent vs Checkout Session

**Decision:** Use Stripe PaymentIntents directly, not Stripe Checkout Sessions.

**Rationale:**
- **Embedded Experience:** Payment form embedded in LMS UI (not Stripe-hosted page)
- **Control:** Full control over UX and styling
- **Real-time:** Immediate feedback on card validation

**Alternative Considered:**
```
Stripe Checkout Session:
- Redirect to Stripe-hosted checkout
- Simpler implementation
- Less control over UX
```

**Trade-offs:**
- More complex frontend implementation (requires Stripe Elements)
- Must handle PCI compliance (Stripe Elements abstracts this)
- Need webhook infrastructure

### 2. Webhook-Driven Confirmation

**Decision:** Create enrollment via webhook, not immediate API response.

**Flow:**
```
1. Frontend: Create PaymentIntent (Order created, "pending")
2. Frontend: Confirm payment with Stripe.js
3. Stripe: Process payment
4. Stripe: Webhook to backend (Order → "paid", Enrollment created)
5. Frontend: Poll or wait for webhook (not implemented)
```

**Rationale:**
- **Reliability:** Webhooks retry on failure
- **Security:** Payment confirmation from Stripe, not client
- **Consistency:** Database updated after Stripe confirmation

**Alternative Considered:**
```
Immediate confirmation:
- Frontend polls payment intent status
- Simpler but less reliable
- Network issues can cause lost enrollments
```

### 3. Separate Order and Transaction Models

**Decision:** Two separate tables for orders and transactions.

**Structure:**
```
Order (business entity)
  └── Transaction (audit trail)
```

**Rationale:**
- **Audit Trail:** Multiple transactions per order possible (retries, refunds)
- **Data Integrity:** Order data protected from transaction details
- **Reporting:** Easy to query order status vs transaction history

**Trade-off:** Slight redundancy (amount stored in both tables)

### 4. Idempotent Webhook Processing

**Decision:** Webhooks must be idempotent (safe to call multiple times).

**Implementation:**
```python
def handle_payment_succeeded(self, payment_intent):
    order = Order.objects.get(id=order_id)
    
    if order.status == 'paid':
        return  # Already processed, skip
    
    # Process payment...
```

**Rationale:**
- Stripe may send duplicate webhooks
- Network timeouts may cause retries
- Idempotency ensures data consistency

### 5. Atomic Database Transactions

**Decision:** Wrap order completion in `transaction.atomic()`.

**Implementation:**
```python
with transaction.atomic():
    order = Order.objects.select_for_update().get(id=order_id)
    order.status = 'paid'
    order.save()
    
    Transaction.objects.create(...)
    Enrollment.objects.create(...)
```

**Rationale:**
- All-or-nothing operation
- Prevents partial state (order paid but no enrollment)
- `select_for_update()` prevents race conditions

---

## Data Flow Architecture

### Payment Creation Flow

```
User
  │-- Click "Enroll Now"
  │
  ▼
Frontend
  │-- Check authentication
  │-- POST /create-payment-intent/ {course_id}
  │
  ▼
Backend
  │-- Validate course exists
  │-- Create Order (status=pending)
  │-- Create Stripe PaymentIntent
  ││  metadata: {order_id, course_id, user_id}
  │
  ▼
Stripe
  │-- Create PaymentIntent
  │-- Return client_secret
  │
  ▼
Backend
  │-- Save PaymentIntent ID to Order
  │-- Return {client_secret, order_id}
  │
  ▼
Frontend
  │-- Load Stripe Elements with client_secret
  │-- Display card input form
```

### Payment Confirmation Flow

```
User
  │-- Enter card details
  │-- Click "Pay"
  │
  ▼
Frontend (Stripe.js)
  │-- Submit card to Stripe
  │-- Return result (success/fail)
  │
  ▼
Stripe
  │-- Process payment
  │-- Trigger webhook
  │
  ├──────────┬──────────┐
  ▼          ▼          ▼
Success   Failed   Requires Action
  │          │          │
  ▼          ▼          ▼
Webhook   Webhook   Webhook
(succeeded) (failed) (redirect)
```

### Webhook Processing Flow

```
Stripe Webhook
  │
  ▼
Backend
  │-- POST /payment-webhook/
  │-- Verify signature
  │-- Parse event type
  │
  ├── payment_intent.succeeded ─┐
  │                             ▼
  │                    handle_payment_succeeded()
  │                             │
  │                             ├── Update Order → "paid"
  │                             ├── Create Transaction
  │                             └── Create Enrollment
  │
  ├── payment_intent.payment_failed ─┐
  │                                  ▼
  │                         handle_payment_failed()
  │                                  │
  │                                  └── Update Order → "failed"
  │
  ▼
Return 200 OK
```

---

## Security Architecture

### Webhook Security

```python
# Signature verification (required)
event = stripe.Webhook.construct_event(
    payload=request.body,
    sig_header=request.META['HTTP_STRIPE_SIGNATURE'],
    secret=settings.STRIPE_WEBHOOK_SECRET
)
```

**Why:**
- Prevents spoofed webhooks
- Ensures event came from Stripe
- Must use raw request body (not parsed JSON)

### CSRF Exemption

```python
@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    ...
```

**Why:**
- Webhooks can't include CSRF tokens
- Signature verification replaces CSRF protection
- Only applied to webhook endpoint

### Authentication

```python
class CreatePaymentIntentView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
```

**Why:**
- Only authenticated users can purchase
- Prevents anonymous order creation
- User identity from JWT

### Race Condition Prevention

```python
with transaction.atomic():
    # Lock row until transaction commits
    order = Order.objects.select_for_update().get(id=order_id)
    
    if order.status == 'paid':
        return  # Another thread already processed
    
    # Process payment...
```

**Why:**
- Prevents duplicate enrollments
- Handles concurrent webhook deliveries
- Database-level locking

---

## Scalability Considerations

### Current Limitations

1. **Synchronous Webhook Processing:**
   - Webhook blocks until complete
   - Slow for high volume

2. **No Queue:**
   - Webhooks processed immediately
   - No retry queue for failures

3. **Single Payment Method:**
   - Cards only
   - Limits customer options

### Future Improvements

1. **Celery Queue for Webhooks:**
   ```python
   @shared_task
   def process_webhook(event_id):
       event = stripe.Event.retrieve(event_id)
       # Process asynchronously
   ```

2. **Multiple Payment Methods:**
   - Stripe supports 40+ payment methods
   - Popular additions: PayPal, Apple Pay, Google Pay

3. **Subscription Support:**
   - Stripe Billing for recurring payments
   - Course subscriptions/memberships

4. **Webhook Queue Management:**
   - Dead letter queue for failed webhooks
   - Manual retry interface

---

## Error Handling Strategy

### Stripe Errors

```python
try:
    intent = stripe.PaymentIntent.create(...)
except stripe.error.StripeError as e:
    # Return 502 Bad Gateway
    return Response(
        {'error': 'Something went wrong with Stripe'},
        status=status.HTTP_502_BAD_GATEWAY
    )
```

### Webhook Errors

```python
try:
    event = stripe.Webhook.construct_event(...)
except ValueError:
    # Invalid payload
    return Response({'error': 'Invalid payload'}, status=400)
except stripe.error.SignatureVerificationError:
    # Invalid signature
    return Response({'error': 'Invalid signature'}, status=400)
```

**Critical:** Webhook always returns 200 even on processing errors to prevent Stripe retries that could cause issues.

### Database Errors

```python
try:
    with transaction.atomic():
        # Process order
        pass
except Exception as e:
    # Log error but return 200 to Stripe
    logger.error(f"Webhook processing failed: {e}")
    return Response({'status': 'received'}, status=200)
```

---

## Integration Points

### With Course Management
- Order.course references Course
- Enrollment checks Course.is_published
- Webhook uses course_id from metadata

### With Authentication
- Order.user references CustomUser
- Enrollment.user references CustomUser
- JWT authentication on payment creation

### With Progress Tracking
- Enrollment required for progress tracking
- LectureProgress requires active Enrollment
- QuizAttempt requires active Enrollment

---

## Files Organization

### Backend
```
apps/enrollment/
├── models.py
│   ├── Order
│   ├── Transaction
│   └── Enrollment
├── views.py
│   ├── CreatePaymentIntentView
│   └── StripeWebhookView
├── serializers.py
│   └── CreatePaymentSerializer
├── urls.py
│   ├── create-payment-intent/
│   └── payment-webhook/
└── signals.py
    └── update_subscribers_count
```

### Frontend (Not Implemented)
```
featuers/enrollment/
├── api/
│   └── enrollment.api.ts
├── components/
│   ├── PaymentModal.tsx
│   ├── PaymentForm.tsx
│   └── PaymentSuccess.tsx
├── hooks/
│   ├── useCreatePaymentIntent.ts
│   └── usePaymentConfirmation.ts
└── types/
    └── enrollment.types.ts
```

---

## Configuration

### Settings

```python
# config/settings.py

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY = env('STRIPE_PUBLISHABLE_KEY')
STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET')

# Optional: Configure currency
DEFAULT_CURRENCY = 'USD'
```

### Environment Variables

```bash
# Backend
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Frontend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

### Stripe Dashboard Configuration

1. **Webhook Endpoint:**
   ```
   https://api.yourdomain.com/enrollment/payment-webhook/
   ```

2. **Webhook Events:**
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

3. **Test Cards:**
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`

---

## Testing Strategy

### Unit Tests

```python
def test_order_creation():
    order = Order.objects.create(
        course=course,
        user=user,
        status='pending',
        amount=Decimal('49.99')
    )
    assert order.status == 'pending'

def test_enrollment_on_payment():
    # Simulate webhook
    handle_payment_succeeded(payment_intent)
    
    enrollment = Enrollment.objects.get(user=user, course=course)
    assert enrollment.is_active == True
```

### Integration Tests

```python
def test_payment_flow():
    # Create PaymentIntent
    response = client.post('/enrollment/create-payment-intent/', {
        'course': course.id
    })
    assert response.status_code == 200
    
    # Simulate webhook
    webhook_response = client.post(
        '/enrollment/payment-webhook/',
        event_payload,
        HTTP_STRIPE_SIGNATURE='test_sig'
    )
    assert webhook_response.status_code == 200
    
    # Verify enrollment created
    assert Enrollment.objects.filter(user=user, course=course).exists()
```

### Manual Testing

1. **Happy Path:**
   - Create PaymentIntent
   - Use Stripe test card: 4242 4242 4242 4242
   - Verify enrollment created

2. **Declined Card:**
   - Use card: 4000 0000 0000 0002
   - Verify order status = "failed"
   - Verify no enrollment created

3. **Duplicate Webhook:**
   - Send same webhook twice
   - Verify single enrollment (idempotency)

---

## Monitoring & Logging

### Recommended Logging

```python
logger.info(f"PaymentIntent created: {intent.id} for order {order.id}")
logger.info(f"Webhook received: {event.type} for order {order_id}")
logger.info(f"Enrollment created: user={user.id}, course={course.id}")
logger.error(f"Webhook processing failed: {error}")
```

### Metrics to Track

1. **Conversion Rate:** Views → PaymentIntent created → Completed
2. **Payment Success Rate:** Successful / Total attempts
3. **Webhook Latency:** Time from Stripe event to processing
4. **Enrollment Rate:** Orders → Active enrollments

---

## Alternative Approaches Considered

### 1. PayPal Integration
**Rejected:** Stripe chosen for better developer experience and documentation

### 2. Custom Payment Processor
**Rejected:** PCI compliance burden too high

### 3. Payment on Delivery
**Rejected:** Not practical for digital courses

### 4. Cryptocurrency
**Rejected:** Too complex for MVP

---

## Maintenance Notes

### Regular Tasks
- Monitor Stripe dashboard for failed payments
- Review webhook delivery logs
- Reconcile Order vs Stripe PaymentIntent statuses
- Clean up abandoned pending orders (older than 24 hours)

### Troubleshooting

**Webhook not received:**
- Check Stripe Dashboard webhook logs
- Verify endpoint URL correct
- Check signature verification

**Duplicate enrollments:**
- Check idempotency logic
- Verify `select_for_update()` working

**Payment succeeded but no enrollment:**
- Check webhook processing logs
- Verify transaction.atomic() not rolling back
- Check for unhandled exceptions
