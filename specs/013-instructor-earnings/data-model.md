# Data Model: Instructor Earnings (spec 013)

Phase 1 of `/speckit.plan`. **No new persisted model and no schema change.** Everything below is computed on
read from `enrollment.Order`. The one write in this feature is a data migration that fills an existing null
column (research R4).

---

## 1. Existing models read

### `enrollment.Order` — the only table this feature reads

| Field | Used for |
|-------|----------|
| `course` (FK → `course.Course`) | ownership (`course__instructor`) and the per-course grouping |
| `status` (`pending` / `paid` / `refunded` / `failed`) | which orders count, and whether an order is a refund |
| `amount` (`Decimal(6,2)`) | every money figure on the page |
| `currency` (`USD` only) | the response's single `currency` field |
| `created_at` (`DateTimeField`, **nullable**) | the period window, and the trend bucket a sale falls into |

`user`, `stripe_payment_intent_id`, `payment_gateway` and `idempotency_key` are **never** read or serialized
— FR-033 keeps the buyer out of the payload entirely.

### Read for context only

- **`course.Course`** — `id`, `title` (the row label, always current, FR-028), `instructor` (ownership).
  `is_published` is deliberately **not** filtered on: an unpublished course that sold keeps its row (FR-025).
- **`authentication.InstructorProfile`** — the caller's identity and the only scope input.
- **`enrollment.Enrollment`** — `enrolled_at`, read **once, by the backfill migration only** (R4). The
  service never touches it.

### Deliberately not read

**`enrollment.Transaction`.** It would only be needed for the date a refund was issued or a partial refund
amount, and the spec rules out both (FR-010 attributes a refund to its sale; refunds are whole-order).
Reading it would introduce a second, divergable definition of "refunded" alongside `Order.status` (R3).

---

## 2. Derived concepts

### Counted sale

An `Order` is a **counted sale** for instructor *I* when all of:

1. `course.instructor == I` — the only ownership rule, applied once in the base queryset (FR-031);
2. `status in ('paid', 'refunded')` — pending and failed never took money (FR-008);
3. `amount > 0` — a free enrolment is not a sale (FR-008a);
4. `created_at IS NOT NULL` — it must be placeable in time, so the tiles, the chart and the table can all
   agree on it (FR-041; after R4's backfill this excludes nothing).

Its **date** is `created_at`, its **course** is `course_id`, its **value** is `amount`.

### Period

| Value | Window start (UTC, inclusive) | Window end |
|-------|-------------------------------|------------|
| `month` | first instant of the current calendar month | now |
| `year` | first instant of 1 January, current year | now |
| `all` | unbounded (`window.start` reported as the **first day of the month** of the earliest counted sale, or `null` if none) | now |

Parsed strictly on the server (400 on anything else); normalised silently to `month` by the client (R8).

### Bucket

A contiguous, non-overlapping date range covering the window, **every** one emitted including the empty ones
(FR-018).

| Period | Granularity | Count |
|--------|-------------|-------|
| `month` | one per day | 1 – 31 |
| `year` | one per calendar month | 1 – 12 |
| `all` | one per calendar month, from the month of the earliest counted sale | unbounded, ~months of history |

### The three figures

Over the counted sales inside the window:

| Figure | Definition | Invariant |
|--------|------------|-----------|
| `total_revenue` | `Σ amount` where `status ∈ {paid, refunded}` | ≥ `refunds` |
| `refunds` | `Σ amount` where `status = refunded` | ≥ 0 |
| `net` | `Σ amount` where `status = paid` | `= total_revenue − refunds`, and ≥ 0 |
| `sales` | count of counted sales | `= Σ courses[].sales` |

`net ≥ 0` is structural, not checked: the refunded set is a subset of the counted set, so its sum cannot
exceed the whole (FR-011a, SC-013).

---

## 3. Computed shapes (the response)

```
EarningsSnapshot
├── period           'month' | 'year' | 'all'      (echo of the request)
├── window           { start: date|null, end: date }
├── currency         'USD'
├── stats            { total_revenue, refunds, net: decimal-string; sales: int }
├── trend            [ Bucket { start: date, end: date, amount: decimal-string } ]
├── courses          [ CourseEarnings { id: int, title: str, sales: int, revenue: decimal-string } ]
├── courses_count    int    — courses OWNED, not courses listed
└── has_sales_ever   bool   — any counted sale, ignoring the window
```

- **Money is a quantised decimal string** (`"4120.00"`), never a JSON number — cents do not survive a float,
  and this page's whole claim is that its columns add up (P3). Matches the dashboard's `earnings.amount`.
- **`courses`** holds one row per course with **≥ 1 counted sale in the window** (FR-025), sorted by
  `revenue` descending then `title` ascending then `id` — a total order, so the same period always renders
  the same table (FR-026). Not paged (FR-029).
- **`courses[].sales`** counts purchases **including** those later refunded; **`courses[].revenue`** is
  **net**. A course sold once and refunded is therefore `{sales: 1, revenue: "0.00"}` — the case FR-023 calls
  out and the table shows honestly.
- **`courses_count`** is every course the instructor owns, including ones that never sold. It exists only to
  separate FR-038 from FR-036.
- **`trend`** is `[]` when the window holds no counted sale (and when `period='all'` for an instructor who
  has never sold, where the window has no start).

### Invariants a test asserts

1. `stats.net == stats.total_revenue - stats.refunds`
2. `Σ courses[].revenue == stats.net` (FR-027)
3. `Σ courses[].sales == stats.sales` (FR-027)
4. `Σ trend[].amount == stats.net` (FR-016, SC-004)
5. `period='all'` → `stats.net` equals the dashboard endpoint's `earnings.amount` (FR-014)
6. `trend` covers the window with no gap and no overlap (FR-018)
7. every money field matches `^\d+\.\d{2}$` — no floats, no negatives (SC-013)

---

## 4. State selection (client)

One response answers which of five things the page renders, in this order:

| Condition | Render | Requirement |
|-----------|--------|-------------|
| request failed | error + retry, filter still usable | FR-040 |
| 403 `no_instructor_profile` | handled state, not a retry loop | FR-034 |
| `courses_count === 0` | "create your first course" | FR-038 |
| `has_sales_ever === false` | "no earnings yet" | FR-036 |
| `stats.sales === 0` | "nothing in <period>", filter usable | FR-037 |
| otherwise | tiles + chart + table | — |

A fully-refunded period has `stats.sales > 0` and so falls through to the last row: real figures, `net` of
`$0.00`, never an empty state (FR-037).

---

## 5. Migration

**`enrollment/migrations/00XX_backfill_order_created_at.py`** — data only, additive, no schema change.

- **Forward**: for each `Order` with `created_at IS NULL` that has an `Enrollment`, set `created_at` to that
  enrolment's `enrolled_at`. Rows with a date are untouched; rows with no enrolment (pending / failed) are
  left as they are and remain excluded from this page.
- **Reverse**: a no-op — the previous state was "unknown", which cannot be restored and is not worth
  restoring.
- **Why**: without it, all-time net silently drops every order placed before 2026-07-07 (when `created_at`
  was added as nullable), breaking FR-014's parity with the dashboard tile (R4).
- **Needs owner sign-off**: it writes to payment rows, even though it only fills a null timestamp.
