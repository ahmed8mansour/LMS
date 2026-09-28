# Research: Instructor Earnings (spec 013)

Phase 0 of `/speckit.plan`. Part 1 argues with the owner's API sketch, as they asked; part 2 records the
decisions the build rests on. Nothing here is code.

---

## Part 1 — The owner's plan, argued

> * one endpoint : instructors/earnings?period=month|year|all
> * the source of it will be only in special page not also in the courses breadcrumb
> * `{ stats:{total_revenue, refunds, net}, courses:{id,title,sales,revenue}, trend:{the same form as the analytics/barchart} }`
> * front end: the same feature folder; use the same components that were used in the dashboard — the tile,
>   the table, etc. — because I want the design to be like each other

Four of the five points survive unchanged. The corrections are one wrong path, three missing fields, and one
ambiguity about which analytics chart is meant.

### P1 — `instructors/earnings` · **path corrected, shape kept**

**The objection**: there is no `instructors/` root. `config/urls.py` mounts exactly `auth/`, `courses/`,
`enrollment/`, `progress/`, `reviews/`, `admin/` and `accounts/`. Taking the sketch literally means adding an
eighth root prefix for one endpoint, and then every later instructor read has to choose between two homes.

**The two real candidates**, and why the winner wins:

| Candidate | For | Against |
|-----------|-----|---------|
| `courses/instructor/earnings/` | The instructor read family lives there today — dashboard, analytics, students | The data is not a course. `apps/course/` would import `Order` to aggregate money, inverting the dependency: payments already know about courses |
| **`enrollment/instructor/earnings/`** ← **chosen** | Orders and refunds live in `apps/enrollment/`; the **student** money reads are already there (`enrollment/student/billing/summary/`, `enrollment/student/orders/`), so this is the symmetric instructor read. Discovery §13.2 named this exact path. 012 set the precedent by putting the instructor reviews feed in `apps/reviews/`, not in `apps/course/` | Breaks the "all instructor reads start `courses/instructor/`" surface pattern — a URL-cosmetic cost, paid once |

**Decision**: `GET /enrollment/instructor/earnings/?period=month|year|all`. The sketch's query parameter is
kept exactly, including the values. It deliberately differs from analytics' `?days=30|90|all` because these
are calendar periods, not rolling day spans; reusing `days` for "this month" would be a lie in the name.

### P2 — One endpoint · **kept, and it is the strongest part of the sketch**

The alternative — `/stats`, `/trend`, `/courses` as three endpoints — is what a REST-shaped instinct
suggests, and it is wrong here. FR-004 requires the tiles, the chart and the table to describe the same
period; SC-005 allows a mixed page **zero** times. Three requests means three in-flight states and a window
where the tiles are September and the table is still August. One snapshot makes that impossible by
construction rather than by client discipline, and it matches the 008/009 snapshot endpoints exactly.

The honest cost, accepted: switching period refetches everything, including a course table that rarely
changes. At 4 queries and a payload measured in kilobytes, that is cheaper than the coordination it removes.

### P3 — `stats: {total_revenue, refunds, net}` · **three fields added**

The three the owner listed are right and are the page's headline. Three more are needed, and each one is
forced by a requirement rather than wanted for tidiness:

1. **`sales` (integer)** — FR-027 makes the table's sales column add up to the period's counted-sale total.
   With no total in the payload, nothing can be checked against it, and "total revenue" has no denominator
   anywhere on the page. It costs nothing: it falls out of the same aggregate.
2. **`period` + `window: {start, end}`** — analytics returns both and the chart needs them: to label the axis,
   to print the UTC caption FR-015a asks for, and to let the client confirm a response matches the period
   currently selected rather than the one it just left (FR-039).
3. **`courses_count` + `has_sales_ever`** — the decisive one. FR-036, FR-037 and FR-038 are three different
   empty states, and SC-009 requires them distinguishable. From `{stats, courses, trend}` alone, an
   instructor with no courses, an instructor who has never sold, and an instructor who simply sold nothing
   this month produce **the same response**: zeros and two empty arrays. Without these two scalars the client
   must fire a second request at `period=all` to tell them apart — which defeats P2's single round trip for
   the sake of two integers.

**Also changed: money is a decimal string, not a number.** `"8940.00"`, not `8940.0`. JSON has one numeric
type and it is a float; cents do not survive it reliably, and this page's whole claim is that its columns add
up. The project already does this — the dashboard ships `earnings.amount` as a quantised string — and the
client's `formatMoney(amount: string)` already takes one. `currency` travels once at the response root rather
than repeated on every row.

**Rejected**: per-course `refunds` and `gross`. A row reading "1 sale · $0.00" is opaque without them, but
FR-022 fixes the table at three columns, so the extra fields would ship unused. Noted as follow-up F2.

### P4 — "use the same components that were used in the dashboard" · **kept, and made literally true**

The instruction is right and the codebase currently defeats it. There is no shared tile: `SummaryTiles.tsx`
(008) and `AnalyticsTiles.tsx` (009) each declare their own local `Tile` with the same markup, the same
tokens, the same 9×9 icon chip. Writing a third copy would make the earnings page *look* like the dashboard
today and drift from it on the first change to either.

**Decision**: extract `components/molecules/StatTile.tsx` from that markup verbatim and point all three
features at it. This is the owner's instruction carried out properly, and it is Constitution II — a component
used in three places belongs in the shared library. The migration of 008 and 009 is mechanical, changes no
markup and no class name, and their existing tests cover it.

The table needs no such work: `components/atoms/table.tsx` is already shared, and
`instructor-students/components/StudentsTable.tsx` establishes the pattern this table copies — a real
`<table>` at `md` and up, a card list below it, because three columns at 375px either scroll sideways or
truncate the course title into uselessness (FR-005). **Rejected**: a generic `<DataTable>` abstraction. Two
call sites with different columns is not a pattern yet.

### P5 — "trend: the same form as the analytics bar chart" · **ambiguous, resolved**

There are two charts in analytics and they are not interchangeable:

- `SectionDropOffChart` is the **bar** chart — but horizontal, one bar per section, categorical, no time axis.
- `EnrollmentsChart` is the **time series** — but a `<Line>`, one point per bucket.

The wireframe wants neither exactly: vertical bars over time. The resolution is to take `EnrollmentsChart`'s
*structure* — the `{start, end, …}` bucket, `formatBucketLabel`, the empty decision made before the chart
renders rather than by drawing a flat line, `var(--color-*)` tokens with no raw hex, `ResponsiveContainer`,
`accessibilityLayer` for keyboard-reachable values — and swap `<Line>` for `<Bar>` with
`SectionDropOffChart`'s bar styling.

On the wire the bucket keeps `start` and `end` and renames `count` → **`amount`**. The two fields the label
formatter reads stay identical, so it ports straight across; the value gets a name that matches its type,
because one key meaning "integer" in one endpoint and "decimal string" in another is how a shared helper
silently starts rendering `$NaN`.

### P5b — "only in the special page, not in the courses breadcrumb" · **kept**

Agreed, and already the spec's scope. Worth recording what it buys: unlike the roster (010) and the reviews
feed (012), which are one endpoint with two scopes selected by `?course=`, this endpoint takes **no id from
the client at all**. Its only input is `?period=`. There is no ownership check to get wrong on a client-
supplied course id, because there is no client-supplied course id — the strongest possible answer to FR-031
and the §15.4 risk, and the reason this feature's access-control surface is smaller than 012's.

---

## Part 2 — Decisions

### R1 — Which orders count

**Decision**: a **counted sale** is an `Order` whose `course.instructor` is the caller's profile, whose
`status` is `paid` or `refunded`, and whose `amount > 0`.

- `pending` / `failed` never took money (FR-008).
- `refunded` **is** counted: FR-007 puts it in total revenue and FR-010 subtracts it again as a refund.
  Dropping it would make refunds unshowable.
- `amount > 0` implements FR-008a. It is the exact test, better than `payment_gateway != 'free'`: free
  enrolments are written with `amount=0` and `payment_gateway='free'`, and the amount is what actually
  decides whether money moved.

**Rationale**: matches `InstructorDashboardService._earnings`, which already filters `status='paid'` and
treats free enrolments as zero-value paid orders.

### R2 — The three figures as three sums

**Decision**:

| Figure | Expression over counted sales in the window |
|--------|---------------------------------------------|
| `total_revenue` | `Sum(amount)` where `status in ('paid', 'refunded')` |
| `refunds` | `Sum(amount)` where `status = 'refunded'` |
| `net` | `Sum(amount)` where `status = 'paid'` |

`net == total_revenue - refunds` is then an identity, not a subtraction that could disagree with its parts.
It also proves FR-011a: `refunds ≤ total_revenue` always, so no figure can go negative and `$0.00` is the
floor — which is what the spec's clarification asserted and what SC-013 checks.

### R3 — `Transaction` is not read

**Decision**: this feature reads `Order` and nothing else.

**Rationale**: `Transaction` would be needed for two things the spec ruled out — the date a refund was issued
(FR-010 attributes refunds to the purchase instead) and a partial refund amount (the spec's assumption:
refunds are whole-order, and `RefundService` refunds the full payment intent). Reading it anyway would add a
join and a second definition of "refunded" that could disagree with `Order.status`.

**Consequence worth stating**: all-time `net` is `Sum(amount) where status='paid'` — the same expression as
`InstructorDashboardService._earnings`. FR-014's dashboard parity is exact, not approximate, and the test
asserts it against the dashboard endpoint rather than a hand-computed number.

**Alternative considered**: sum `Transaction` rows with `status='refunded'` for the refunds figure. Rejected:
it would silently diverge from `Order.status` whenever a webhook wrote one but not the other, and it carries
the refund's own date, which this page must not use.

### R4 — Null `created_at` — the one real obstacle

**The finding**: `Order.created_at` was added by `enrollment/migrations/0011_…` on 2026-07-07 as
`DateTimeField(auto_now_add=True, null=True)`. `auto_now_add` fills it for every row written since; every
order placed **before** that migration has `created_at = NULL`. This is a live data condition, not a
hypothetical.

Neither obvious handling works:

- **Exclude null-dated orders everywhere** → the tiles, chart and table agree (FR-041 satisfied), but
  all-time `net` silently loses the pre-July-2026 revenue that the dashboard tile still counts. **FR-014
  breaks.**
- **Include them in the tiles and the table but not the (dateless) trend** → FR-014 holds, but the bars stop
  adding up to Net for `period=all`. **FR-041 breaks.**

**Decision**: a **new data migration** backfilling `Order.created_at` from the order's
`Enrollment.enrolled_at`, then a single `created_at__isnull=False` filter in the service's base queryset as a
belt against anything it could not reach.

**Why `Enrollment.enrolled_at` is the right source**: it is non-null (`auto_now_add`, no `null=True`), it is
written by `FulfillmentFacade` at the moment the order is fulfilled — within seconds of the purchase — and
every counted sale has one, because a paid order is what creates an enrolment. Refunded orders keep their
enrolment row (deactivated), so they are covered too. Orders with no enrolment are `pending` or `failed` and
are excluded from this page anyway.

**This is additive and non-destructive**: a new migration file (never an edit to an existing one, per the
project's hard rules), filling a null field only, changing no amount, status or relation, and leaving rows
that already have a date untouched. It still writes to payment rows, so it needs the owner's explicit
go-ahead.

**Fallback if the owner declines**: exclude null-dated orders everywhere and amend FR-014 to "all-time net
equals the dashboard tile for orders placed after 2026-07-07", with the divergence stated on the page. That
is a worse page and a weakened requirement, which is why it is the fallback.

**Follow-up F1**: a later migration should make `Order.created_at` non-null now that every row has one.

### R5 — Periods and buckets

**Decision**: a `Period` enum (`MONTH = 'month'`, `YEAR = 'year'`, `ALL = 'all'`) in a pure
`earnings/periods.py`, with no ORM import — the shape of `apps/course/analytics/periods.py`.

| Period | Window (UTC) | Buckets |
|--------|--------------|---------|
| `month` | 1st of the current month 00:00 → now | one per **day**, 1st → today |
| `year` | 1 Jan of the current year 00:00 → now | one per **month**, January → current month |
| `all` | everything | one per **month**, month of the earliest counted sale → current month |

Every bucket in the window is emitted, including empty ones (FR-018), so a gap reads as a gap.

**Rejected: reusing `apps/course/analytics/periods.py`.** Its `Period` is `30 | 90 | all` — rolling day spans
deliberately day-aligned for comparable points. Calendar month-to-date and year-to-date are a different
concept that happens to share a name; bending one enum to serve both would give 009 a `month` member it must
reject and 013 a `30` member it must reject. Two small pure modules beat one branching one.

**UTC**: `settings.TIME_ZONE` is `'UTC'`, so `timezone.now().date()` is already a UTC date and the analytics
module's conventions carry over unchanged (FR-015a, FR-019).

### R6 — Four queries, and stats derived from rows

**Decision**, per request:

| # | Query | Purpose |
|---|-------|---------|
| 1 | `.values('course_id', 'course__title').annotate(...)` over counted sales in the window | the `courses` rows **and**, summed in Python, the `stats` block |
| 2 | `.annotate(bucket=TruncDay\|TruncMonth('created_at')).values('bucket').annotate(...)` | the trend, gaps filled in Python |
| 3 | `Course.objects.filter(instructor=profile).count()` | `courses_count` (FR-038) |
| 4 | counted sales all-time `.exists()` | `has_sales_ever` (FR-036) — **skipped** when `period='all'`, where it is just `stats.sales > 0` |

Fixed at 4 (3 for `period=all`) however many courses or orders exist, pinned by `assertNumQueries` as
`tests_analytics.py` does.

**The point of deriving stats from query 1 rather than issuing a fifth aggregate**: FR-027 requires the
table's columns to sum to the tiles. Two independent aggregates satisfy that only as long as both carry
exactly the same filters forever — and the first divergence (a filter fixed in one place) produces a page
that is subtly, silently wrong. Summing the rows makes it an identity. The rows are bounded by courses owned.

**Alternative considered**: bucket the trend in Python from a flat `values_list`, as
`analytics/build_buckets` does with enrolment dates. Rejected: analytics is counting rows, this is summing
money, and `Decimal` accumulation over 20,000 rows in Python for a chart the database can group is work for
nothing. Python still fills the empty buckets, which SQL cannot.

### R7 — Empty states are the server's answer, not the client's guess

**Decision**: the client selects among the three states with, in order: `courses_count === 0` → FR-038 (make
a course); `has_sales_ever === false` → FR-036 (no earnings yet); `stats.sales === 0` → FR-037 (nothing in
this period, naming it and keeping the filter usable); otherwise render the page.

A fully-refunded period is explicitly **not** an empty state: `stats.sales > 0`, so the page renders real
figures with `net` at `$0.00` (FR-037's second sentence, SC-013).

### R8 — Strict server, forgiving client

**Decision**: an unknown `?period=` returns **400** `{'error': 'period must be one of month, year, all.',
'code': 'invalid_period'}`; the client normalises an unrecognised value in the address to `month` and never
sends it.

**Rationale**: exactly the 009 split. The API refusing to guess keeps a typo from silently returning a
different period's money; the page address falling back keeps a stale bookmark from showing an error
(FR-015c).

A caller with no `instructor_profile` gets **403** with `code: 'no_instructor_profile'` (FR-034), the shape
008/009/012 already return and the client already renders as a handled state.

### R9 — The chart

**Decision**: `RevenueTrendChart.tsx` — Recharts `<BarChart>` + `<Bar>` inside `ResponsiveContainer`, tokens
via `var(--color-darkmint)` / `var(--color-graytext2)`, `accessibilityLayer` on, the empty decision taken
before render, tooltip formatting money through the same `formatMoney` the tiles use.

At `period=month` the x-axis carries up to 31 daily labels and at `period=all` one per month since the first
sale; `interval="preserveStartEnd"` with `minTickGap` (the `EnrollmentsChart` setting) keeps them legible
without sideways scroll (FR-020, SC-012). Bar values are reachable by keyboard, not hover alone.

### R10 — Caching

**Decision**: `staleTime: 0`, `gcTime: 0`, `refetchOnMount: 'always'`, **no** `placeholderData`, retry
suppressed on 403 — the 008/009/010/012 hook shape.

`placeholderData: keepPreviousData` is the obvious optimisation for a filter switch and it is forbidden here
for the same reason as in 012: FR-039 says a period change must not show the previous period's figures as if
they were the new result. The skeleton shows instead. Money written by Stripe webhooks from outside this app
must never be served from a cache.

### R11 — `StatTile` extraction

**Decision**: `components/molecules/StatTile.tsx` with `{label, icon, title, value, secondary}` — the props
the two existing copies already share — and all three features import it.

**Risk and mitigation**: it touches two shipped features. The move is verbatim (same markup, same classes,
same truncation and `title` tooltip behaviour), so 008's and 009's tests and the eye both cover it. If the
owner would rather not touch shipped code in this PR, the fallback is to land `StatTile` used by earnings
only and migrate the other two in a follow-up — accepting three copies for one release, which is the thing
this decision exists to avoid.

### R12 — No new index, no schema change

**Decision**: no index is added. `Order.course` is an FK and indexed; the window filter on `created_at` scans
within one instructor's orders.

**Rationale**: 012's R13 rule — no speculative index. SC-011's ceiling is 20,000 orders across 50 courses,
which Postgres handles on the FK index alone. **Follow-up F3**: if the endpoint is ever measured slow, a
composite `(course_id, created_at)` index is the first move, as a new migration.

### R13 — Tests

**Decision**: `backend/apps/enrollment/tests_earnings.py`, following `tests_dashboard.py`. The cases that
earn their place because they encode a decision someone could undo:

- a refunded order counted in **both** total revenue and refunds, with `net` unchanged by it;
- a sale in one month refunded in the next, asserted to move the **earlier** month (R2/FR-010) — the test
  that fails if someone "fixes" attribution to the refund date;
- a free enrolment moving no tile and producing no row (FR-008a);
- pending and failed orders contributing nothing;
- a repriced course keeping its historic order amount;
- the three periods' UTC boundaries, including a sale at `23:59:59` on the last day of the previous month;
- bucket completeness — every day of a month with sales on two of them;
- all-time `net` equal to the dashboard endpoint's earnings tile (FR-014);
- `stats` equal to the sum of the `courses` rows, and the trend equal to `net` (FR-027, SC-004);
- another instructor's orders absent; a student refused; no-profile → 403 with its code;
- `assertNumQueries(4)` and `(3)` for `period=all`;
- the backfill migration: an order with a null date gets its enrolment's date, one with a date is untouched.

---

## Follow-ups (not this feature)

- **F1**: make `Order.created_at` non-null in a later migration, once R4's backfill has run everywhere.
- **F2**: per-course `refunds` / gross, if the table ever grows past three columns.
- **F3**: a composite `(course_id, created_at)` index, when measurement asks for it.
- **F4**: the dashboard's Earnings tile could link to this page now that it exists.
