# Enrollment & Payments - Tasks

## Status: BACKEND COMPLETE / FRONTEND MISSING

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
  - [x] Return client_secret
  - [x] Error handling (StripeError, Exception)
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

### Stripe Integration (Not Implemented)
- [ ] Install @stripe/stripe-js
- [ ] Install @stripe/react-stripe-js
- [ ] Configure Stripe publishable key
- [ ] Create Stripe provider wrapper
- [ ] Create payment modal component
- [ ] Create card input component
- [ ] Implement payment confirmation

### Payment Flow UI (Not Implemented)
- [ ] Payment modal/sheet
  - [ ] Course summary display
  - [ ] Price breakdown
  - [ ] Card input (Stripe Elements)
  - [ ] Pay button
  - [ ] Cancel button
- [ ] Processing state
  - [ ] Loading spinner
  - [ ] "Processing payment..." message
- [ ] Success state
  - [ ] Success animation
  - [ ] "Payment successful" message
  - [ ] "Go to course" button
  - [ ] "Go to dashboard" button
- [ ] Error state
  - [ ] Error message display
  - [ ] Card declined message
  - [ ] Retry button
  - [ ] Contact support link

### Enrollment Button Integration (Not Implemented)
- [ ] Connect "Enroll Now" to payment flow
  - [ ] Check authentication
  - [ ] Check if already enrolled
  - [ ] Create payment intent API call
  - [ ] Open payment modal
- [ ] Loading state on button
- [ ] Success redirect to dashboard
- [ ] Error toast notifications

### API Layer (Not Implemented)
- [ ] enrollmentAPI.createPaymentIntent(courseId)
- [ ] enrollmentAPI.checkEnrollmentStatus(courseId)

### Hooks (Not Implemented)
- [ ] useCreatePaymentIntent
- [ ] usePaymentConfirmation
- [ ] useEnrollmentStatus

### Types (Not Implemented)
- [ ] PaymentIntentResponse TypeScript interface
- [ ] Order TypeScript interface
- [ ] Transaction TypeScript interface
- [ ] Enrollment TypeScript interface

---

## Integration Tasks

### Backend Integration
- [x] Course model integration (Order.course)
- [x] User model integration (Order.user, Enrollment.user)
- [x] Enrollment signals (update subscribers_count)
- [x] Progress API integration (enrollment check)

### Frontend Integration (Not Implemented)
- [ ] CourseEnrollCard integration
- [ ] Course detail page integration
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

### Frontend Tests (Not Applicable - Not Implemented)
- [ ] Payment form validation
- [ ] Payment confirmation flow
- [ ] Error handling tests
- [ ] E2E test: Complete purchase flow

### Manual Testing
- [ ] Test with Stripe test cards
  - [ ] Successful payment
  - [ ] Declined card
  - [ ] Insufficient funds
- [ ] Test webhook handling
- [ ] Test enrollment after payment
- [ ] Test duplicate webhook calls

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
- [ ] Frontend integration guide (pending implementation)
- [ ] Webhook setup guide
- [ ] Testing guide
