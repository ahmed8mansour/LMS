# Contract: Instructor Earnings (spec 013)

One endpoint. It takes no identifier from the client — the only input is the period — so there is no id to
scope, guess, or probe with. Ownership comes from the session (research P5b).

---

## `GET /enrollment/instructor/earnings/`

The instructor's earnings for one period, across every course they own.

### Auth

| | |
|---|---|
| Authentication | `CookieJWTAuthentication` (the `access_token` cookie, as everywhere else) |
| Permission | `IsAuthenticated` + `isInstructor` |
| Scope | the caller's own `instructor_profile` — applied once, in the base queryset |
| Throttle | `instructor_earnings` — `60/min`, matching the dashboard, analytics and reviews reads |

### Query parameters

| Name | Values | Default | Notes |
|------|--------|---------|-------|
| `period` | `month` \| `year` \| `all` | `month` | Anything else is a **400**. The client normalises an unrecognised address value to `month` and never sends it (FR-015c, R8). |

There is no `course` parameter — deliberately, unlike `/reviews/instructor/reviews/` and
`/courses/instructor/students/`. Earnings has a single scope (FR-001).

### 200 — the snapshot

```json
{
  "period": "month",
  "window": { "start": "2026-09-01", "end": "2026-09-23" },
  "currency": "USD",
  "stats": {
    "total_revenue": "8940.00",
    "refunds": "310.00",
    "net": "8630.00",
    "sales": 173
  },
  "trend": [
    { "start": "2026-09-01", "end": "2026-09-01", "amount": "120.00" },
    { "start": "2026-09-02", "end": "2026-09-02", "amount": "0.00" }
  ],
  "courses": [
    { "id": 42, "title": "Django for Beginners", "sales": 86, "revenue": "4120.00" },
    { "id": 17, "title": "React Fundamentals",   "sales": 54, "revenue": "2700.00" }
  ],
  "courses_count": 6,
  "has_sales_ever": true
}
```

No envelope — the payload is the object, per `CLAUDE.md`.

#### Fields

| Field | Type | Meaning |
|-------|------|---------|
| `period` | `"month" \| "year" \| "all"` | Echo of the period served. The client compares it to the selected one before rendering, so a late response for the previous period is never painted as the new one (FR-039). |
| `window.start` | `date` \| `null` | First day of the window (UTC). For `all` it is the first day of the **month** of the earliest counted sale, not that sale's own date, so the window covers exactly the buckets the chart draws. `null` only for `period=all` with no counted sale. |
| `window.end` | `date` | Today (UTC). |
| `currency` | `"USD"` | Once per response, not per row. |
| `stats.total_revenue` | decimal string | Every counted sale in the window, refunded ones included (FR-007). |
| `stats.refunds` | decimal string | The counted sales in the window that were refunded, at the purchase's date, never the refund's (FR-010). |
| `stats.net` | decimal string | `total_revenue − refunds`. Never negative (FR-011a). |
| `stats.sales` | integer | Counted sales in the window, refunded ones included, free enrolments excluded. |
| `trend[]` | array | One entry per bucket covering the whole window, **including empty buckets** (FR-018). Daily for `month`, monthly for `year` and `all`. `[]` when the window holds no counted sale. |
| `trend[].start` / `.end` | `date` | Bucket bounds, inclusive. Equal for a daily bucket. |
| `trend[].amount` | decimal string | **Net** for that bucket. The series sums to `stats.net` (FR-016). |
| `courses[]` | array | One row per owned course with ≥ 1 counted sale in the window, published or not (FR-025). Sorted by `revenue` desc, then `title` asc, then `id` (FR-026). Never paged (FR-029). |
| `courses[].id` | integer | The course id — row key; the table does not link anywhere in this version. |
| `courses[].title` | string | The course's **current** title (FR-028). |
| `courses[].sales` | integer | Purchases in the window, refunded ones included (FR-023). |
| `courses[].revenue` | decimal string | **Net** for that course. The column sums to `stats.net` (FR-027). |
| `courses_count` | integer | Courses **owned**, not courses listed. Separates "no courses" from "no sales" (FR-038). |
| `has_sales_ever` | boolean | Any counted sale ever, ignoring the window. Separates "never sold" from "sold nothing this period" (FR-036 vs FR-037). |

#### Money format

Every money field is a **quantised decimal string** with exactly two decimal places — `"0.00"`, `"4120.00"`
— never a JSON number. Cents do not survive a float, and this page's whole claim is that its columns add up
(research P3). The client's `formatMoney(amount: string, currency)` already takes this shape.

#### Guaranteed relationships

```
stats.net          == stats.total_revenue − stats.refunds
Σ courses[].revenue == stats.net
Σ courses[].sales   == stats.sales
Σ trend[].amount    == stats.net
stats.net          >= 0,  stats.refunds >= 0,  every trend amount >= 0
period == "all"    =>  stats.net == the dashboard endpoint's earnings.amount   (FR-014)
```

### Errors

| Status | Body | When |
|--------|------|------|
| 400 | `{"error": "period must be one of month, year, all.", "code": "invalid_period"}` | `?period=` is present and unrecognised |
| 401 | — | no valid session cookie |
| 403 | — | authenticated but not an instructor (`isInstructor`) |
| 403 | `{"error": "No instructor profile is associated with this account.", "code": "no_instructor_profile"}` | passes the instructor gate with no `InstructorProfile` — a handled client state, not a retry (FR-034) |
| 429 | — | over `60/min` |
| 500 | `{"error": "We couldn't load your earnings. Please try again."}` | anything else; the real exception is logged, never returned (`CLAUDE.md`) |

The snapshot is built **and** serialized inside one `try`, as 008 and 009 do, so a failure returns one error
rather than a half-filled page.

### What is never in the payload

No buyer name, email, avatar or user id. No payment method, card detail, receipt URL, gateway reference,
payment-intent id or order id. No enrolment or progress data. No course belonging to another instructor
(FR-032, FR-033).

---

## Frontend contract

| | |
|---|---|
| Client | `instructorEarningsAPI.getEarnings({ period })` → `axiosInstance.get('/enrollment/instructor/earnings/', { params })` |
| Params | `period` is sent only when it is not `month`, so the server applies its own default (the 012 rule) |
| Validation | `EarningsSnapshotSchema.parse(data)` — Zod, at runtime, before any component sees it |
| Hook | `useInstructorEarnings(period)` — `queryKey: ['instructor', 'earnings', { period }]`, `staleTime: 0`, `gcTime: 0`, `refetchOnMount: 'always'`, **no** `placeholderData`, no retry on 403 (R10) |
| Address | `?period=month\|year\|all` via `useEarningsPeriod()`, `router.replace` (no history entry per chip click), unrecognised → `month` silently (FR-015c) |
| Suspense | the page reads `useSearchParams`, so `<InstructorEarnings/>` renders under `<Suspense fallback={<EarningsSkeleton/>}>` — Next 16's requirement |
