# Phase 1 Data Model: Instructor Foundation

This feature introduces **no database models and no migrations**. It relies on existing user fields and
adds one client-readable cookie. This document records the data shapes the routing layer depends on.

## Relied-upon existing entities (no changes)

### CustomUser (`backend/apps/authentication`)
Fields consumed by the routing-role computation:

| Field | Type | Role in this feature |
|-------|------|----------------------|
| `role` | enum `student` \| `instructor` \| `admin` | Distinguishes instructor from student for the routing cookie |
| `is_superuser` | boolean | Identifies **admin** for routing (checked first, per clarification) |
| `is_staff` | boolean | The existing backend `isInstructor` gate — unchanged, remains the security boundary |

> Note: `UserDataSerializer` **excludes** `is_staff`/`is_superuser`, so the client cannot derive
> admin-ness from the profile response. The `role` cookie is the correct carrier of the routing role.

### InstructorProfile (`backend/apps/authentication`)
Its existence marks a user as an authoring instructor. Used only for the graceful "staff without
instructor profile" handling (FR-008); no fields are read or written here.

## New data artifact: the `role` routing cookie

A conceptual (non-DB) entity — the non-sensitive role hint the edge/UI reads.

| Attribute | Value |
|-----------|-------|
| Cookie name | `role` |
| Value domain | `"admin"` \| `"instructor"` \| `"student"` |
| Derivation (server) | `admin` if `is_superuser`; else `instructor` if `role == "instructor"`; else `student` |
| HttpOnly | **false** (must be readable by edge middleware and client) |
| Secret? | **No** — carries only a role label; grants no access on its own |
| SameSite | `Lax` |
| Secure | Matches `JWT_COOKIE_SETTINGS` (True in production) |
| Path | `/` |
| Lifetime | Aligned to the refresh token (7 days); re-set on token refresh |
| Set at | `set_jwt_cookies()` (all authenticated entry points) |
| Cleared at | `clear_jwt_cookies()` (logout) |

### Lifecycle / state transitions
```
[unauthenticated]  --login / verify-otp / google-auth-->  role cookie SET (value = routing role)
[access token expires] --token refresh--> role cookie RE-SET (kept alive)
[authenticated]    --logout-->                            role cookie DELETED
[role changes server-side] --next auth/refresh-->         role cookie reflects new routing role
```

### Validation / invariants
- The value MUST be one of the three literals; the edge treats any missing/unknown value as
  **student** (least-privilege default) while the backend still governs data access.
- The cookie MUST never contain tokens, ids, emails, or any PII — role label only.
- Presence of the `role` cookie is **not** proof of authentication; the guard still requires an
  `access_token`/`refresh_token` for protected routes (auth check precedes role branching).

## Frontend types (no persistence)

```ts
// conceptual — see contracts/role-cookie.md
type RoutingRole = "student" | "instructor" | "admin";
```
