# Authentication System - Data Model

This document describes all database entities owned by or closely related to the Authentication System feature.

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION SYSTEM                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   CustomUser     │────────────────────────────────────────────────────────────┐
├──────────────────┤                                                            │
│ id (PK)          │                                                            │
│ password         │                                                            │
│ last_login       │                                                            │
│ profile_picture  │                                                            │
│ username (UQ)    │                                                            │
│ first_name       │                                                            │
│ last_name        │                                                            │
│ email (UQ)       │                                                            │
│ role (choices)   │                                                            │
│ is_active        │                                                            │
│ is_staff         │                                                            │
│ is_superuser     │                                                            │
│ is_email_verified│                                                            │
│ date_joined      │                                                            │
└────────┬─────────┘                                                            │
         │                                                                       │
         │ OneToOne                                                              │
         │                                                                       │
    ┌────┴────┐  ┌──────────────┐  ┌──────────────┐                             │
    │Student  │  │Instructor    │  │Admin         │                             │
    │Profile  │  │Profile       │  │Profile       │                             │
    ├─────────┤  ├──────────────┤  ├──────────────┤                             │
    │id (PK)  │  │id (PK)       │  │id (PK)       │                             │
    │user (FK)│  │user (FK)     │  │user (FK)     │                             │
    └─────────┘  │title         │  └──────────────┘                             │
                 │about         │                                               │
                 │students_count│                                               │
                 └──────────────┘                                               │
                                                                                │
         │                                                                       │
         │ ForeignKey (reverse)                                                  │
         │                                                                       │
    ┌────┴────────────────────┐  ┌────────────────────────────┐                  │
    │      EmailOTP           │  │  PasswordResetToken        │                  │
    ├─────────────────────────┤  ├────────────────────────────┤                  │
    │ id (PK)                 │  │ id (PK)                    │                  │
    │ user (FK) ──────────────┼──┼─ user (FK)                 │                  │
    │ code (6 chars)          │  │ token (64 chars, UQ)       │                  │
    │ purpose (choices)       │  │ created_at                 │                  │
    │ is_used                 │  │ expires_at                 │                  │
    │ created_at              │  │ is_used                    │                  │
    │ expires_at              │  │ used_at                    │                  │
    └─────────────────────────┘  └────────────────────────────┘                  │
                                                                                │
         │                                                                       │
         │ Used By Other Features                                                │
         │                                                                       │
    ┌────┴──────────────────────────────────────────────────────────────────────┘
    │
    │ ForeignKey (reverse)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  ENROLLMENT FEATURE                                         │
│  ├── Order (user FK)                                        │
│  ├── Transaction                                            │
│  └── Enrollment (user FK)                                   │
│                                                             │
│  COURSE FEATURE (via InstructorProfile)                    │
│  └── Course (instructor FK)                                 │
│                                                             │
│  PROGRESS TRACKING FEATURE                                  │
│  ├── LectureProgress (via StudentProfile)                  │
│  ├── QuizAttempt (via StudentProfile)                      │
│  └── QuizAttemptAnswer                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Entities Owned by Authentication System

### 1. CustomUser

Central user entity for the entire platform. Uses email as the unique identifier (USERNAME_FIELD).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Auto-generated primary key |
| password | CharField | max_length=128 | Django auth password hash (PBKDF2) |
| last_login | DateTime | nullable | Last successful login timestamp |
| profile_picture | ImageField | upload_to='LMS/PFP/' | Avatar stored on Cloudinary |
| username | CharField | unique, max_length=255 | Display name, must be unique |
| first_name | CharField | max_length=255, blank | User's first name |
| last_name | CharField | max_length=255, blank | User's last name |
| email | EmailField | unique | Login identifier, must be verified |
| role | CharField | choices: student/instructor/admin | User's platform role |
| is_active | BooleanField | default=False | Account active (verified email) |
| is_staff | BooleanField | default=False | Can access admin interface |
| is_superuser | BooleanField | default=False | Full system access |
| is_email_verified | BooleanField | default=False | Email verification status |
| date_joined | DateTimeField | auto_now_add | Registration timestamp |

**Constraints:**
- Email must be unique
- Username must be unique
- Role must be one of: 'student', 'instructor', 'admin'

**Indexes:**
- `email`: Unique index for login lookups
- `username`: Unique index for display name uniqueness

**Relationships:**
- OneToOne → StudentProfile (reverse: `student_profile`)
- OneToOne → InstructorProfile (reverse: `instructor_profile`)
- OneToOne → AdminProfile (reverse: `admin_profile`)
- ForeignKey (reverse) → EmailOTP (`otp_codes`)
- ForeignKey (reverse) → PasswordResetToken (`password_reset_tokens`)
- ForeignKey (reverse) → Order, Enrollment, etc. (used by other features)

---

### 2. StudentProfile

Extended data for student users. Currently minimal but extensible for future student-specific features.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | OneToOne | FK → CustomUser | Linked user account |

**Relationships:**
- OneToOne ← CustomUser
- ForeignKey (reverse) → LectureProgress (used by Progress Tracking)
- ForeignKey (reverse) → QuizAttempt (used by Progress Tracking)

---

### 3. InstructorProfile

Extended data for instructor users with professional details.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | OneToOne | FK → CustomUser | Linked user account |
| title | CharField | max_length=255, blank | Professional title (e.g., "Senior Developer") |
| about | TextField | blank | Bio/description |
| students_count | IntegerField | default=0 | Cached count of enrolled students |

**Relationships:**
- OneToOne ← CustomUser
- ForeignKey (reverse) → Course (used by Course Management)

---

### 4. AdminProfile

Extended data for admin users. Currently minimal placeholder.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | OneToOne | FK → CustomUser | Linked user account |

**Relationships:**
- OneToOne ← CustomUser

---

### 5. EmailOTP

One-time password codes for email verification flows.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | ForeignKey | FK → CustomUser | Recipient user |
| code | CharField | max_length=6 | 6-digit numeric code |
| purpose | CharField | choices: registration/password_reset/forget_password/google_set_password | Flow context |
| is_used | BooleanField | default=False | Usage status |
| created_at | DateTimeField | auto_now_add | Creation timestamp |
| expires_at | DateTimeField | | Expiration timestamp |

**Constraints:**
- Code is 6 digits only (0-9)
- Expires after OTP_EXPIRY_MINUTES (settings)
- Multiple active OTPs for same user/purpose auto-invalidated

**Indexes:**
- `user` + `purpose` + `is_used`: For finding active codes
- `created_at`: For cleanup queries

**Business Logic:**
- Auto-generates 6-digit code if not provided
- Auto-sets expiry based on settings
- Creating new OTP invalidates old ones for same user+purpose

---

### 6. PasswordResetToken

Secure tokens for password reset flow.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | AutoField | PK | Primary key |
| user | ForeignKey | FK → CustomUser | User requesting reset |
| token | CharField | unique, max_length=64, db_index | Secure random token |
| created_at | DateTimeField | auto_now_add | Creation timestamp |
| expires_at | DateTimeField | | Expiration timestamp |
| is_used | BooleanField | default=False | Usage status |
| used_at | DateTimeField | nullable | When token was used |

**Constraints:**
- Token must be unique
- Token indexed for fast lookup
- Expires after PASSWORD_RESET_TOKEN_EXPIRY_MINUTES

**Indexes:**
- `token`: Unique index for token validation
- `user` + `is_used`: For finding active tokens
- `created_at`: For cleanup queries

**Business Logic:**
- Auto-generates secure token via `secrets.token_urlsafe(32)`
- Auto-sets expiry based on settings
- Creating new token invalidates old ones for same user
- Used tokens stored for audit trail

---

## Role-Based Access Control (RBAC)

### Role Determination

| Role | is_staff | is_superuser | How to Check |
|------|----------|--------------|--------------|
| Student | False | False | `not user.is_staff` |
| Instructor | True | False | `user.is_staff and not user.is_superuser` |
| Admin | True | True | `user.is_superuser` |

### Custom Permissions

```python
# isAdmin permission
class isAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser

# isInstructor permission
class isInstructor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_staff
```

---

## Token Blacklist (DRF-SimpleJWT)

While not custom models, the authentication system uses DRF-SimpleJWT's blacklist app which creates:

### OutstandingToken
- Stores all issued refresh tokens
- Links to user
- Contains JTI (JWT ID), token, created_at, expires_at

### BlacklistedToken
- Stores blacklisted tokens
- ForeignKey to OutstandingToken
- Blacklisted at timestamp

**Note:** These tables are managed by `rest_framework_simplejwt.token_blacklist` app.

---

## Relationships to Other Features

### Used By Enrollment Feature
- CustomUser → Order (purchases)
- CustomUser → Enrollment (enrolled courses)

### Used By Course Management Feature
- InstructorProfile → Course (created courses)
- CustomUser → Section/Lecture/Quiz (via instructor permissions)

### Used By Progress Tracking Feature
- StudentProfile → LectureProgress
- StudentProfile → QuizAttempt

---

## Database Indexes Summary

| Entity | Field(s) | Type | Purpose |
|--------|----------|------|---------|
| CustomUser | email | Unique | Login lookups |
| CustomUser | username | Unique | Display name uniqueness |
| EmailOTP | user, purpose, is_used | Composite | Find active codes |
| EmailOTP | created_at | B-tree | Cleanup old codes |
| PasswordResetToken | token | Unique | Token validation |
| PasswordResetToken | user, is_used | Composite | Find active tokens |
| PasswordResetToken | created_at | B-tree | Cleanup old tokens |

---

## Data Retention

### Recommended Cleanup Tasks

**EmailOTP Cleanup:**
```sql
-- Delete OTPs older than 7 days
DELETE FROM authentication_emailotp 
WHERE created_at < NOW() - INTERVAL '7 days';
```

**PasswordResetToken Cleanup:**
```sql
-- Delete tokens older than 7 days
DELETE FROM authentication_passwordresettoken 
WHERE created_at < NOW() - INTERVAL '7 days';
```

**OutstandingToken Cleanup:**
```sql
-- Delete expired tokens (handled by DRF-SimpleJWT)
-- Run: python manage.py flushexpiredtokens
```

---

## TypeScript Interfaces

```typescript
// CustomUser
interface CustomUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'instructor' | 'admin';
  profile_picture: string;
  is_active: boolean;
  is_email_verified: boolean;
  date_joined: string;
}

// User Data Response (from API)
interface UserData extends CustomUser {
  specific_data: {
    title?: string;
    about?: string;
  };
}

// Auth State (Zustand)
interface AuthState {
  pending_email: string | null;
  can_verify_otp: boolean;
  setPendingEmail: (email: string | null) => void;
  setCanVerifyOTP: (value: boolean) => void;
}
```

---

## Validation Rules

### CustomUser Validation
- Email must be valid email format
- Username minimum 3 characters
- Password minimum 8 characters (via Zod)
- Role must be 'student', 'instructor', or 'admin'

### EmailOTP Validation
- Code must be exactly 6 digits
- Code must not be expired
- Code must not be already used
- Only one active code per user+purpose

### PasswordResetToken Validation
- Token must exist and not be expired
- Token must not be already used
- Only one active token per user
