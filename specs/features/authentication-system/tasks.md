# Authentication System - Tasks

## Status: COMPLETE

---

## Backend Tasks

### Models & Database

- [x] CustomUser model with email as `USERNAME_FIELD`
- [x] `StudentProfile` model (OneToOne to `CustomUser`)
- [x] `InstructorProfile` model with `title` / `about` / `students_count`
- [x] `AdminProfile` model
- [x] `EmailOTP` model for 6-digit codes with expiry and purpose
- [x] `PasswordResetToken` model with secure token generation
- [x] Database migrations for all models

### Authentication API

- [x] User registration endpoint (`sendOTP`)
- [x] User registration verification endpoint (`verifyOTP`)
- [x] User login endpoint with JWT cookie setting
- [x] Token refresh endpoint using refresh cookie
- [x] User logout with refresh token blacklisting
- [x] Resend registration OTP endpoint
- [x] Cloudinary signature endpoint for image upload

### OAuth Integration

- [x] Google OAuth register endpoint
- [x] Google OAuth login endpoint
- [x] Google user setup-password flow (send/verify OTP + set password)
- [x] OAuth code exchange for Google user info

### Password Management

- [x] Forget password send OTP
- [x] Forget password verify OTP
- [x] Forget password set new password
- [x] Change password (authenticated, requires current password)
- [x] Set password for OAuth users without a usable password
- [x] Password reset token cookie handling

### User Profile

- [x] Get user profile endpoint
- [x] Update user profile endpoint (partial update supported)

### Security & Utilities

- [x] `CookieJWTAuthentication` custom class
- [x] JWT cookie settings (HttpOnly, Secure flags)
- [x] Token generation utilities
- [x] OTP generation (6-digit numeric)
- [x] Email sending utilities (console backend)

---

## Frontend Tasks

### Pages & Routes

- [x] Login page (`/login`)
- [x] Register page (`/register`)
- [x] OTP verification page (`/verifyotp`)
- [x] Forget password page (`/forget-password`)
- [x] Forget password verify OTP page (`/forget-password/verify`)
- [x] Forget password reset page (`/forget-password/reset`)
- [x] Google set password page (`/google-set-password`)
- [x] Google set password verify page (`/google-set-password/verify`)
- [x] Google set password reset page (`/google-set-password/reset`)

### Components

- [x] `LoginForm` component with validation
- [x] `RegisterForm` component with role selection
- [x] `RegisterOTPComponent` for registration OTP entry
- [x] `GoogleLoginButton` component
- [x] `GoogleRegisterButton` component
- [x] `UserAvater` component with logout menu
- [x] `FPsendOTPForm` component for password / Google set password OTP send
- [x] `FPverifyOTPForm` component for OTP verification
- [x] `ResetPasswordForm` component for password reset and Google set password reset
- [x] `UserChangePassword` component for change password
- [x] `PasswordManager` component for dashboard password UI

### Hooks (React Query)

- [x] `useLogin` hook
- [x] `useRegister` hook
- [x] `useRegisterVerifyOTP` hook
- [x] `useRegisterResendOTP` hook
- [x] `useLogout` hook
- [x] `useProfile` hook
- [x] `useGoogleLogin2` hook
- [x] `useGoogleRegister` hook
- [x] `useResetPassword` hook
- [x] `useGoogleSetPasswordSendOTP` hook
- [x] `useGoogleSetPasswordVerifyOTP` hook
- [x] `useGoogleSetPasswordReset` hook

### State Management

- [x] Auth Zustand store (pending email state, redirect state)
- [x] Cookie handling for reset token state

### Validation & Types

- [x] Zod schema for registration
- [x] Zod schema for login
- [x] Zod schema for OTP validation
- [x] Zod schema for forget password flows
- [x] TypeScript types for auth requests and responses

### API Layer

- [x] `auth.api.ts` with all auth endpoints
- [x] Axios interceptors for cookie-based requests
- [x] Error handling utilities for auth flows
- [x] Toast notifications for success/error

### UI/UX

- [x] Form validation error display
- [x] Loading states for submissions
- [x] Redirect after login/registration
- [x] Conditional navigation for auth flows
- [x] Protected route detection via `proxy.ts`

---

## Integration Tasks

- [x] Frontend-backend API integration
- [x] JWT cookie handling (`withCredentials: true`)
- [x] Token refresh implementation
- [x] OAuth flow integration
- [x] Form submission error handling

---

## Testing Considerations

- [ ] Unit tests for OTP generation/validation
- [ ] Unit tests for token generation
- [ ] API tests for auth endpoints
- [ ] Frontend component tests
- [ ] E2E tests for registration flow
- [ ] E2E tests for login flow
- [ ] E2E tests for password reset flow

---

## Documentation

- [x] API endpoint documentation
- [x] Component usage documentation
- [x] Hook usage documentation

---

## Known Issues / Limitations

### Incomplete Items

- [ ] Email SMTP integration (currently console backend only)
- [ ] Rate limiting on endpoints
- [ ] Account lockout after failed attempts
- [ ] Password complexity validation beyond minimum length

### Technical Debt

- [ ] Some console.log statements remain in backend code
- [ ] Error messages are not fully standardized
- [ ] `any` remains in a few frontend error handlers
