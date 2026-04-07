# Feature: Authentication System

## Overview

The Authentication System provides secure user identity management with multiple authentication methods, supporting three user roles: **student**, **instructor**, and **admin**. The system prioritizes security by using JWT tokens stored in HttpOnly cookies (not localStorage), protecting against XSS attacks.

---

## What This Feature Does

1. **User Registration**: Email/password signup with email verification via 6-digit OTP
2. **User Login**: Authenticate with email/password credentials
3. **Google OAuth**: Login and registration via Google accounts
4. **Password Recovery**: Forget password via email OTP flow
5. **Password Management**: Change password, set initial password for OAuth users
6. **Session Management**: JWT tokens with automatic refresh, secure logout with token blacklisting
7. **Role-Based Access Control**: Three distinct user types with different permissions

---

## Backend Endpoints

### Registration Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/user/register/sendOTP/` | POST | No | Initiate registration, send OTP to email |
| `/auth/user/register/verifyOTP/` | POST | No | Verify OTP, create account, set JWT cookies |
| `/auth/user/resendOTP/` | POST | No | Resend OTP for pending registration |

**Request/Response Examples:**

```bash
# Send OTP
POST /auth/user/register/sendOTP/
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepass123",
  "role": "student"  # or "instructor"
}

Response (201):
{
  "message": "Registration successful! Please check your email for OTP.",
  "user_data": { "username": "johndoe", "email": "john@example.com", ... },
  "next_step": "verify_otp",
  "otp_sent": true
}

# Verify OTP
POST /auth/user/register/verifyOTP/
{
  "email": "john@example.com",
  "otp_code": "123456"
}

Response (201):
{
  "message": "Account verified successfully",
  "user_data": { ... },
  "tokens": { "access": "...", "refresh": "..." }  # Also set as cookies
}
```

### Login Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/user/login/` | POST | No | Authenticate with credentials |
| `/auth/token/refresh/` | POST | No | Refresh access token (from cookie) |

**Request/Response Examples:**

```bash
POST /auth/user/login/
{
  "email": "john@example.com",
  "password": "securepass123"
}

Response (200):
{
  "message": "Login successful",
  "user_data": { ... }
}
# Sets: access_token, refresh_token cookies (HttpOnly)
```

### Google OAuth Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/google/user/register/` | POST | No | Register via Google OAuth |
| `/auth/google/user/login/` | POST | No | Login via Google OAuth |
| `/auth/google/user/setpassword/sendOTP/` | POST | Yes | Send OTP for password setup |
| `/auth/google/user/setpassword/verifyOTP/` | POST | Yes | Verify OTP for password setup |
| `/auth/google/user/setpassword/SetPassword/` | POST | Yes | Set password for OAuth user |

**Flow:**
1. Frontend exchanges Google auth code for tokens
2. If new user: register endpoint creates account
3. Google users have no password initially
4. Can set password later via OTP flow (enables email/password login)

### Password Recovery Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/user/forgetpassword/sendOTP/` | POST | No | Send reset OTP |
| `/auth/user/forgetpassword/verifyOTP/` | POST | No | Verify reset OTP |
| `/auth/user/forgetpassword/SetNewPassword/` | POST | No | Set new password (requires reset token cookie) |

**Flow:**
1. Send OTP to registered email
2. Verify OTP (sets reset_token cookie)
3. Submit new password (requires reset_token)
4. Auto-login with new credentials

### Password Management Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/user/changepassword/` | POST | Yes (JWT) | Change password (requires old password) |
| `/auth/user/setpassword/` | POST | Yes (JWT) | Set password for users without one |

### User Profile Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/user/profile/` | GET | Yes (JWT) | Get current user data |
| `/auth/user/update/` | PUT | Yes (JWT) | Update profile (partial allowed) |

### Logout Endpoint

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/user/logout/` | POST | Yes (JWT) | Blacklist token, clear cookies |

---

## Frontend Components

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| Login | `/login` | Email/password login form |
| Register | `/register` | Registration form with role selection |
| Verify OTP | `/verifyotp` | OTP verification for registration |
| Forget Password | `/forget-password` | Initiate password reset |
| Verify Reset OTP | `/forget-password/verify` | Verify reset OTP |
| Reset Password | `/forget-password/reset` | Set new password |

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LoginForm` | `features/auth/components/LoginForm.tsx` | Login form with validation |
| `RegisterForm` | `features/auth/components/RegisterForm.tsx` | Registration form |
| `RegisterOTPComponent` | `features/auth/components/RegisterOTPComponent.tsx` | OTP input for registration |
| `GoogleLoginButton` | `features/auth/components/GoogleLoginButton.tsx` | Google OAuth login |
| `GoogleRegisterButton` | `features/auth/components/GoogleRegisterButton.tsx` | Google OAuth registration |
| `UserAvatar` | `features/auth/components/UserAvatar.tsx` | User menu with logout |
| `SendOTPForm` | `features/auth/components/forget-password/SendOTPForm.tsx` | Forget password email form |
| `VerifyOTPForm` | `features/auth/components/forget-password/verifyOTPForm.tsx` | Reset OTP verification |
| `ResetPasswordForm` | `features/auth/components/forget-password/ResetPasswordForm.tsx` | New password form |

### Hooks

| Hook | Purpose |
|------|---------|
| `useLogin` | Login mutation with toast handling |
| `useRegister` | Registration with pending email state |
| `useRegisterVerifyOTP` | OTP verification with redirect |
| `useRegisterResendOTP` | Resend OTP functionality |
| `useLogout` | Logout with token blacklisting |
| `useProfile` | Fetch current user profile |
| `useGoogleLogin` | Google OAuth login |
| `useGoogleRegister` | Google OAuth registration |
| `useSendOTP` (forget-password) | Initiate password reset |
| `useVerifyOTP` (forget-password) | Verify reset OTP |
| `useResetPassword` | Complete password reset |

---

## Data Flow

### Registration Flow

```
User                          Frontend                        Backend
  |                              |                               |
  |-- Fill form (email/pass) --->|                               |
  |                              |-- POST /register/sendOTP ---->|
  |                              |                               |-- Generate OTP
  |                              |                               |-- Send email
  |                              |<-- Return: pending status -----|
  |<-- Show OTP screen ----------|                               |
  |-- Enter OTP ---------------->|                               |
  |                              |-- POST /register/verifyOTP --->|
  |                              |                               |-- Validate OTP
  |                              |                               |-- Create user
  |                              |                               |-- Set JWT cookies
  |                              |<-- Return: user data ----------|
  |<-- Redirect to dashboard -----|                               |
```

### Login Flow

```
User                          Frontend                        Backend
  |                              |                               |
  |-- Enter credentials -------->|                               |
  |                              |-- POST /login ---------------->|
  |                              |                               |-- Validate credentials
  |                              |                               |-- Set JWT cookies (HttpOnly)
  |                              |<-- Return: user data ----------|
  |<-- Redirect to dashboard ---|                               |
```

### Token Refresh Flow

```
Frontend                      Backend
  |                              |
  |-- Request with expired JWT ->|
  |                              |-- Return 401
  |<-- 401 ----------------------|
  |                              |
  |-- POST /token/refresh ------>|  (uses refresh_token cookie)
  |                              |-- Generate new access_token
  |<-- Set new cookie -----------|
  |                              |
  |-- Retry original request --->|
```

### Google OAuth Flow

```
User                          Google                          Frontend                        Backend
  |                              |                               |                               |
  |-- Click Google Sign In ----->|                               |                               |
  |                              |<-- OAuth consent --------------|                               |
  |                              |-- Return auth code ---------->|                               |
  |                              |                               |-- POST /google/login -------->|
  |                              |                               |                               |-- Exchange code for user info
  |                              |                               |                               |-- Find/create user
  |                              |                               |                               |-- Set JWT cookies
  |                              |                               |<-- Return user data -----------|
  |                              |                               |<-- Redirect to dashboard ------|
```

---

## Edge Cases Handled

### Security

1. **XSS Protection**: JWT stored in HttpOnly cookies (not localStorage), inaccessible to JavaScript
2. **CSRF Protection**: CSRF token validation on state-changing operations
3. **Token Blacklisting**: Refresh tokens blacklisted on logout (prevents replay attacks)
4. **Rate Limiting**: OTP resend limited (one active OTP per user/purpose)

### OTP Security

1. **6-digit numeric codes** only (no alphanumeric complexity)
2. **Auto-expiry**: OTPs expire after OTP_EXPIRY_MINUTES (configurable)
3. **Single use**: OTPs marked as used after validation
4. **Invalidation**: New OTP invalidates old ones for same user/purpose

### Password Requirements

1. **Minimum 8 characters** enforced via Zod validation
2. **Password confirmation** matching required
3. **Old password required** for password changes (not resets)
4. **Password hashing** via Django's PBKDF2

### Account States

1. **Inactive accounts**: Users with `is_active=false` (unverified email) cannot log in
2. **Pending verification**: Registration requires OTP verification
3. **OAuth users**: Can exist without password (must set one to use email login)

### Error Handling

1. **Invalid credentials**: Generic error (don't reveal if email exists)
2. **Expired OTP**: Clear message to request new OTP
3. **Used OTP**: Prevents replay attacks
4. **Invalid reset token**: Clears cookie, requires restart of flow

---

## Known Limitations / TODOs

1. **Email Delivery**: Currently uses console backend (prints to terminal). Production needs SMTP integration (SendGrid/AWS SES)

2. **Rate Limiting**: No request rate limiting on endpoints (vulnerable to brute force). Should add Django Ratelimit or similar

3. **Account Lockout**: No automatic lockout after failed login attempts

4. **Email Verification**: Only required at registration, not re-verification on email change

5. **Password Strength**: Only minimum length enforced, no complexity requirements

6. **Two-Factor Auth**: No 2FA/MFA support implemented

7. **Session Management**: No way to view/revoke active sessions from user side

---

## Permissions by Role

| Role | is_staff | is_superuser | Permissions |
|------|----------|--------------|-------------|
| Student | False | False | Browse courses, enroll, track progress |
| Instructor | True | False | CRUD own courses, sections, lectures, quizzes |
| Admin | True | True | Full CRUD on all resources |

---

## Dependencies

### Backend
- `djangorestframework-simplejwt` - JWT implementation
- `django-allauth` - Google OAuth integration
- `django-cors-headers` - CORS for cookie-based auth

### Frontend
- `@react-oauth/google` - Google OAuth client
- `react-hook-form` - Form management
- `zod` - Schema validation
- `@tanstack/react-query` - API state management
- `js-cookie` - Cookie reading (pending email)
- `sonner` - Toast notifications
