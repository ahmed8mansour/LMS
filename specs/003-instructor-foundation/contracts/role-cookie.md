# Contract: `role` Routing Cookie

The interface between the backend auth layer and the frontend routing layer. This is the only new
"API surface" of the feature; no HTTP endpoints are added.

## Producer (backend)

**Where**: `backend/apps/authentication/utils.py`

`set_jwt_cookies(response, user)` — after setting `access_token` and `refresh_token`, additionally set:

```python
routing_role = (
    "admin" if user.is_superuser
    else "instructor" if user.role == "instructor"
    else "student"
)
response.set_cookie(
    key="role",
    value=routing_role,
    expires=datetime.now(timezone.utc) + refresh_token_lifetime,  # 7d, same as refresh
    httponly=False,          # MUST be readable by edge middleware + client
    samesite="Lax",
    secure=cookie_settings.get("secure", False),
    path="/",
)
```

`clear_jwt_cookies(response)` — also delete it:

```python
response.delete_cookie(key="role", path="/", samesite="Lax")
```

**Guarantees**:
- Set on every authenticated response (login, OTP verify, Google register/login, Google set-password,
  token refresh) because all route through `set_jwt_cookies`.
- Removed on logout.
- Value is always one of `admin` | `instructor` | `student`.
- Contains no secret, token, or PII.

## Consumers

### Edge middleware — `front-end/src/proxy.ts`
Reads `req.cookies.get("role")?.value`. Unknown/missing → treat as `student`. Auth presence
(`access_token`/`refresh_token`) is checked **before** role branching. See `routing-contract.md`.

### Client helper — `front-end/src/lib/cookies.ts`
```ts
export type RoutingRole = "student" | "instructor" | "admin";
export function readRoutingRole(): RoutingRole {
  const v = /* read document.cookie "role" */;
  return v === "instructor" || v === "admin" ? v : "student";
}
```
Used for the role-aware post-auth redirect (R3) and any in-shell role decision. Never used as an
authorization check — display/routing only.

## Security notes
- The JWT cookies remain **HttpOnly** and are untouched.
- This cookie is a **hint**, not a grant. Every instructor endpoint keeps its `isInstructor` permission,
  so a forged/edited `role` cookie changes only which shell renders, never data returned.
- Least-privilege default: any non-`instructor`/non-`admin` value resolves to the student experience.
