# Google Login/Register Implementation Guide

## Overview

This implementation adds Google OAuth authentication for both login and register flows using a shared backend endpoint. The architecture follows your existing patterns with custom hooks, mutation-based API calls, and proper error handling with toast notifications.

## What Was Created

### 1. **Google Auth Button Component**

**File:** `src/featuers/auth/components/GoogleAuthButton.tsx`

A reusable component that handles the complete Google authentication flow:

- Uses `useGoogleLogin` from `@react-oauth/google`
- Integrates with the custom `useGoogleAuth` mutation hook
- Displays loading state while authenticating
- Accepts `role` prop (student/instructor) and `isLoginFlow` flag
- Handles both login and register scenarios seamlessly

```tsx
// Usage in login page
<GoogleAuthButton role="student" isLoginFlow={true} />

// Usage in register page
<GoogleAuthButton role="instructor" isLoginFlow={false} />
```

### 2. **Google Auth API Function**

**File:** `src/featuers/auth/api/auth.api.ts`

Added `googleAuth` function that:

- Sends the Google auth code and role to backend
- Endpoint: `POST /auth/google/user/login/`
- Works for both login and register (shared endpoint)
- Type-safe with `GoogleAuthRequest` and `GoogleAuthResponse` types

```typescript
async function googleAuth(
  requestBody: GoogleAuthRequest,
): Promise<GoogleAuthResponse> {
  const { data } = await axios.post("/auth/google/user/login/", requestBody);
  return data;
}
```

### 3. **Custom useGoogleAuth Mutation Hook**

**File:** `src/featuers/auth/hooks/useGoogleAuth.tsx`

A custom mutation hook that:

- Uses `@tanstack/react-query` for mutation management
- Handles success/error states with toast notifications
- Automatically saves tokens to localStorage
- Redirects to `/dashboard` after successful authentication
- Supports both login and register flows with different messages
- Type-safe error handling

**Features:**

- ✅ Success toast with context-aware message
- ✅ Automatic token storage (access_token, refresh_token)
- ✅ Automatic redirection after 1 second delay
- ✅ Error handling with detailed error messages
- ✅ Server connection error detection

### 4. **Updated Types**

**File:** `src/featuers/auth/types/auth.types.ts`

Added new interfaces:

```typescript
export interface GoogleAuthRequest {
  code: string;
  role: "student" | "instructor";
}

export interface GoogleAuthResponse {
  message: string;
  user_data: UserData;
  tokens: Tokens;
}
```

### 5. **Updated Pages**

- **Register Page:** `src/app/(auth)/(main)/register/page.tsx`
- **Login Page:** `src/app/(auth)/(main)/login/page.tsx`

Both pages now:

- Use the new `GoogleAuthButton` component
- Wrap with `GoogleOAuthProvider`
- Pass appropriate role and flow flags
- Maintain clean, reusable structure

### 6. **Exports**

**File:** `src/featuers/auth/index.ts`

Updated to export:

```typescript
export { GoogleAuthButton } from "./components/GoogleAuthButton";
export { useGoogleAuth } from "./hooks/useGoogleAuth";
```

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
NEXT_PUBLIC_GOOGLE_REDIRECT_URI=http://localhost:3000

# Backend API
NEXT_PUBLIC_DEVELOPMENT_BACKEND_URL=http://localhost:8000
```

## Backend Endpoint Expected Response

The backend should return:

```json
{
  "message": "Login successful",
  "user_data": {
    "id": 1,
    "email": "user@example.com",
    "username": "username",
    "first_name": "First",
    "last_name": "Last",
    "role": "student|instructor",
    "is_active": true,
    "is_email_verified": true,
    "date_joined": "2024-01-01T00:00:00Z",
    "can_change_password": true,
    "profile": {}
  },
  "tokens": {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

## Architecture Benefits

✅ **Reusable Component:** `GoogleAuthButton` works for both login and register
✅ **Shared Endpoint:** Single backend endpoint handles both flows
✅ **Type Safety:** Full TypeScript support throughout
✅ **Error Handling:** Comprehensive error handling with user feedback
✅ **Token Management:** Automatic token storage and redirection
✅ **Query Integration:** Uses `@tanstack/react-query` for state management
✅ **User Experience:** Toast notifications and loading states
✅ **Flexible:** Easy to extend with GitHub or other OAuth providers

## Usage Flow

1. **User clicks Google button** → `GoogleAuthButton` component
2. **Google login opens** → `useGoogleLogin` hook
3. **On success** → `authenticateWithGoogle` mutation called
4. **API call** → `authAPI.googleAuth()` to backend
5. **On success** → Tokens saved, success toast shown
6. **Redirect** → User sent to `/dashboard` after 1 second
7. **On error** → Error toast shown with details

## Next Steps

1. Set up Google OAuth credentials in Google Cloud Console
2. Add environment variables to `.env.local`
3. Ensure backend endpoint `/auth/google/user/login/` is ready
4. Test the flows on both login and register pages
5. Consider adding GitHub OAuth using the same pattern

## Testing Checklist

- [ ] Google button appears on both login and register pages
- [ ] Clicking opens Google login dialog
- [ ] Successful login redirects to /dashboard
- [ ] Successful register redirects to /dashboard
- [ ] Tokens are saved to localStorage
- [ ] Error messages display correctly on failure
- [ ] Loading state shows while authenticating
- [ ] Works on both student and instructor roles
