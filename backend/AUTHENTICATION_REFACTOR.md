# JWT Authentication Refactor: HttpOnly Cookies

## Overview

The authentication system has been refactored to use **HttpOnly cookies** for storing JWT tokens instead of returning them in the response body. This approach provides enhanced security by protecting tokens from XSS (Cross-Site Scripting) attacks.

## Key Changes

### 1. **Tokens Now Stored in HttpOnly Cookies**

**Before:**
```json
{
  "message": "login successful",
  "user_data": {...},
  "tokens": {
    "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
  }
}
```

**After:**
```json
{
  "message": "login successful",
  "user_data": {...}
}
```

Tokens are now stored in HttpOnly cookies:
- `access_token` - HttpOnly cookie (15 minutes lifetime)
- `refresh_token` - HttpOnly cookie (7 days lifetime)

### 2. **Browser Automatically Sends Cookies**

The browser automatically includes HttpOnly cookies in every request. No manual token management needed in the frontend.

### 3. **Custom Authentication Class**

A new `CookieJWTAuthentication` class has been created that supports both:
- **HttpOnly cookies** (primary method)
- **Authorization header** (fallback for backward compatibility and mobile apps)

Priority: `Authorization: Bearer <token>` header > HttpOnly cookies

## Authentication Endpoints

### Login
**Endpoint:** `POST /api/auth/user/login/`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user_data": {
    "id": 1,
    "email": "user@example.com",
    "username": "user",
    "first_name": "John",
    "last_name": "Doe",
    "role": "student",
    ...
  }
}
```

**Cookies Set:**
- `access_token` (HttpOnly)
- `refresh_token` (HttpOnly)

---

### Register - Send OTP
**Endpoint:** `POST /api/auth/user/register/sendOTP/`

**Request:**
```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "password123",
  "role": "student"
}
```

---

### Register - Verify OTP
**Endpoint:** `POST /api/auth/user/register/verifyOTP/`

**Request:**
```json
{
  "email": "newuser@example.com",
  "otp_code": "123456"
}
```

**Response:** Tokens are automatically set in HttpOnly cookies

---

### Logout
**Endpoint:** `POST /api/auth/user/logout/`

**Headers:**
```
Authorization: Bearer <access_token>
OR
Cookies: access_token=...; refresh_token=...
```

**Response:**
```json
{
  "success_message": "You have logged out successfully"
}
```

**Effect:** Cookies are cleared (deleted) from the browser

---

### Token Refresh
**Endpoint:** `POST /api/auth/token/refresh/`

**How it works:**
1. Browser automatically sends `refresh_token` cookie
2. Server validates and generates new `access_token`
3. New `access_token` is set in HttpOnly cookie

**Response:**
```json
{
  "message": "Token refreshed successfully"
}
```

---

### Protected Endpoints

All protected endpoints automatically read tokens from:
1. HttpOnly cookies (`access_token`)
2. Authorization header (fallback)

**Example - Get User Profile:**
```bash
GET /api/auth/user/profile/
Authorization: Bearer <access_token>
OR with cookies (automatic)
```

---

## Security Features

### 1. **XXSProtection**
- Tokens are HttpOnly → JavaScript cannot access them
- Prevents XSS attacks from stealing tokens

### 2. **CSRF Protection**
- Cookies use `SameSite=Lax` flag
- Automatic CSRF protection for state-changing requests

### 3. **Secure Flag**
- Cookies sent over HTTPS only (in production when `DEBUG=False`)

### 4. **Token Blacklisting**
- Refresh tokens can be blacklisted on logout
- Invalid tokens are automatically rejected

---

## Frontend Implementation

### Making Requests (No Manual Token Management)

**With Cookies (Recommended):**
```javascript
// Automatic cookie sending with credentials
fetch('http://localhost:8000/api/auth/user/profile/', {
  method: 'GET',
  credentials: 'include',  // IMPORTANT: Include cookies
  headers: {
    'Content-Type': 'application/json',
  }
})
```

**Angular HttpClient:**
```typescript
this.http.get('/api/auth/user/profile/', {
  withCredentials: true  // Include cookies
}).subscribe(...)
```

**React/Axios:**
```javascript
axios.defaults.withCredentials = true;
axios.get('http://localhost:8000/api/auth/user/profile/')
```

### Login Flow

```javascript
// 1. Login
const loginResponse = await fetch('/api/auth/user/login/', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const data = await loginResponse.json();
console.log(data.user_data); // User info
// Cookies automatically set by browser!

// 2. Make protected requests - cookies sent automatically
const profileResponse = await fetch('/api/auth/user/profile/', {
  method: 'GET',
  credentials: 'include'
});

// 3. Logout - cookies are cleared
await fetch('/api/auth/user/logout/', {
  method: 'POST',
  credentials: 'include'
});
```

---

## Backend Implementation Details

### Cookie Setting Utility

**File:** [apps/authentication/utils.py](apps/authentication/utils.py)

```python
def set_jwt_cookies(response, user):
    """Set access and refresh tokens as HttpOnly cookies"""
    refresh = RefreshToken.for_user(user)
    # ... sets cookies with:
    # - httponly=True (JS can't access)
    # - secure=True (HTTPS only in production)
    # - samesite='Lax' (CSRF protection)
```

### Custom Authentication Class

**File:** [apps/authentication/utils.py](apps/authentication/utils.py)

```python
class CookieJWTAuthentication(JWTAuthentication):
    """
    Supports both HttpOnly cookies and Authorization headers
    Priority: Bearer token > Cookies
    """
```

### Modified Views

Updated views to set cookies:
- **UserLoginView** - Sets cookies on successful login
- **UserRegisterVerifyOTPView** - Sets cookies on email verification
- **GoogleLoginAPIView** - Sets cookies on Google OAuth login
- **UserForgetPasswordSetnewoneView** - Sets cookies on password reset
- **GoogleSetPasswordNewPasswordView** - Sets cookies after setting password
- **TokenRefreshCookieView** - Custom refresh endpoint using cookies
- **UserLogoutView** - Clears cookies on logout

---

## Configuration

### settings.py

```python
# CORS must allow credentials for cookies to work
CORS_ALLOW_CREDENTIALS = True

# Cookie settings
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = DEBUG is False  # HTTPS in production
CSRF_COOKIE_SECURE = DEBUG is False

# JWT configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'TOKEN_BLACKLIST_ENABLED': True,
    ...
}

# Use custom cookie-based authentication
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.authentication.utils.CookieJWTAuthentication',
    ),
}
```

---

## Production Checklist

- [ ] Set `DEBUG = False`
- [ ] Update `CORS_ALLOWED_ORIGINS` with specific frontend domains (remove `CORS_ALLOW_ALL_ORIGINS`)
- [ ] Ensure HTTPS is enabled
- [ ] Set strong `SECRET_KEY`
- [ ] Enable `SECURE_SSL_REDIRECT`
- [ ] Set `SECURE_HSTS_SECONDS`
- [ ] Update cookie expiration times as needed

### Production CORS Example:
```python
CORS_ALLOWED_ORIGINS = [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "https://app.yourdomain.com",
]
CORS_ALLOW_ALL_ORIGINS = False
```

---

## Migration Notes

### If You Have Existing Frontend Code

**Old Way (no longer needed):**
```javascript
const { access, refresh } = data.tokens;
localStorage.setItem('accessToken', access);
localStorage.setItem('refreshToken', refresh);
// Manual token management...
```

**New Way (automatic with CookieJWTAuthentication):**
```javascript
// Tokens are managed automatically!
// Just use credentials: 'include' in fetch requests
```

### Backward Compatibility

The system still supports Authorization header tokens:
```bash
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

This allows:
- Mobile apps to still use tokens
- Development/testing with APIs
- Gradual frontend migration

---

## Troubleshooting

### Cookies Not Being Set

1. Check `CORS_ALLOW_CREDENTIALS = True` in settings.py
2. Ensure frontend uses `credentials: 'include'` in fetch
3. Check browser console for CORS errors
4. Verify `SameSite` cookie attribute

### 401 Unauthorized Errors

1. Ensure cookies are being sent: Use `credentials: 'include'` in fetch
2. Check if cookies exist in browser dev tools
3. Verify CORS_ALLOWED_ORIGINS includes your frontend domain
4. Check if refresh token is expired (7 days)

### CSRF Token Issues

1. Add `X-CSRFToken` header if needed (already handled)
2. Use `SameSite=Lax` cookie attribute (already configured)
3. Verify CORS middleware order

---

## API Response Changes Summary

| Endpoint | Before | After |
|----------|--------|-------|
| `/login/` | Returns `tokens` in body | Returns user_data only, sets cookies |
| `/register/verifyOTP/` | Returns `tokens` in body | Returns user_data only, sets cookies |
| `/forgetpassword/SetNewPassword/` | Returns `tokens` in body | Returns user_data only, sets cookies |
| `/google/user/login/` | Returns `tokens` in body | Returns user_data only, sets cookies |
| `/token/refresh/` | Takes token in body | Reads from cookies, returns success |
| `/logout/` | Requires token in body | Clears cookies, no body token needed |

---

## References

- [OWASP: XSS Prevention](https://owasp.org/www-community/attacks/xss/)
- [django-rest-framework-simplejwt](https://django-rest-framework-simplejwt.readthedocs.io/)
- [SameSite Cookie Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [HTTPOnly Cookie](https://owasp.org/www-community/HttpOnly)
