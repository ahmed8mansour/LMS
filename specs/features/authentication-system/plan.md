# Authentication System - Architecture Plan

## Architecture Overview

The authentication system is built around a **JWT cookie-based architecture** with HttpOnly cookies for access and refresh tokens. This approach protects tokens from XSS while preserving standard API authentication behavior.

---

## Key Architectural Decisions

### 1. JWT in HttpOnly Cookies

**Decision:** Store access and refresh tokens in HttpOnly cookies.

**Rationale:**

- Prevents JavaScript access to tokens
- Reduces risk of token theft from XSS
- Allows automatic cookie sending with requests

**Trade-offs:**

- Requires a refresh endpoint because token expiry is not visible in JS
- Needs careful cookie configuration for production domains
- Requires custom authentication handling for cookie extraction

**Implementation:**

```python
response.set_cookie(
    key='access_token',
    value=access_token,
    expires=...,
    **settings.JWT_COOKIE_SETTINGS
)
```

```typescript
axiosInstance.defaults.withCredentials = true;
```

### 2. Custom CookieJWTAuthentication Class

**Decision:** Use `CookieJWTAuthentication` to support both Authorization headers and HttpOnly cookies.

**Rationale:**

- Maintains compatibility with DRF permissions
- Provides fallback for API clients using Authorization headers
- Keeps frontend logic simple when using cookies

**Implementation:**

```python
class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = self.get_header(request) or request.COOKIES.get('access_token')
        ...
```

### 3. Three-Role User Model with Profile Extension

**Decision:** Keep a single `CustomUser` model with role-specific OneToOne profile tables.

**Rationale:**

- Aligns with Django auth expectations
- Keeps role-specific data separate and extensible
- Simplifies permission checks across the platform

**Structure:**

```
CustomUser
├── StudentProfile
├── InstructorProfile
└── AdminProfile
```

**Role Mapping:**

- Student: `is_staff=False`, `is_superuser=False`
- Instructor: `is_staff=True`, `is_superuser=False`
- Admin: `is_staff=True`, `is_superuser=True`

### 4. OTP-Based Email Verification

**Decision:** Use 6-digit numeric OTPs stored in the database.

**Rationale:**

- Easy to send via email
- Simple verification flow for registration and password reset
- Reusable across all OTP-based auth flows

**Implementation:**

- OTPs are stored in `EmailOTP`
- Each OTP has `purpose`, `expires_at`, and `is_used`
- New OTPs invalidate previous active OTPs for the same purpose

### 5. Password Reset Cookie Flow

**Decision:** Preserve reset authorization via an HttpOnly `password_reset_token` cookie.

**Rationale:**

- Keeps temporary reset state on the backend
- Avoids exposing reset tokens to frontend JS
- Allows multi-step reset flows with OTP verification followed by password set

**Implementation:**

- `forgetpassword/verifyOTP/` sets the reset token cookie
- `forgetpassword/SetNewPassword/` reads the cookie to authorize the password update

### 6. Google OAuth and Password Setup

**Decision:** Support Google OAuth register/login plus a separate password setup flow.

**Rationale:**

- Users can sign in with Google immediately
- Social accounts can later obtain email/password login
- Prevents locked accounts when social auth is the only login method

**Implementation:**

- `GoogleRegisterSerializer` and `GoogleLoginSerializer` exchange the Google auth code
- Google registration creates an active, verified user with an unusable password
- Google users can set a password through `/auth/google/user/setpassword/...`

---

## Data Flow Architecture

### Registration Flow

The registration flow is split into two phases:

1. Send OTP and create an inactive account
2. Verify OTP and activate account with JWT cookies

### Token Refresh Flow

Because the frontend cannot inspect HttpOnly cookies, the app refreshes expired access tokens through a dedicated endpoint.

### Google Set Password Flow

1. Logged-in Google user requests an OTP
2. Backend sends OTP to the Google email
3. User verifies OTP
4. Backend issues a `password_reset_token` cookie
5. User submits a new password

---

## Scalability Considerations

### Current Limitations

1. `EmailOTP` stored in the database, which is fine for this scope but may need Redis later
2. Refresh token blacklisting is DB-backed and may require optimization at scale
3. No rate limiting on auth endpoints yet
4. Email delivery uses the Django console backend in current configuration

### Future Improvements

1. Move OTP storage to Redis for natural expiry and faster performance
2. Add request throttling for login and OTP endpoints
3. Rotate refresh tokens on each refresh cycle
4. Consider Redis-based token blacklist for heavy load

---

## Security Measures

### Implemented

1. Password hashing with Django default PBKDF2
2. HS256 JWT tokens with standard expiry values
3. HttpOnly cookies with SameSite=Lax
4. Reset token cookie for password recovery
5. OTP expiry and single-use enforcement

### Recommendations

1. Add rate limiting to auth endpoints
2. Add stronger password complexity rules
3. Add account lockout after repeated failed login attempts
4. Add audit logging for critical auth events

---

## Integration Points

### With Course Management

- Instructors create courses after authentication
- Students enroll in courses after authentication

### With Enrollment/Payments

- Enrollments require authenticated users
- User identity is tied to orders and transactions

### With Progress Tracking

- Student profile is needed for progress records
- Authenticated users can access learning dashboard data

---

## Testing Strategy

### Unit Tests

- OTP validation and expiry
- Password reset token flow
- JWT cookie handling
- Google auth exchange and registration

### API Tests

- Registration, login, logout, refresh, profile, and password flows
- Google register/login and Google password setup

### Frontend Tests

- Auth forms
- OTP flows
- Redirect and protected route behavior

---

## Deployment Notes

- Ensure `JWT_COOKIE_SETTINGS` are production-ready
- Use a real email backend instead of Django console in production
- Configure CORS and cookie domains correctly

### Integration Tests

- Full registration flow
- Login with various credential combinations
- Token refresh behavior
- Logout and token blacklisting

### E2E Tests

- User registration via UI
- Login/logout flow
- Password reset flow
- Google OAuth flow

### Security Tests

- XSS attempt with token theft
- CSRF attempt on protected endpoints
- Brute force login attempts
- Token replay after logout

---

## Deployment Considerations

### Environment Variables

```bash
# Required
SECRET_KEY=<django-secret-key>
DEBUG=false
JWT_COOKIE_SETTINGS="{'httponly': True, 'secure': True, 'samesite': 'Lax'}"

# OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_SECRET=<client-secret>

# Email (production)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
```

### HTTPS Required

- JWT cookies marked Secure require HTTPS
- OAuth redirects require HTTPS callbacks
- Mixed content warnings if media on HTTP

### Cookie Domain

- Set to `.example.com` for subdomains
- Match frontend domain exactly
- Include in CORS allowed origins

---

## Alternative Approaches Considered

### 1. Session-Based Authentication

**Rejected**: Not suitable for SPA + API architecture, requires sticky sessions

### 2. localStorage for Tokens

**Rejected**: Vulnerable to XSS attacks, but simpler implementation

### 3. OAuth Only (no email/password)

**Rejected**: Business requirement for email/password login

### 4. Separate User Tables per Role

**Rejected**: Breaks Django's auth system assumptions

---

## Files Organization

### Backend

```
apps/authentication/
├── models.py        # CustomUser, profiles, OTP, tokens
├── serializers.py   # All serializers
├── views.py         # All endpoints
├── urls.py          # URL routing
├── utils.py         # CookieJWTAuthentication, utilities
└── admin.py         # Admin configuration
```

### Frontend

```
featuers/auth/
├── api/
│   └── auth.api.ts          # API functions
├── components/
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   ├── RegisterOTPComponent.tsx
│   ├── GoogleLoginButton.tsx
│   ├── GoogleRegisterButton.tsx
│   ├── UserAvatar.tsx
│   └── froget-password/     # Password reset components
├── hooks/
│   ├── useLogin.tsx
│   ├── useRegister.tsx
│   ├── useLogout.tsx
│   └── forget-password/     # Password reset hooks
├── schemas/
│   └── auth.schma.ts        # Zod schemas
├── types/
│   └── auth.types.ts        # TypeScript interfaces
└── index.ts                 # Public exports
```

---

## Maintenance Notes

### Regular Tasks

- Clean expired OTP codes (daily cron)
- Clean expired password reset tokens (daily cron)
- Monitor failed login attempts
- Review token blacklist size

### Migration Considerations

- CustomUser changes require careful migration planning
- Profile table additions are safe (nullable fields)
- OTP/Token models can be rebuilt without data loss
