# Enrollment & Payments - Tasks

## Status: BACKEND COMPLETE / FRONTEND IN PROGRESS (TANSTACK QUERY)

---

## Backend Tasks

### Models

- [x] Order model
  - [x] course (FK)
  - [x] user (FK)
  - [x] status field (pending/paid/failed/refunded)
  - [x] amount (Decimal)
  - [x] currency (CharField)
  - [x] stripe_payment_intent_id (TextField)
- [x] Transaction model
  - [x] order (FK)
  - [x] status field
  - [x] amount/currency
  - [x] Multiple Stripe IDs (PI, Charge, Receipt)
- [x] Enrollment model
  - [x] course (FK)
  - [x] user (FK)
  - [x] order (FK)
  - [x] is_active (Boolean)
  - [x] enrolled_at (DateTime)
- [x] Database migrations
- [x] Unique constraint (user, course) on Enrollment

### Payment API

- [x] CreatePaymentIntentView
  - [x] POST endpoint
  - [x] Authentication required
  - [x] Course validation
  - [x] Order creation with transaction.atomic
  - [x] Stripe PaymentIntent creation
  - [x] Return client_secret + order summary
  - [x] Error handling (StripeError, Exception)
- [x] GetOrderDetailsView (for state recovery)
  - [x] POST endpoint
  - [x] Authentication required
  - [x] Order validation (exists, belongs to user)
  - [x] Check order status is 'pending'
  - [x] Return {client_secret, order, course}
  - [x] Return 403 if wrong user
  - [x] Return 404 if order not found/not pending
- [x] StripeWebhookView
  - [x] POST endpoint
  - [x] CSRF exempt
  - [x] Signature verification
  - [x] Event type handling (succeeded, failed)
  - [x] Metadata extraction
  - [x] Order status update
  - [x] Transaction record creation
  - [x] Enrollment creation
  - [x] Idempotent processing (check if already paid)
  - [x] Always return 200

### Payment Processing

- [x] Stripe SDK integration
- [x] PaymentIntent creation with metadata
- [x] Automatic payment methods enabled
- [x] Redirects disabled (for card payments)
- [x] Metadata includes order_id, course_id, user_id

### Security

- [x] Webhook signature verification
- [x] CSRF exemption for webhooks only
- [x] Authentication on create-payment-intent
- [x] Transaction.atomic for data consistency
- [x] select_for_update on order (prevent race conditions)

### Error Handling

- [x] StripeError handling (502 response)
- [x] Generic Exception handling (500 response)
- [x] Order.DoesNotExist handling (silent fail for webhooks)
- [x] ValueError for invalid payload
- [x] SignatureVerificationError handling

---

## Frontend Tasks

### Stripe Integration

- [x] Install @stripe/stripe-js
- [x] Install @stripe/react-stripe-js
- [x] Configure Stripe publishable key
- [x] Create Stripe Elements wrapper

### State Management (TanStack Query - No Zustand)

- [x] Use TanStack Query for server state
  - [x] Query key: `['order', orderId]`
  - [x] Cache populated by createPaymentIntent mutation
  - [x] staleTime: 5 minutes
  - [x] No localStorage/sessionStorage (memory only)

### Checkout Flow (Cache-First Pattern)

- [x] Checkout Page (`/courses/checkout/{orderID}/`)
  - [x] Accept orderID from route params
  - [x] useGetOrderDetail hook reads from TanStack Query cache
  - [x] First load: uses cached data (no network request)
  - [x] Refresh/stale: refetches from /get-order-details/
  - [x] Loading state during recovery
  - [x] Redirect on validation failure

### Payment Form

- [x] CheckoutForm component
  - [x] Stripe PaymentElement integration
  - [x] Confirm card payment
  - [x] Loading states (isPending, "Processing..." button)
  - [x] Error display (user-friendly messages for declined cards, insufficient funds, etc.)
- [x] Order Summary display
  - [x] Course details from TanStack Query cache
  - [x] Price breakdown
- [x] Processing state
  - [x] "Processing payment..." message with loader
- [x] Success handling
  - [x] Redirect to dashboard/learning page
- [x] Error handling
  - [x] Card declined message
  - [x] Retry option

### Enrollment Button Integration

- [x] Update "Enroll Now" button
  - [x] Check authentication
  - [x] Check if already enrolled
  - [x] Create payment intent API call
  - [x] Cache response in TanStack Query
  - [x] Redirect to checkout with orderID in route
- [x] Loading state on button
- [x] Error toast notifications

### API Layer

- [x] enrollmentAPI.createPaymentIntent(courseId)
- [x] enrollmentAPI.getOrderDetails(orderId)

### Hooks

- [x] useCreatePaymentIntent (mutation)
- [x] useGetOrderDetail (query)
- [x] usePaymentConfirmation

### Types

- [x] OrderSummary interface
- [x] CreatePaymentIntentResponse interface
- [x] OrderDetails interface
- [x] Clean TypeScript typing throughout

---

## Integration Tasks

### Backend Integration

- [x] Course model integration (Order.course)
- [x] User model integration (Order.user, Enrollment.user)
- [x] Enrollment signals (update subscribers_count)
- [x] Progress API integration (enrollment check)

### Frontend Integration (In Progress)

- [x] CourseEnrollCard integration
- [x] TanStack Query cache integration
- [x] Course detail page integration
- [x] Dashboard page created (placeholder for enrolled courses)
- [ ] Dashboard integration (show enrolled courses)
- [ ] Navbar integration (enrollment count)

---

## Testing Tasks

### Backend Tests

- [ ] Unit test: Order creation
- [ ] Unit test: Transaction creation
- [ ] Unit test: Enrollment creation
- [ ] Integration test: PaymentIntent creation flow
- [ ] Integration test: Webhook handling
- [ ] Integration test: Idempotency (duplicate webhooks)
- [ ] Security test: Webhook signature verification
- [ ] Security test: Unauthorized payment creation

### Frontend Tests

- [ ] TanStack Query cache tests
- [ ] Payment form validation
- [ ] Payment confirmation flow
- [x] Error handling (user-friendly messages for card declined, insufficient funds, expired card, etc.)
- [ ] E2E test: Complete purchase flow

### Manual Testing

- [ ] Test with Stripe test cards
  - [ ] Successful payment
  - [ ] Declined card
  - [ ] Insufficient funds
- [ ] Test webhook handling
- [ ] Test enrollment after payment
- [ ] Test duplicate webhook calls
- [ ] Test cache-first behavior (first load vs refresh)

---

## Deployment Tasks

### Stripe Configuration

- [ ] Create Stripe account
- [ ] Get API keys
- [ ] Configure webhook endpoint
- [ ] Add webhook secret to environment
- [ ] Test webhooks in Stripe CLI

### Environment Setup

- [ ] Add STRIPE_PUBLISHABLE_KEY to frontend .env
- [ ] Add STRIPE_SECRET_KEY to backend .env
- [ ] Add STRIPE_WEBHOOK_SECRET to backend .env
- [ ] Configure webhook URL in production

---

## Known Issues

### Backend

- [ ] Console print statements in webhook handler (debugging)
- [ ] No email receipt on payment success
- [ ] No invoice PDF generation
- [ ] No refund API endpoint
- [ ] Transaction created even for failed payments (should only log attempts)

### Frontend

- [ ] Dashboard is a placeholder - needs enrolled courses display
- [ ] No loading skeleton for order summary during initial load

### Missing Features

- [ ] Cart functionality (multi-course purchase)
- [ ] Discount/promo codes
- [ ] Subscription billing
- [ ] Payment plans (installments)
- [ ] Multiple payment methods (PayPal, Apple Pay)
- [ ] Tax calculation
- [ ] Saved payment methods
- [ ] Receipt/invoice emails

---

## Documentation Tasks

- [x] API endpoint documentation
- [x] Payment flow documentation
- [x] TanStack Query architecture documentation
- [ ] Webhook setup guide
- [ ] Testing guide
