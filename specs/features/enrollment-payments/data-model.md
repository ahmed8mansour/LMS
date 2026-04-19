# Enrollment & Payments - Data Model

This document describes all database entities owned by the Enrollment & Payments feature.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      ENROLLMENT & PAYMENTS                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐       ┌─────────────┐       ┌─────────────────┐
│    Order    │───────│ Transaction │       │   Enrollment    │
├─────────────┤       ├─────────────┤       ├─────────────────┤
│ id (PK)     │       │ id (PK)     │       │ id (PK)         │
│ course (FK)─┼───────┼─ order (FK) │       │ course (FK)─────┼──▶ Course
│ user (FK)──┼───────┼─ status      │       │ user (FK)───────┼──▶ CustomUser
│ status      │       │ amount       │       │ order (FK)──────┼──▶ Order
│ amount      │       │ currency     │       │ is_active       │
│ currency    │       │ stripe_pi_id│      │ enrolled_at    │
│ stripe_pi_id│       │ stripe_charge│                             │
└─────────────┘       │ stripe_receipt│      └─────────────────┘
                      └─────────────┘

RELATIONSHIPS:

Order
├── Course (purchased course)
├── CustomUser (purchasing user)
├── Transaction (audit trail - one or more)
└── Enrollment (access grant - one per order)

Enrollment
├── Course (access granted to)
├── CustomUser (student)
└── Order (purchase record)
```

---

## Entities Owned by Enrollment & Payments

### 1. Order

Represents a purchase attempt for a course. Tracks payment status and links to the course, user, and Stripe PaymentIntent.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Auto-generated primary key |
| course | ForeignKey | FK → Course, non-null | Course being purchased |
| user | ForeignKey | FK → CustomUser, non-null | Purchasing user |
| status | CharField | choices: pending/failed/paid/refunded | Payment status |
| amount | DecimalField | max_digits=6, decimal_places=2 | Purchase amount |
| currency | CharField | choices: USD | Currency code |
| stripe_payment_intent_id | TextField | non-null | Stripe PaymentIntent ID |

**Status Choices:**
- `pending` (default): Order created, payment not yet completed
- `paid`: Payment successful via webhook
- `failed`: Payment failed or error occurred
- `refunded`: Payment refunded (manual action)

**Constraints:**
- No unique constraints (allows multiple purchases of same course)
- Order is created before payment attempt

**Relationships:**
- ForeignKey → Course
- ForeignKey → CustomUser
- ForeignKey (reverse) → Transaction (one-to-many)
- ForeignKey (reverse) → Enrollment (one-to-one)

**Business Logic:**
- Created with `status='pending'` when PaymentIntent is created
- Updated to `status='paid'` via webhook on successful payment
- Updated to `status='failed'` on payment failure
- `stripe_payment_intent_id` populated at creation

---

### 2. Transaction

Audit trail record for each payment event. Stores detailed Stripe information for accounting and debugging.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| order | ForeignKey | FK → Order, non-null | Related order |
| status | CharField | choices: pending/failed/paid/refunded | Transaction status |
| amount | DecimalField | max_digits=6, decimal_places=2 | Transaction amount |
| currency | CharField | choices: usd/USD | Currency code |
| stripe_payment_intent_id | TextField | non-null | Stripe PaymentIntent ID |
| stripe_charge_id | TextField | non-null | Stripe Charge ID |
| stripe_receipt_id | TextField | non-null | Stripe Receipt ID |

**Status Choices:**
- `pending`: Transaction record created
- `paid`: Payment confirmed via webhook
- `failed`: Payment failed
- `refunded`: Payment refunded

**Constraints:**
- Non-null fields for all Stripe IDs (audit requirement)

**Relationships:**
- ForeignKey → Order

**Business Logic:**
- Created for every payment event
- Multiple transactions per order possible (retries, refunds)
- Stores Stripe's IDs for cross-reference

**Note:** Currently creates Transaction only for `paid` status. Should also create for `failed` status for complete audit trail.

---

### 3. Enrollment

Represents active access to a course. Created automatically upon successful payment.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| course | ForeignKey | FK → Course, non-null | Enrolled course |
| user | ForeignKey | FK → CustomUser, non-null | Student |
| order | ForeignKey | FK → Order, non-null | Purchase record |
| is_active | BooleanField | | Access status |
| enrolled_at | DateTimeField | auto_now_add | Enrollment timestamp |

**Constraints:**
- Unique together: (user, course) - prevents duplicate enrollments

**Relationships:**
- ForeignKey → Course
- ForeignKey → CustomUser
- ForeignKey → Order

**Business Logic:**
- Created via webhook after payment success
- `is_active` can be set to False to revoke access (refund, suspension)
- `get_or_create` prevents duplicate enrollments on duplicate webhooks

---

## Relationships to Other Features

### Course Management
- **Order.course → Course**: References the course being purchased
- **Enrollment.course → Course**: Links student to course
- **Order updates Course.subscribers_count**: Signal updates subscriber count

### Authentication System
- **Order.user → CustomUser**: Who made the purchase
- **Enrollment.user → CustomUser**: Who gets access
- **Both use CustomUser.id**: User identity throughout

### Progress Tracking
- **Enrollment required for LectureProgress**: Student must be enrolled to track progress
- **Enrollment required for QuizAttempt**: Student must be enrolled to take quizzes
- **Enrollment.is_active checked**: Must be active to access content

---

## Data Flow

### Payment Success Flow

```
1. Create PaymentIntent
   └── Order created (status='pending')

2. Payment Confirmed (webhook)
   └── Order updated (status='paid')
       └── Transaction created (status='paid')
           └── Enrollment created (is_active=True)
               └── Course.subscribers_count incremented
```

### Payment Failure Flow

```
1. Create PaymentIntent
   └── Order created (status='pending')

2. Payment Failed (webhook)
   └── Order updated (status='failed')
       └── [No Transaction created - currently]
           └── [No Enrollment created]
```

### Refund Flow (Manual)

```
1. Refund initiated in Stripe Dashboard
   └── Refund webhook received (not implemented)
       └── [Manual process currently]
           └── Order updated (status='refunded')
               └── Enrollment updated (is_active=False)
                   └── Course.subscribers_count decremented
```

---

## TypeScript Interfaces

```typescript
// Order
interface Order {
    id: number;
    course: number;          // FK
    user: number;            // FK
    status: 'pending' | 'failed' | 'paid' | 'refunded';
    amount: string;          // Decimal serialized as string
    currency: 'USD';
    stripe_payment_intent_id: string;
}

// Transaction
interface Transaction {
    id: number;
    order: number;           // FK
    status: 'pending' | 'failed' | 'paid' | 'refunded';
    amount: string;
    currency: 'usd' | 'USD';
    stripe_payment_intent_id: string;
    stripe_charge_id: string;
    stripe_receipt_id: string;
}

// Enrollment
interface Enrollment {
    id: number;
    course: number;          // FK
    user: number;            // FK
    order: number;           // FK
    is_active: boolean;
    enrolled_at: string;     // ISO 8601 date
}

// API Request/Response
interface CreatePaymentIntentRequest {
    course: number;          // Course ID
}

interface CreatePaymentIntentResponse {
    client_secret: string;   // Stripe client secret
    order: {
        id: number;          // Order ID
        currency: string;    // USD
        amount: string;      // Decimal as string
        status: 'pending' | 'paid' | 'failed' | 'refunded';
    };
}

// State Recovery Endpoint
interface GetOrderDetailsRequest {
    order_id: number;        // Order ID from URL
}

interface GetOrderDetailsResponse {
    order_id: number;
    client_secret: string;   // Fresh client secret
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    course: CourseSummary;   // Course details
    amount: string;
    currency: string;
}

interface CourseSummary {
    id: number;
    title: string;
    thumbnail: string;
    instructor_name: string;
    price: string;
}

interface PaymentWebhookEvent {
    type: 'payment_intent.succeeded' | 'payment_intent.payment_failed';
    data: {
        object: {
            id: string;              // PaymentIntent ID
            metadata: {
                order_id: string;
                course_id: string;
                user_id: string;
            };
        };
    };
}

// TanStack Query Cache Structure
interface OrderDetails {
    order_id: number;
    client_secret: string;
    status: 'pending' | 'paid' | 'failed' | 'refunded';
    amount: string;
    currency: string;
    course: CourseSummary;
}
```

---

## Business Rules

### Payment Lifecycle

| Current Status | Event | New Status | Action |
|----------------|-------|------------|--------|
| pending | Payment Success | paid | Create enrollment |
| pending | Payment Failure | failed | No enrollment |
| paid | Refund | refunded | Deactivate enrollment |
| failed | Retry | pending | New PaymentIntent |
| refunded | Chargeback | refunded | Keep enrollment inactive |

### Enrollment Rules

1. **Unique Enrollment:** One active enrollment per (user, course) pair
2. **Payment Required:** Enrollment only created after payment confirmation
3. **Access Control:** Progress tracking requires `is_active=True`
4. **Automatic Creation:** Enrollment created via webhook, not manual API

### Order Rules

1. **Immutable Amount:** Order amount set at creation, never changes
2. **Stripe Link:** Every order linked to Stripe PaymentIntent
3. **Audit Trail:** Order status changes tracked (no history table currently)

---

## Indexes Summary

| Entity | Field(s) | Type | Purpose |
|--------|----------|------|---------|
| Order | course | B-tree | Look up orders by course |
| Order | user | B-tree | Look up orders by user |
| Order | status | B-tree | Filter by status |
| Transaction | order | B-tree | Look up transactions by order |
| Transaction | stripe_payment_intent_id | B-tree | Cross-reference with Stripe |
| Enrollment | course | B-tree | Look up enrollments by course |
| Enrollment | user | B-tree | Look up enrollments by user |
| Enrollment | (user, course) | Unique | Prevent duplicates |

### Recommended Additional Indexes

```python
# For webhook lookups (by PaymentIntent ID)
class Order(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['stripe_payment_intent_id']),
            models.Index(fields=['user', 'status']),  # User's order history
        ]

class Enrollment(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['course', 'is_active']),  # Active students
            models.Index(fields=['user', 'is_active']),      # User's active courses
        ]
```

---

## Cascade Behavior

### Deletion Rules

**Order Deletion:**
```
Order.delete()
    └── CASCADE Transaction.delete()  [All related transactions]
    └── PROTECT Enrollment           [Prevents deletion if enrollment exists]
```

**Course Deletion:**
```
Course.delete()
    └── PROTECT Order                [Prevents course deletion with orders]
    └── CASCADE Enrollment.delete()  [All course enrollments]
```

**User Deletion:**
```
CustomUser.delete()
    └── CASCADE Order.delete()       [All user's orders]
    └── CASCADE Enrollment.delete()  [All user's enrollments]
```

**Protection Reasoning:**
- Orders protected from deletion to preserve audit trail
- Enrollments protected from order deletion to maintain access records
- Transactions cascade (they're just audit logs)

### Get Order Details for State Recovery
```python
def get_order_details(request, order_id):
    """
    Frontend calls this to recover payment session.
    Validates order belongs to current user and is still pending.
    Used by TanStack Query's useGetOrderDetail hook.
    """
    try:
        order = Order.objects.select_related('course', 'course__instructor').get(
            id=order_id,
            user=request.user,
            status='pending'  # Only return if still pending
        )
        
        # Get fresh client_secret from Stripe
        intent = stripe.PaymentIntent.retrieve(order.stripe_payment_intent_id)
        
        return {
            'order_id': order.id,
            'client_secret': intent.client_secret,
            'status': order.status,
            'course': {
                'id': order.course.id,
                'title': order.course.title,
                'thumbnail': order.course.thumbnail.url if order.course.thumbnail else None,
                'instructor_name': order.course.instructor.get_full_name(),
                'price': str(order.amount)
            },
            'amount': str(order.amount),
            'currency': order.currency
        }
    except Order.DoesNotExist:
        return {'error': 'Order not found or not accessible'}, 404
```

**Security Checks:**
1. Order must belong to `request.user` (returns 403 if not)
2. Order status must be `pending` (returns 404 if paid/failed)
3. Order ID in URL must match the requested order

---

## Data Retention

### Recommended Cleanup Tasks

**Old Pending Orders:**
```sql
-- Delete pending orders older than 24 hours
DELETE FROM enrollment_order
WHERE status = 'pending'
AND created_at < NOW() - INTERVAL '24 hours';
```

**Old Failed Orders:**
```sql
-- Archive or delete old failed orders
DELETE FROM enrollment_order
WHERE status = 'failed'
AND created_at < NOW() - INTERVAL '30 days';
```

**Transaction Retention:**
- Keep all transactions indefinitely (audit requirement)
- Consider archiving to cold storage after 1 year

### Retention Policy

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Paid Orders | Indefinite | Financial record |
| Transactions | Indefinite | Audit trail |
| Enrollments | Indefinite | Access history |
| Pending Orders | 24 hours | Abandoned carts |
| Failed Orders | 30 days | Debugging |

---

## Sample Queries

### Get User's Active Enrollments
```python
enrollments = Enrollment.objects.filter(
    user=request.user,
    is_active=True
).select_related('course')
```

### Get Course Enrollments
```python
enrollments = Enrollment.objects.filter(
    course=course,
    is_active=True
).select_related('user')
```

### Get User's Order History
```python
orders = Order.objects.filter(
    user=request.user
).order_by('-created_at')
```

### Check if User Enrolled in Course
```python
is_enrolled = Enrollment.objects.filter(
    user=user,
    course=course,
    is_active=True
).exists()
```

### Get Pending Orders (for cleanup)
```python
old_pending = Order.objects.filter(
    status='pending',
    created_at__lt=timezone.now() - timedelta(hours=24)
)
```

### Revenue Report
```python
from django.db.models import Sum

revenue = Order.objects.filter(
    status='paid',
    created_at__year=2025
).aggregate(total=Sum('amount'))
```

---

## Validation Requirements

### Order Validation

```python
# Amount must be positive
def clean(self):
    if self.amount <= 0:
        raise ValidationError("Amount must be positive")

# Status transitions must be valid
VALID_TRANSITIONS = {
    'pending': ['paid', 'failed'],
    'paid': ['refunded'],
    'failed': ['pending'],  # Retry
    'refunded': []
}
```

### Enrollment Validation

```python
# Prevent duplicate active enrollments
class Meta:
    unique_together = ['user', 'course']

# Deactivate before creating new (if needed)
def replace_enrollment(self):
    Enrollment.objects.filter(user=user, course=course).update(is_active=False)
    return Enrollment.objects.create(user=user, course=course, is_active=True)
```

---

## Integration Examples

### Check Enrollment Before Content Access

```python
def get_course_content(request, course_id):
    if not request.user.is_authenticated:
        return Response({"error": "Login required"}, status=401)
    
    enrollment = Enrollment.objects.filter(
        user=request.user,
        course_id=course_id,
        is_active=True
    ).first()
    
    if not enrollment:
        return Response({"error": "Not enrolled"}, status=403)
    
    # Return course content...
```

### Frontend State Recovery (TanStack Query)
```typescript
// hooks/useGetOrderDetail.ts
export function useGetOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: orderId ? () => enrollmentAPI.getOrderDetail(orderId) : skipToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// CourseCheckout component
export function CourseCheckout() {
  const params = useParams();
  const order_id = params.orderID as string | undefined;

  // Cache-first strategy:
  // - First load: uses cached data from createPaymentIntent (no network request)
  // - Refresh/stale: refetches from /get-order-details/
  const { data: orderData, isLoading, error } = useGetOrderDetail(order_id || null);

  const course_data = orderData?.course;

  // ... render checkout UI
}
```

### TanStack Query Cache Structure
```typescript
// Query key: ['order', orderId]
interface OrderDetails {
  order_id: number;          // Order ID
  client_secret: string;     // Stripe client secret
  status: 'pending';         // Order status
  amount: string;            // Decimal as string
  currency: 'USD';           // Currency code
  course: CourseSummary;     // Course details
}

// Cache populated by createPaymentIntent mutation
onSuccess(data: CreatePaymentIntentResponse, variables) {
  const course_data = queryClient.getQueryData(['course', variables]);
  
  queryClient.setQueryData(['order', data.order.id], {
    order_id: data.order.id,
    client_secret: data.client_secret,
    status: data.order.status,
    amount: data.order.amount,
    currency: data.order.currency,
    course: course_data,
  } as OrderDetails);
}
```

### Create Order and PaymentIntent

```python
with transaction.atomic():
    order = Order.objects.create(
        course=course,
        user=user,
        status='pending',
        amount=course.price,
        currency='USD'
    )
    
    intent = stripe.PaymentIntent.create(
        amount=int(course.price * 100),
        currency='usd',
        metadata={
            'order_id': order.id,
            'course_id': course.id,
            'user_id': user.id
        }
    )
    
    order.stripe_payment_intent_id = intent.id
    order.save()
```

### Webhook Handler

```python
def handle_payment_succeeded(payment_intent):
    metadata = payment_intent['metadata']
    
    with transaction.atomic():
        order = Order.objects.select_for_update().get(
            id=metadata['order_id']
        )
        
        if order.status == 'paid':
            return  # Already processed
        
        order.status = 'paid'
        order.save()
        
        Enrollment.objects.get_or_create(
            user_id=metadata['user_id'],
            course_id=metadata['course_id'],
            defaults={
                'order': order,
                'is_active': True
            }
        )
```
