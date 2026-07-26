# Feature Specification: Production Readiness Audit

**Feature Branch**: `002-production-readiness-audit`  
**Created**: 2026-07-13  
**Status**: Complete  
**Input**: User description: "Deep research and cleanup of all existing features — review previous features and extract what is missing, required for production, and required for making the project work well."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Students Receive Real Emails for OTP and Password Reset (Priority: P1)

A student registers on the platform or resets their password. The system sends a real email with their 6-digit OTP code to their actual email address. The student opens their inbox, reads the code, and completes the verification flow.

**Why this priority**: Without real email delivery, no user can register or recover their password. The system currently prints OTPs to the server console, making it completely unusable for anyone other than a developer with terminal access.

**Independent Test**: Register a new account with a real email address and verify the OTP arrives in the inbox within 30 seconds.

**Acceptance Scenarios**:

1. **Given** the system is configured with an email provider, **When** a user requests registration OTP, **Then** a real email is delivered to their inbox within 30 seconds
2. **Given** a user triggers forget-password, **When** the OTP is generated, **Then** the user receives it via email (not just console output)
3. **Given** the email service is temporarily unavailable, **When** a user requests an OTP, **Then** the system returns a meaningful error instead of a silent false success

---

### User Story 2 - Students Watch Real Course Videos (Priority: P1)

A student enrolls in a course, navigates to a lecture, and watches a real video. The instructor has uploaded the video, and the system serves it through a proper video player with playback controls.

**Why this priority**: The core product value is video-based learning. Currently `video_url` is just a plain string field with no upload mechanism, no validation, and no proper video streaming. Without real video delivery, the platform has no learning content.

**Independent Test**: An instructor uploads a video to a lecture, and a student can play it in the course player with play/pause/seek controls.

**Acceptance Scenarios**:

1. **Given** a lecture has a video uploaded, **When** a student opens the lecture page, **Then** the video loads and plays with standard controls (play, pause, seek, volume, fullscreen)
2. **Given** a lecture video is playing, **When** the video reaches the end, **Then** the system can auto-mark the lecture as complete (or prompt the student)
3. **Given** an instructor creates a lecture, **When** they provide a video, **Then** the system validates and stores it via the media provider (not just a raw text string)

---

### User Story 3 - Students Receive Payment Confirmation and Invoice (Priority: P1)

A student completes a course purchase. The system sends a real confirmation email with a downloadable invoice/receipt PDF. The student can also access their payment history and download invoices from the billing dashboard.

**Why this priority**: Payment confirmation is a legal and trust requirement. Users need proof of purchase, and the platform needs a record trail. Currently no email or receipt is sent on successful payment.

**Independent Test**: Complete a course purchase and verify a confirmation email with invoice PDF arrives in the student's inbox.

**Acceptance Scenarios**:

1. **Given** a student completes a payment, **When** the payment webhook confirms success, **Then** the student receives a confirmation email with a link to the Stripe-hosted receipt
2. **Given** a student visits their billing dashboard, **When** they view their order history, **Then** each paid order has a link to its Stripe-hosted receipt/invoice
3. **Given** a payment fails, **When** the student checks their email, **Then** no false confirmation is sent

---

### User Story 4 - Platform Security is Hardened for Real Users (Priority: P1)

The platform is secured against common attacks so that real user data (emails, passwords, payment info) is protected. This includes rate limiting on authentication endpoints, secure cookie handling, proper CORS configuration, and removal of debug artifacts.

**Why this priority**: Security vulnerabilities like unlimited login attempts, open CORS, debug print statements leaking passwords, and improperly configured cookie security put every user at risk. These must be fixed before any real user touches the system.

**Independent Test**: Attempt brute-force login (10+ rapid attempts) and verify the system blocks further attempts. Verify no sensitive data appears in server logs.

**Acceptance Scenarios**:

1. **Given** a malicious actor tries 10+ rapid login attempts, **When** the rate limit is reached, **Then** further attempts are blocked for a cooldown period
2. **Given** the system is running, **When** any request is processed, **Then** no passwords, OTPs, or tokens are printed to stdout/logs
3. **Given** production deployment, **When** a request comes from an unauthorized origin, **Then** it is rejected by CORS policy
4. **Given** production deployment, **When** JWT cookies are set, **Then** they are marked Secure and SameSite

---

### User Story 5 - Refunds and Multiple Payment Methods (Priority: P2)

A student requests a refund for a course, and the system processes it through the payment provider and updates all records. Additionally, students can choose between multiple payment methods (card, PayPal) at checkout.

**Why this priority**: Refund handling is a business and legal necessity for any payment system. Supporting multiple payment methods increases conversion. Currently there is no refund endpoint and only card payments are supported.

**Independent Test**: Process a refund for a paid order and verify the enrollment is deactivated, the order status updates to "refunded", and the student receives a refund confirmation.

**Acceptance Scenarios**:

1. **Given** an admin initiates a refund for a student's paid order, **When** the refund is processed, **Then** the payment provider issues the refund, the order is marked "refunded", the enrollment is deactivated, and a confirmation email is sent to the student
2. **Given** a student is on the checkout page, **When** they view payment options, **Then** they can choose between multiple methods supported by the payment provider (card, Apple Pay, Google Pay, etc.)
3. **Given** a refund webhook fires from the payment provider, **When** the system processes it, **Then** all related records (order, transaction, enrollment) are updated atomically
4. **Given** the platform later adds a second payment provider, **When** that provider is implemented, **Then** it requires only a new provider class and a configuration value — no changes to checkout, refund, fulfillment, or webhook orchestration logic
5. **Given** the payment provider rejects a charge or is unreachable, **When** the failure surfaces, **Then** the API returns a provider-agnostic error (no provider SDK exception or vendor error code reaches the client)

---

### User Story 6 - Data Integrity Protections Prevent Corrupt State (Priority: P2)

The system enforces data integrity at the database level so that race conditions, duplicate enrollments, and failed payment handling cannot create corrupt or inconsistent state.

**Why this priority**: Without proper database constraints, concurrent requests can create duplicate enrollments, failed payment webhooks crash with integrity errors, and password validation only exists on the frontend (bypassable via direct API calls).

**Independent Test**: Attempt to create a duplicate enrollment via two simultaneous API calls and verify only one succeeds.

**Acceptance Scenarios**:

1. **Given** a student is already enrolled in a course, **When** a second enrollment is attempted concurrently, **Then** the database constraint prevents duplication and returns a meaningful error
2. **Given** a Stripe payment fails, **When** the failure webhook fires, **Then** the transaction record is created successfully without crashing on missing fields
3. **Given** a user submits a password via API (bypassing frontend), **When** the password is weak, **Then** the backend rejects it with a clear validation error

---

### User Story 7 - Code Quality and Consistency Cleanup (Priority: P3)

The codebase is cleaned up so that developer experience is smooth, errors are handled consistently, and no dead code or stale artifacts remain. This includes fixing typos in directory names, removing no-op signals, standardizing error response formats, and removing hardcoded fake data.

**Why this priority**: While not user-facing, these issues slow development, cause subtle bugs (wrong error formats breaking frontend parsing), and will compound as new features are added.

**Independent Test**: All API error responses follow the documented format. No console.log or print statements remain in production code paths. TypeScript types match actual API responses.

**Acceptance Scenarios**:

1. **Given** any API returns an error, **When** the frontend receives it, **Then** the error format is consistent (`{"error": "message"}` or `{"field": ["message"]}`) across all endpoints
2. **Given** a developer reads the codebase, **When** they look at frontend feature directories, **Then** directory names are spelled correctly
3. **Given** the UI shows pricing or discount information, **When** a user views a course, **Then** displayed values reflect actual data (no hardcoded "$149.99" or "40% off")

---

### Edge Cases

- What happens when the email provider is down? The system must return an error to the user rather than silently succeeding.
- What happens when a `charge.refunded` event fires from the payment provider? The system must process it and update order/enrollment/transaction records.
- What happens if two webhook events for the same payment arrive simultaneously? The system must handle idempotency at the database level.
- What happens when a user's refresh token is stolen? Tokens should be rotated on use so a stolen token is invalidated after first use.
- What happens when a student tries to enroll in a free course (price = 0)? The system should bypass the payment flow entirely and create the enrollment directly.
- What happens when a non-card payment method (e.g., Apple Pay) fails mid-flow? The system must handle all payment method error states consistently.
- What happens when a refund is requested but the payment provider rejects it (e.g., outside refund window)? The system must surface the failure reason.
- What happens when an admin attempts to refund an order older than 14 days? The system must reject the request with a clear "refund window expired" error.

## Requirements *(mandatory)*

### Functional Requirements

**Email Delivery (Authentication)**

- **FR-001**: System MUST deliver OTP emails to real email addresses using SendGrid via django-anymail (provider-agnostic abstraction layer enabling future provider swaps without code changes)
- **FR-002**: System MUST return an error when email delivery fails, not silently succeed
- **FR-003**: System MUST rate-limit OTP sending endpoints to prevent spam (max 3 per 5 minutes per email)
- **FR-004**: System MUST enforce the OTP expiry check on forget-password (currently commented out)

**Video Content Delivery (Course Management)**

- **FR-005**: System MUST support video upload for lectures exclusively through Cloudinary (external URLs like YouTube/Vimeo are not accepted)
- **FR-006**: System MUST validate that lecture video URLs are valid Cloudinary-hosted URLs before saving
- **FR-007**: The video player MUST provide standard controls (play, pause, seek, volume, fullscreen)

**Note on Course Management**: Items like instructor dashboard UI, course creation forms, and student analytics views are future features (instructor dashboard), not production-readiness gaps. They are out of scope for this audit.

**Security Hardening**

- **FR-008**: System MUST rate-limit login attempts (max 5 per minute per IP)
- **FR-009**: System MUST rate-limit registration/OTP endpoints (max 3 per 5 minutes per IP)
- **FR-010**: System MUST replace all backend `print()` statements with Python `logging` calls at appropriate levels (INFO for flow events, WARNING for recoverable issues, ERROR for failures). No sensitive data (passwords, OTPs, tokens) may appear in log output at any level.
- **FR-011**: System MUST restrict CORS to explicitly allowed origins (remove `CORS_ALLOW_ALL_ORIGINS = True`)
- **FR-012**: System MUST properly parse the DEBUG setting as a boolean so that cookie Secure flags work correctly
- **FR-013**: System MUST rotate refresh tokens on each use (one-time use tokens)
- **FR-014**: System MUST use `CookieJWTAuthentication` consistently across all protected endpoints (fix `UserSetPasswordView` and `CloudinarySignatureView`)
- **FR-015**: System MUST set `ALLOWED_HOSTS` appropriately for production deployment

**Enrollment & Payment Enhancements**

- **FR-016**: System MUST send a real confirmation email to students on successful payment
- **FR-017**: System MUST provide access to Stripe-hosted invoice/receipt pages for each paid order (linked from billing dashboard and payment confirmation email)
- **FR-018**: System MUST provide an admin-only refund API endpoint that processes refunds through the payment provider, updates order status, deactivates enrollment, and sends confirmation email to the student. Refunds are only allowed within 14 days of the original purchase date.
- **FR-019**: System MUST handle refund webhook events from the payment provider and update records atomically
- **FR-020**: System MUST support multiple payment methods at checkout using the existing payment provider's built-in options (e.g., card, Apple Pay, Google Pay, bank transfers) without requiring separate third-party integrations
- **FR-020a**: System MUST isolate all payment-provider-specific code behind a provider abstraction, such that adding a second payment gateway (e.g., PayPal) requires only a new provider implementation and a configuration value — with no changes to checkout, refund, fulfillment, or webhook orchestration logic. Provider SDK exceptions MUST be translated into domain errors at the provider boundary, so no vendor-specific exception or error code reaches views or clients.
- **FR-020b**: System MUST make payment creation idempotent, enforced by a database uniqueness constraint rather than an application-level existence check, so that concurrent duplicate requests cannot produce a double charge
- **FR-020c**: System MUST deduplicate repeated webhook deliveries by provider event ID, since payment providers re-deliver events on timeout or non-2xx response
- **FR-021**: System MUST process free course enrollments (price = 0) without requiring payment flow
- **FR-022**: Students MUST be able to retry a failed payment without creating a new order (reuse the existing pending order with a fresh payment attempt)
- **FR-023**: The entire audit MUST follow SOLID principles and appropriate design patterns throughout all changes:
  - **Single Responsibility**: Each service/class handles one concern (email service, checkout service, refund service, fulfillment)
  - **Open/Closed**: Payment gateways extensible via a provider abstraction — a new gateway is a new class plus a configuration value, with no edits to existing code
  - **Liskov Substitution**: Email providers interchangeable via django-anymail abstraction; payment gateways interchangeable via the provider ABC
  - **Interface Segregation**: Focused interfaces per service. Note: interfaces are split only where implementations genuinely differ — a split that forces callers into `isinstance()` checks reintroduces the coupling it was meant to remove and MUST be avoided
  - **Dependency Inversion**: Depend on abstractions (django-anymail for email, the payment provider ABC for gateways, DRF throttle classes for rate limiting) not concrete implementations
  - Design patterns: Strategy (email senders), Adapter (payment gateways, video providers), Factory (provider selection by configuration), Facade (checkout/refund services)
  - **Proportionality**: Patterns MUST be justified by a present requirement, not an anticipated one. Repository wrappers over the Django ORM, runtime plugin registries, single-purpose decorators, and class-per-event handler hierarchies are explicitly rejected for this codebase's scale — see the design-decision table in `tasks.md` Phase 7.

**Data Integrity**

- **FR-024**: System MUST add a unique database constraint on Enrollment (user, course) pair
- **FR-025**: System MUST fix the Transaction model creation for failed payments to handle nullable Stripe IDs
- **FR-026**: System MUST validate password strength on the backend (not just frontend Zod schema)
- **FR-027**: System MUST fix `GoogleSetPasswordNewPasswordSerializer` which references non-existent `user.can_change_password` field
- **FR-028**: System MUST use serializer validation for `lecture_id` and `quiz_id` inputs instead of raw `request.data` access

**Code Quality and Consistency**

- **FR-029**: System MUST standardize error response format across all endpoints
- **FR-030**: System MUST fix duplicate URL names in authentication and progress URL configurations
- **FR-031**: System MUST permanently delete the hardcoded "40% Off" discount display from CourseEnrollCard (no discount feature is planned)
- **FR-032**: System MUST permanently delete the "Add to Cart" button from CourseEnrollCard (no cart feature is planned)
- **FR-033**: System MUST remove the no-op `save_user_profile` signal handler
- **FR-034**: System MUST fix stale TypeScript types (e.g., `VerifyOTPResponse` still includes `tokens` field from old implementation)
- **FR-035**: System MUST fix `UserProfileUpdateView` returning 404 instead of 400 on validation errors
- **FR-036**: System MUST set production-appropriate pagination page sizes (currently 2, should be 6+)
- **FR-037**: System MUST fix `Order.status` and `Transaction.status` field choices from set literals `{}` to list/tuple format
- **FR-038**: System MUST update documentation to reflect that the reviews system is fully implemented (not placeholder), the CourseFeedback placeholder component has been deleted, and price range filtering is implemented in the frontend

**Cleanup of Development Artifacts**

- **FR-039**: System MUST replace `datetime.utcnow()` with timezone-aware datetime calls
- **FR-040**: System MUST remove all `console.log` statements from production frontend code paths (no replacement — just delete)
- **FR-041**: System MUST replace all remaining `print()` statements in backend code with proper `logging` calls (covered by FR-010)
- **FR-042**: System MUST replace `any` types in TypeScript with proper types where the shape is known

### Key Entities

One new entity is introduced (`ProcessedWebhookEvent`, required by FR-020c). The rest are modifications to existing entities:

- **Enrollment**: Add missing unique constraint on (user, course)
- **Transaction**: Make `stripe_charge_id` and `stripe_receipt_id` nullable for failed payment records; add `payment_method_type`. Provider-specific field names are later generalized to provider-neutral ones (`gateway_reference`, `gateway_charge_id`, `receipt_url`) per FR-020a
- **Order**: Add `payment_gateway` (which provider owns this order — needed to route refunds and webhooks once more than one gateway exists) and a unique `idempotency_key` per FR-020b
- **ProcessedWebhookEvent** *(new)*: Records provider event IDs already handled, so re-delivered webhooks are ignored rather than double-processed (FR-020c)
- **Lecture**: Validate `video_url` field content rather than accepting arbitrary strings
- **CustomUser**: No changes, but backend password validation is added at the serializer level

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of OTP and password-reset emails are delivered to real inboxes (not console) within 30 seconds
- **SC-002**: Zero sensitive data (passwords, OTPs, tokens) appears in server output during any user flow
- **SC-003**: Brute-force login attempts are blocked after 5 rapid failures, with a cooldown period before retry
- **SC-004**: Students can watch uploaded course videos with full playback controls in the lecture player
- **SC-005**: All API error responses follow one of two formats: `{"error": "message"}` or `{"field": ["message"]}`
- **SC-006**: Duplicate enrollment attempts at the database level are rejected (not just at application level)
- **SC-007**: All protected endpoints consistently use cookie-based JWT authentication
- **SC-008**: Pagination returns production-appropriate page sizes (6 or more items per page)
- **SC-009**: Students receive a confirmation email with a link to Stripe-hosted receipt within 1 minute of successful payment
- **SC-010**: Refund requests are processed and reflected in order status, enrollment, and transaction records
- **SC-011**: Students can pay using at least two payment methods via the existing payment provider (e.g., card + Apple Pay/Google Pay)
- **SC-012**: The "Add to Cart" button and "40% Off" hardcoded text are completely removed from the UI
- **SC-013**: No payment-provider SDK import appears anywhere in the enrollment app outside the single provider adapter module — verifiable by search, and the concrete measure of whether FR-020a's abstraction is real rather than decorative
- **SC-014**: Submitting the same payment request twice concurrently results in exactly one charge, and re-delivering the same webhook event twice results in exactly one fulfillment

## Clarifications

### Session 2026-07-15

- Q: Who can initiate refunds? → A: Admin-only. Students contact support; admins process refunds through an admin endpoint.
- Q: Invoice generation approach? → A: Use Stripe's hosted invoices/receipts. Link to Stripe-generated pages rather than building custom PDF generation.
- Q: Video hosting — Cloudinary-only or external URLs allowed? → A: Cloudinary-only. All lecture videos must be uploaded through Cloudinary; external URLs (YouTube, Vimeo) are rejected.
- Q: Should removed debug output be replaced with proper logging? → A: Backend: replace print() with Python logging at appropriate levels (INFO/WARNING/ERROR). Frontend: just delete console.log with no replacement.
- Q: Refund time window? → A: 14-day window. Refunds only allowed within 14 days of purchase date.
- Q: Email provider choice? → A: SendGrid via django-anymail. Provides provider abstraction (swappable backends), transactional email support, and webhook tracking. Combined with SOLID principles and design patterns throughout.

## Assumptions

- The project will use the existing Cloudinary integration for video hosting (videos uploaded to Cloudinary, URLs stored in `video_url`)
- Email delivery will use SendGrid via django-anymail. django-anymail provides a provider-agnostic abstraction (Dependency Inversion principle) — if SendGrid needs to be replaced later, only the backend setting and API key change, no code modifications needed
- Rate limiting will be implemented using DRF's built-in throttling classes, not requiring additional infrastructure
- The `featuers/` directory typo will NOT be renamed in this feature to avoid a massive git diff across all imports — it will be addressed in a separate cleanup if desired
- Stripe remains in test mode during this feature; the fixes ensure the code will work correctly when live keys are configured
- The "Add to Cart" button is permanently removed — no cart feature is planned for this project
- The hardcoded "40% Off" discount display is permanently removed — no discount/coupon feature is planned
- The reviews system is fully implemented and working (not placeholder) — documentation will be updated to reflect this
- The CourseFeedback placeholder component has already been deleted — documentation will be updated to reflect this
- The price range filtering is already implemented in the frontend — documentation will be updated to reflect this
- Course sorting options (newest, most popular, system default) are complete and correct as-is — no price-based sorting is needed
- Items that are future instructor dashboard features (course creation UI, student analytics, instructor dashboard page) are NOT production-readiness gaps and are explicitly out of scope
- The payment/enrollment system will follow SOLID principles and design patterns (Strategy for payment methods, Observer/Signal for post-payment actions like email, enrollment creation, invoice generation)
- Free courses (price = 0) should be enrollable without entering the payment flow
- Additional payment methods (Apple Pay, Google Pay, etc.) will be enabled through Stripe's built-in Payment Methods API — no separate third-party integrations needed
