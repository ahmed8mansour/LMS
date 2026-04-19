# Enrollment & Payments - Architecture Plan

## Architecture Overview

The Enrollment & Payments system uses a **Stripe PaymentIntent-based architecture** with webhook confirmation for secure, PCI-compliant payment processing. The design separates payment creation (client-initiated) from payment confirmation (webhook-driven) for reliability.

**State Management:** Uses **TanStack Query** exclusively (no Zustand) for server state with a cache-first strategy.

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

### 6. TanStack Query for State Management (No Zustand)

**Decision:** Use TanStack Query exclusively for payment state management.

**Structure:**
```typescript
// Query key: ['order', orderId]
interface OrderDetails {
  order_id: number;
  client_secret: string;
  status: 'pending';
  amount: string;
  currency: string;
  course: Course;
}
```

**Cache-First Strategy:**
```typescript
// createPaymentIntent mutation
onSuccess(data) {
  // Populate query cache for checkout page
  queryClient.setQueryData(['order', data.order.id], {
    order_id: data.order.id,
    client_secret: data.client_secret,
    status: data.order.status,
    amount: data.order.amount,
    currency: data.order.currency,
    course: course_data,
  });
}

// Checkout page
const { data } = useGetOrderDetail(orderId);
// First load: returns cached data (no network request)
// Refresh/stale: refetches from /get-order-details/
```

**Rationale:**
- **Single source of truth:** Server state managed by TanStack Query
- **No redundant state:** Zustand would duplicate TanStack Query's capabilities
- **Automatic caching:** Built-in cache invalidation, stale time, refetch on window focus
- **Cleaner architecture:** No separate store files needed

---

## Data Flow Architecture

### Payment Creation Flow (TanStack Query)

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
  │-- Return {client_secret, order: {id, currency, amount, status}}
  │
  ▼
Frontend
  │-- useCreatePaymentIntent.onSuccess():
  │   queryClient.setQueryData(['order', order.id], {...})
  │
  ▼
Redirect
  │-- /courses/checkout/{order.id}/
```

### Checkout Page Load (Cache-First Pattern)

```
Checkout Page Mount
  │
  ▼
useGetOrderDetail(orderId)
  │
  ├── Cache Exists? (first load) ──┐
  │                                 ▼
  │                      Returns cached data immediately
  │                      No network request
  │
  └── Cache Missing/Stale? (refresh) ──┐
                                       ▼
                          POST /get-order-details/
                          │
                          ▼
                          Backend validates:
                          - Order belongs to current user
                          - Order matches course_id
                          - Order status is "pending"
                          │
                          ▼
                          Returns fresh {client_secret, course}
                          │
                          ▼
                          Updates TanStack Query cache
```

### State Recovery Decision Tree

```
Checkout Page Entry
  │
  ├─ Has orderID param? ──┐
  │                       │
  │   No                  ▼
  │                Redirect to course page
  │   Yes               │
  │                     ▼
  │    ├─ TanStack Query cache valid? ──┐
  │    │                                 │
  │    │   Yes (first load)              ▼
  │    │                       Use cached data
  │    │                       (Fast path - no network)
  │    │                                 │
  │    │   No (refresh/stale)            ▼
  │    │                       Fetch /get-order-details/
  │    │                       Validate ownership
  │    │                       Update cache
  │    │                       (Recovery path)
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

### Order Ownership Validation

```python
class GetOrderDetailsView(APIView):
    def post(self, request):
        order = Order.objects.get(id=order_id)
        
        # Verify order belongs to current user
        if order.user_id != request.user.id:
            return Response(
                {'error': 'You do not have permission to access this order'},
                status=status.HTTP_403_FORBIDDEN
            )
```

**Why:**
- Prevents accessing another user's payment data
- Returns 403 on user mismatch
- Returns 404 if order not found or not pending

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
│   ├── GetOrderDetailsView         # State recovery endpoint
│   └── StripeWebhookView
├── serializers.py
│   ├── CreatePaymentSerializer
│   ├── GetOrderDetailsSerializer
│   ├── OrderDetailsResponseSerializer
│   ├── OrderSummarySerializer      # For create-payment-intent response
│   └── EnrollmentSerializer
├── urls.py
│   ├── create-payment-intent/
│   ├── get-order-details/          # Recovery endpoint
│   └── payment-webhook/
└── signals.py
    └── update_subscribers_count
```

**Create Payment Intent Response:**
```python
# POST /enrollment/create-payment-intent/
# Response (200):
{
    "client_secret": "pi_xxx_secret_xxx",
    "order": {
        "id": 123,
        "currency": "USD",
        "amount": "29.99",
        "status": "pending"
    }
}
```

**Get Order Details Response:**
```python
# POST /enrollment/get-order-details/
# Response (200):
{
    "order_id": 123,
    "client_secret": "pi_xxx_secret_xxx",
    "status": "pending",
    "amount": "29.99",
    "currency": "USD",
    "course": {
        "id": 1,
        "title": "Course Title",
        "thumbnail": "/media/...",
        "instructor_name": "John Doe",
        "price": "29.99"
    }
}
```

### Frontend
```
featuers/enrollment/
├── api/
│   └── enrollment.api.ts           # API functions
├── components/
│   ├── CourseEnrollCard.tsx        # "Enroll Now" button
│   └── CourseCheckout.tsx          # Checkout page
├── hooks/
│   ├── useCreatePaymentIntent.ts   # Mutation for creating payment
│   └── useGetOrderDetail.ts        # Query for order details
├── types/
│   └── enrollment.types.ts         # TypeScript interfaces
└── index.ts

app/(main)/courses/checkout/
└── [orderID]/
    └── page.tsx                    # Checkout route page
```

**useCreatePaymentIntent Hook:**
```typescript
export function useCreatePaymentIntent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: enrollmentAPI.createPaymentIntent,
        onSuccess(data: CreatePaymentIntentResponse, variables) {
            // Get course data from cache
            const course_data = queryClient.getQueryData(['course', variables]);

            // Populate query cache for checkout page
            queryClient.setQueryData(['order', data.order.id], {
                order_id: data.order.id,
                client_secret: data.client_secret,
                status: data.order.status,
                amount: data.order.amount,
                currency: data.order.currency,
                course: course_data,
            } as OrderDetails);

            toastsuccess('Order created successfully');
        },
        onError(error, variables) {
            handleAuthError(error, 'Creating Order Failed');
        },
    });
}
```

**useGetOrderDetail Hook:**
```typescript
export function useGetOrderDetail(id: string | null) {
    return useQuery({
        queryKey: ['order', id],
        queryFn: id ? () => enrollmentAPI.getOrderDetail(id) : skipToken,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
```

**CourseCheckout Component:**
```typescript
export function CourseCheckout() {
    // Get order_id from route params
    const params = useParams();
    const order_id = params.orderID as string | undefined;

    // Use TanStack Query - cache-first strategy
    const { data: orderData } = useGetOrderDetail(order_id || null);

    // Data sourced from TanStack Query cache
    const course_data = orderData?.course;

    return (
        // ... checkout UI
    );
}
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
    assert 'client_secret' in response.data
    assert 'order' in response.data
    
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

4. **Cache-First Behavior:**
   - Create payment intent
   - Navigate to checkout (should use cache)
   - Refresh page (should refetch)
   - Verify order ownership validation

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

**Checkout page shows loading forever:**
- Verify TanStack Query cache is populated
- Check useGetOrderDetail hook is called with correct order ID
- Verify /get-order-details/ endpoint returns 200
