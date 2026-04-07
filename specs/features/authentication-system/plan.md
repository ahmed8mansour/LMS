# Authentication System - Architecture Plan

## Architecture Overview

The authentication system uses a **stateless JWT-based architecture** with tokens stored in HttpOnly cookies for XSS protection, rather than the more common localStorage approach. This decision prioritizes security over ease of implementation.

---

## Key Architectural Decisions

### 1. JWT in HttpOnly Cookies (vs localStorage)

**Decision:** Store JWT tokens in HttpOnly, Secure, SameSite cookies

**Rationale:**
- **XSS Protection**: HttpOnly cookies cannot be accessed by JavaScript, preventing token theft via XSS attacks
- **CSRF Protection**: Combined with CSRF tokens for state-changing operations
- **Automatic Sending**: Cookies automatically sent with requests (no manual header attachment)

**Trade-offs:**
- More complex token refresh logic (can't read expiry from JS)
- Requires careful CORS configuration
- Refresh token rotation harder to implement

**Implementation:**
```python
# Backend: Set cookies on login
response.set_cookie(
    key='access_token',
    value=access_token,
    **settings.JWT_COOKIE_SETTINGS  # HttpOnly, Secure, etc.
)
```

```typescript
// Frontend: Axios with credentials
axiosInstance.defaults.withCredentials = true
```

### 2. Custom CookieJWTAuthentication Class

**Decision:** Extend DRF-JWT's authentication to read from cookies instead of headers

**Rationale:**
- Default DRF-JWT expects `Authorization: Bearer <token>` header
- We need to extract from `Cookie: access_token=<token>`
- Maintains compatibility with DRF's permission system

**Implementation:**
```python
class CookieJWTAuthentication(JWTAuthentication):
    def get_validated_token(self, raw_token):
        # Extract from cookie instead of header
        return super().get_validated_token(raw_token)
```

### 3. Three-Role User Model with Profile Extension

**Decision:** Single CustomUser table with OneToOne profile tables instead of separate user tables

**Rationale:**
- Django's auth system expects a single user model
- Role-specific data in separate tables keeps CustomUser clean
- Easy to add new roles without migrations

**Structure:**
```
CustomUser (common fields: email, username, password, role)
├── StudentProfile (empty for now, extensible)
├── InstructorProfile (title, about, students_count)
└── AdminProfile (empty for now)
```

**Role Detection:**
- Students: `is_staff=False, is_superuser=False`
- Instructors: `is_staff=True, is_superuser=False`
- Admins: `is_staff=True, is_superuser=True`

### 4. OTP-Based Email Verification

**Decision:** 6-digit numeric OTP codes instead of magic links

**Rationale:**
- Mobile-friendly (easier to type 6 digits than long URLs)
- Faster verification flow
- Can be reused across registration, password reset, and Google password setup

**Storage:**
- OTPs stored in database (not Redis) for simplicity
- Auto-expiry via `expires_at` field
- Marked as used to prevent replay

### 5. Token Blacklisting for Logout

**Decision:** Use django-rest-framework-simplejwt's token blacklist app

**Rationale:**
- Stateless JWTs can't be "revoked" normally
- Blacklisting stores token JTI (JWT ID) in database
- Checked on token refresh to prevent reuse

**Trade-off:** Adds database write on logout (vs pure stateless)

### 6. Google OAuth Integration via django-allauth

**Decision:** Use django-allauth for OAuth instead of custom implementation

**Rationale:**
- Handles OAuth flow complexity
- Well-tested library
- Extensible for other providers

**Customizations:**
- Override default views to return JSON instead of redirects
- Integrate with our JWT cookie system
- Add role selection for new registrations

---

## Data Flow Architecture

### Token Refresh Queue Pattern

Since we can't read token expiry from HttpOnly cookies, we use a refresh queue pattern:

```
Request 1: 401 detected
    └── Start refresh request
        ├── Set isRefreshing = true
        └── Block other requests

Request 2: 401 detected while refreshing
    └── Add to queue
        └── Wait for refresh completion
        └── Retry with new token

Request 3: 401 detected while refreshing
    └── Add to queue
        └── Wait for refresh completion
        └── Retry with new token

Refresh completes
    └── Process queue
        └── Retry all queued requests
```

**Implementation in axios interceptors:**
```typescript
let isRefreshing = false
let refreshSubscribers: any[] = []

// On 401, if not refreshing, start refresh
// If refreshing, add callback to subscribers
// On refresh complete, notify all subscribers
```

### Password Reset Cookie Pattern

For password reset flow, we need temporary state between OTP verification and password setting:

1. User requests reset (sends email)
2. User verifies OTP
3. Backend sets `password_reset_token` cookie (HttpOnly, short expiry)
4. User submits new password
5. Backend reads token from cookie to identify user
6. Token cleared on success

This avoids storing reset state in frontend and prevents CSRF attacks.

---

## Scalability Considerations

### Current Limitations

1. **OTP Storage in PostgreSQL**: Could use Redis for faster expiry handling
2. **Token Blacklisting in PostgreSQL**: High-volume logout could stress DB
3. **No Rate Limiting**: Vulnerable to brute force attacks
4. **Console Email Backend**: Not suitable for production

### Future Improvements

1. **Redis for OTP Storage**:
   - Natural TTL expiry
   - Faster reads/writes
   - Less database bloat

2. **Rate Limiting**:
   ```python
   @ratelimit(key='ip', rate='5/m', block=True)
   def post(self, request):
       # Login endpoint
   ```

3. **Refresh Token Rotation**:
   - New refresh token on each use
   - Detects token replay attacks

4. **Distributed Token Blacklisting**:
   - Redis-backed blacklist for better performance

---

## Security Measures

### Implemented

1. **Password Hashing**: PBKDF2 with SHA256 (Django default)
2. **JWT Algorithm**: HS256 with 256-bit secret
3. **Cookie Flags**: HttpOnly, Secure (production), SameSite=Lax
4. **CSRF Protection**: On all state-changing endpoints
5. **Token Expiry**: Short-lived access tokens (15 min), longer refresh (7 days)
6. **OTP Security**: 6 digits, expiry, single-use, auto-invalidation of old codes

### Recommendations

1. **Add Rate Limiting**:django-ratelimit or nginx-level
2. **Implement 2FA**: TOTP-based for sensitive accounts
3. **Password Complexity**: Require mixed case, numbers, symbols
4. **Account Lockout**: After N failed attempts
5. **Audit Logging**: Log all auth events (login, logout, password changes)

---

## Integration Points

### With Course Management
- Instructor role required to create courses
- Student role for enrollments
- Authentication required for all course mutations

### With Enrollment/Payments
- Authenticated users only can enroll
- User identity tied to orders
- JWT identifies user in webhook handlers

### With Progress Tracking
- Student profile required for progress records
- User identity for quiz attempts
- Authenticated API access for dashboard

---

## Testing Strategy

### Unit Tests
- OTP generation/validation logic
- Token creation/validation
- Password hashing

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
