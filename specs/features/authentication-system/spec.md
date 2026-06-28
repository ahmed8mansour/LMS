# Feature: Authentication System

## Overview

The Authentication System provides secure user identity management with multiple authentication methods, supporting three user roles: **student**, **instructor**, and **admin**. The system uses JWT tokens stored in HttpOnly cookies to protect against XSS while still supporting secure refresh and logout.

---

## What This Feature Does

1. **User Registration**: Email/password signup with OTP verification
2. **User Login**: Authenticate with email/password credentials
3. **Google OAuth**: Login and registration via Google accounts
4. **Google Password Setup**: OTP-based password setup for Google users
5. **Password Recovery**: Forget password via OTP and reset-token cookie
6. **Password Management**: Change password and set password for OAuth users
7. **Session Management**: JWT access/refresh cookies, refresh endpoint, logout blacklist
8. **User Profile**: Fetch/update profile and get Cloudinary upload signature
9. **Role-Based Access Control**: Student, instructor, and admin roles

---

## Backend Endpoints

### Registration Endpoints

| Endpoint                         | Method | Auth Required | Description                                |
| -------------------------------- | ------ | ------------- | ------------------------------------------ |
| `/auth/user/register/sendOTP/`   | POST   | No            | Start registration and send OTP to email   |
| `/auth/user/register/verifyOTP/` | POST   | No            | Verify OTP, activate user, set JWT cookies |
| `/auth/user/resendOTP/`          | POST   | No            | Resend registration OTP                    |

**Request/Response Examples:**

```bash
# Send OTP
POST /auth/user/register/sendOTP/
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepass123",
  "role": "student"
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
  "message": "Email verified successfully! You can now login",
  "user_data": { ... }
}
```

### Login Endpoints

| Endpoint               | Method | Auth Required | Description                      |
| ---------------------- | ------ | ------------- | -------------------------------- |
| `/auth/user/login/`    | POST   | No            | Authenticate with credentials    |
| `/auth/token/refresh/` | POST   | No            | Refresh access token from cookie |

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

| Endpoint                                     | Method | Auth Required | Description                          |
| -------------------------------------------- | ------ | ------------- | ------------------------------------ |
| `/auth/google/user/register/`                | POST   | No            | Register via Google OAuth            |
| `/auth/google/user/login/`                   | POST   | No            | Login via Google OAuth               |
| `/auth/google/user/setpassword/sendOTP/`     | POST   | Yes           | Send OTP for Google password setup   |
| `/auth/google/user/setpassword/verifyOTP/`   | POST   | Yes           | Verify OTP for Google password setup |
| `/auth/google/user/setpassword/SetPassword/` | POST   | Yes           | Set password for OAuth user          |

**Flow:**

1. Frontend sends Google auth code to backend
2. Backend exchanges code for Google user info
3. Existing users can login; new users can register
4. Google accounts start without a usable password
5. Users can later set a password through OTP verification

### Password Recovery Endpoints

| Endpoint                                    | Method | Auth Required | Description                                   |
| ------------------------------------------- | ------ | ------------- | --------------------------------------------- |
| `/auth/user/forgetpassword/sendOTP/`        | POST   | No            | Send password reset OTP                       |
| `/auth/user/forgetpassword/verifyOTP/`      | POST   | No            | Verify reset OTP and issue reset-token cookie |
| `/auth/user/forgetpassword/SetNewPassword/` | POST   | No            | Set new password using reset-token cookie     |
| `/auth/user/forgetpassword/resendOTP/`      | POST   | No            | Resend forget-password OTP                    |

**Flow:**

1. Send OTP to registered email
2. Verify OTP and receive `password_reset_token` cookie
3. Submit new password using the cookie
4. Backend clears reset cookie and sets auth cookies

### Password Management Endpoints

| Endpoint                     | Method | Auth Required | Description                           |
| ---------------------------- | ------ | ------------- | ------------------------------------- |
| `/auth/user/changepassword/` | POST   | Yes (JWT)     | Change password with current password |
| `/auth/user/setpassword/`    | POST   | Yes (JWT)     | Set password for social login users   |

### User Profile Endpoints

| Endpoint                             | Method | Auth Required | Description                     |
| ------------------------------------ | ------ | ------------- | ------------------------------- |
| `/auth/user/profile/`                | GET    | Yes (JWT)     | Fetch current user profile      |
| `/auth/user/update/`                 | PUT    | Yes (JWT)     | Update user profile             |
| `/auth/user/getCloudinarySignature/` | GET    | Yes (JWT)     | Get Cloudinary upload signature |

### Logout Endpoint

| Endpoint             | Method | Auth Required | Description                               |
| -------------------- | ------ | ------------- | ----------------------------------------- |
| `/auth/user/logout/` | POST   | Yes (JWT)     | Blacklist refresh token and clear cookies |

---

## Frontend Components

### Pages

| Page                       | Route                         | Purpose                                 |
| -------------------------- | ----------------------------- | --------------------------------------- |
| Login                      | `/login`                      | Email/password login                    |
| Register                   | `/register`                   | Registration with role selection        |
| Verify OTP                 | `/verifyotp`                  | Registration OTP verification           |
| Forget Password            | `/forget-password`            | Request password reset OTP              |
| Verify Reset OTP           | `/forget-password/verify`     | Verify password reset OTP               |
| Reset Password             | `/forget-password/reset`      | Submit a new password                   |
| Google Set Password        | `/google-set-password`        | Send OTP for Google password setup      |
| Google Set Password Verify | `/google-set-password/verify` | Verify OTP for Google set-password flow |
| Google Set Password Reset  | `/google-set-password/reset`  | Set new password for Google users       |

### Components

| Component              | Location                                                              | Purpose                            |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `LoginForm`            | `featuers/auth/components/LoginForm.tsx`                              | Login form                         |
| `RegisterForm`         | `featuers/auth/components/RegisterForm.tsx`                           | Registration form                  |
| `RegisterOTPComponent` | `featuers/auth/components/RegisterOTPComponent.tsx`                   | Registration OTP entry             |
| `GoogleLoginButton`    | `featuers/auth/components/GoogleLoginButton.tsx`                      | Google login button                |
| `GoogleRegisterButton` | `featuers/auth/components/GoogleRegisterButton.tsx`                   | Google register button             |
| `UserAvater`           | `featuers/auth/components/UserAvater.tsx`                             | User avatar menu and logout        |
| `FPsendOTPForm`        | `featuers/auth/components/froget-password/SendOTPForm.tsx`            | Send OTP for reset or Google setup |
| `FPverifyOTPForm`      | `featuers/auth/components/froget-password/verifyOTPForm.tsx`          | OTP verification form              |
| `ResetPasswordForm`    | `featuers/auth/components/froget-password/ResetPasswordForm.tsx`      | Set new password                   |
| `UserChangePassword`   | `featuers/auth/components/dashboard/settings/UserChangePassword.tsx`  | Change password form               |
| `PasswordManager`      | `featuers/auth/components/dashboard/settings/UserPasswordManager.tsx` | Password management UI             |

### Hooks

| Hook                            | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `useLogin`                      | Login mutation                       |
| `useRegister`                   | Register mutation                    |
| `useRegisterVerifyOTP`          | Registration OTP verification        |
| `useRegisterResendOTP`          | Resend registration OTP              |
| `useLogout`                     | Logout mutation                      |
| `useProfile`                    | Fetch authenticated user profile     |
| `useGoogleLogin2`               | Google OAuth login                   |
| `useGoogleRegister`             | Google OAuth registration            |
| `useResetPassword`              | Password reset mutation              |
| `useGoogleSetPasswordSendOTP`   | Send OTP for Google password setup   |
| `useGoogleSetPasswordVerifyOTP` | Verify OTP for Google password setup |
| `useGoogleSetPasswordReset`     | Set new password for Google users    |

---

## Data Flow

### Registration Flow

```
User                          Frontend                        Backend
  |                              |                               |
  |-- Fill form (email/pass) --->|                               |
  |                              |-- POST /auth/user/register/sendOTP/ --->|
  |                              |                               |-- Create inactive user
  |                              |                               |-- Generate OTP
  |                              |                               |-- Send email
  |                              |<-- Return pending registration ---|
  |<-- Show OTP screen ----------|                               |
  |-- Enter OTP ---------------->|                               |
  |                              |-- POST /auth/user/register/verifyOTP/ ->|
  |                              |                               |-- Validate OTP
  |                              |                               |-- Activate user
  |                              |                               |-- Set JWT cookies
  |                              |<-- Return user data --------------|
  |<-- Redirect to dashboard -----|                               |
```

### Login Flow

```
User                          Frontend                        Backend
  |                              |                               |
  |-- Enter credentials -------->|                               |
  |                              |-- POST /auth/user/login/ ---------->|
  |                              |                               |-- Authenticate user
  |                              |                               |-- Set JWT cookies
  |                              |<-- Return user data --------------|
  |<-- Redirect to dashboard ---|                               |
```

### Token Refresh Flow

```
Frontend                      Backend
  |                              |
  |-- Request with expired JWT ->|
  |                              |-- Returns 401
  |<-- 401 ----------------------|
  |                              |
  |-- POST /auth/token/refresh/ ->|
  |                              |-- Read refresh_token cookie
  |                              |-- Set new access_token cookie
  |<-- Return success message ---|
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
  |                              |                               |-- POST /auth/google/user/login/ -->|
  |                              |                               |                               |-- Exchange code for user info
  |                              |                               |                               |-- Find or create user
  |                              |                               |                               |-- Set JWT cookies
  |                              |                               |<-- Return user data ------------|
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

5. **Two-Factor Auth**: No 2FA/MFA support implemented

6. **Session Management**: No way to view/revoke active sessions from user side

---

## Permissions by Role

| Role       | is_staff | is_superuser | Permissions                                   |
| ---------- | -------- | ------------ | --------------------------------------------- |
| Student    | False    | False        | Browse courses, enroll, track progress        |
| Instructor | True     | False        | CRUD own courses, sections, lectures, quizzes |
| Admin      | True     | True         | Full CRUD on all resources                    |

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
