# Quickstart: Verifying Instructor Earnings

**Feature**: `013-instructor-earnings` | **Spec**: [spec.md](./spec.md) | **Contract**: [contracts/instructor-earnings.md](./contracts/instructor-earnings.md)

## Prerequisites

```bash
cd backend && env\Scripts\activate && python manage.py runserver
```

```bash
cd front-end && npm run dev
```

**No new package**, backend or frontend. Recharts, the shadcn `Table` atoms, `skeleton` and the chip pattern
are already vendored.

### Check your data before anything else

This feature's one real obstacle is orders with no `created_at` (research R4). Check whether your database
has any:

```python
# python manage.py shell
from apps.enrollment.models import Order
Order.objects.filter(created_at__isnull=True).count()
```

Anything above zero means the backfill migration has work to do, and it means the all-time figures before the
migration will disagree with the dashboard's Earnings tile. Re-run this after migrating; it must read `0`.

### Fixture data

Orders cannot be made awkward through the UI — Stripe writes them — so use the shell. `created_at` is
`auto_now_add`, so it has to be written with `.update()`, past the model's normal path:

```python
from datetime import datetime, timezone
from apps.enrollment.models import Order
Order.objects.filter(pk=1201).update(created_at=datetime(2026, 8, 30, 23, 59, 59, tzinfo=timezone.utc))
```

Set up, for instructor **A**:

- **Course 1 (published)** — several `paid` orders spread across *this month*, *earlier this year*, and *a
  previous year*, at two different amounts (so a repricing is visible).
- **Course 2 (unpublished)** — at least one `paid` order. It must still appear in the table (FR-025).
- **Course 3** — exactly one order, `refunded`, **placed this month**. The row must read `1 sale · $0.00`.
- **Course 4** — a **free** course with several `amount=0`, `payment_gateway='free'` orders and no paid ones.
  It must never appear, and must move no tile (FR-008a).
- **Course 5** — no orders at all. Counts toward `courses_count`, appears in no table.
- One `pending` and one `failed` order on Course 1, both with non-trivial amounts. Neither may move anything.
- **The month boundary**: one `paid` order at `23:59:59` UTC on the last day of **last** month. It must be
  absent from `This month` and present in `This year`.
- **The cross-period refund**: an order placed **last month** and later `refunded`. Under `This year` its
  refund must land in **last month's** bucket, not this month's (FR-010) — the single most important thing
  on this page to get wrong.

Instructor **B** owns one course with paid orders. Nothing of B's may ever appear in A's figures.

## 1. Automated backend tests

```bash
cd backend && env\Scripts\activate && python manage.py test apps.enrollment.tests_earnings -v 2
```

Then the two suites this feature must not disturb:

```bash
cd backend && env\Scripts\activate && python manage.py test apps.enrollment apps.course.tests_dashboard -v 1
```

## 2. The endpoint, by hand

Sign in as **A** in the browser (the session is a cookie), then in DevTools → Console:

```js
await (await fetch('/enrollment/instructor/earnings/?period=month', {credentials:'include'})).json()
```

Check, against the contract:

1. `stats.net` equals `stats.total_revenue` minus `stats.refunds`, to the cent.
2. Every money value is a **string** with two decimals (`"310.00"`), not a number.
3. `courses` rows summed: `revenue` → `stats.net`, `sales` → `stats.sales`.
4. `trend` amounts summed → `stats.net`.
5. `trend` has one entry per day from the 1st to today, **including the days with nothing** (FR-018).
6. Course 4 (free) is absent and `stats.sales` does not count its enrolments.
7. The `pending` and `failed` orders are nowhere in the totals.
8. No buyer name, email, receipt URL, payment-intent or order id appears anywhere in the payload (FR-033).

Then `?period=year`:

9. The last-day-of-last-month order is included here and was excluded above.
10. Buckets are one per **month**, January through the current month.
11. The cross-period refund shows against **last month's** bucket — reduce that bucket, not this one.

Then `?period=all`:

12. Buckets are monthly from the month of the earliest order.
13. `stats.net` equals the dashboard's figure:
    ```js
    await (await fetch('/courses/instructor/dashboard/', {credentials:'include'})).json()
    ```
    `earnings.amount` there must equal `stats.net` here, exactly (FR-014). If it does not, the null-date
    backfill did not run.

And the refusals:

14. `?period=lastweek` → **400** with `code: "invalid_period"`.
15. Signed in as a **student**, the same fetch → **403**, no figures.
16. Signed in as **B**, nothing of A's appears in B's response.

## 3. The page

> Browser checks are yours to run — this section is the list, not something to automate.

Open `/instructor/earnings`.

**Layout and the period filter**

1. The page shows, in order: title + period chips, three tiles, the trend chart, the course table (FR-002).
2. It opens on **This month**, and the sidebar's Earnings item is marked active (FR-015b, FR-001).
3. Clicking **This year** then **All time** updates the tiles, the chart *and* the table together — at no
   point does one part show one period while another shows a different one (FR-004, SC-005).
4. The address carries `?period=`; refresh and Back restore the same period; three chip clicks do **not**
   leave three history entries (FR-015c).
5. `/instructor/earnings?period=banana` shows **This month** with no error (FR-015c).
6. While a period loads, a skeleton holds the layout — the previous period's numbers are never left on
   screen as if they were the new ones (FR-039).

**Figures**

7. Amounts read `$8,940.00`, not `$8.9k` — separators and cents everywhere (FR-012).
8. The tiles' Net equals the table's revenue column summed, and equals the chart's bars summed.
9. Course 3 reads **1 sale · $0.00** (FR-023).
10. Rows are ordered by revenue, highest first (FR-026), and the unpublished Course 2 is among them (FR-025).
11. The chart's bars are reachable by **keyboard**, not hover alone, and each states its date and amount
    (FR-020).
12. A day with no sales in `This month` is a visible gap in the axis, not a missing column (FR-018).
13. Somewhere on the page, the dates are stated to be UTC (FR-015a).

**The states — all five**

14. A period with no sales (pick an instructor who sold only last year, then choose **This month**):
    "nothing in this period", naming it, with the chips still usable — **not** an empty table, **not**
    `$0.00` tiles (FR-037).
15. An instructor who owns courses but never sold: "no earnings yet" (FR-036) — visibly different from 14.
16. An instructor with no courses at all: pointed at creating one (FR-038) — different again.
17. A period where every sale was refunded: real figures with `$0.00` net, **not** an empty state (FR-037).
18. Stop the backend and reload: a plain message with a retry, no stack trace, chips still usable (FR-040).

**Responsive**

19. At 375px: no horizontal page scroll; the three tiles stack; the table becomes cards; every column's value
    stays readable and the chart stays legible (FR-005, SC-012).
20. A course with a very long title truncates inside its cell rather than pushing the table sideways.

## 4. The shared tile

The tile is now `components/molecules/StatTile.tsx`, used by earnings, the dashboard and analytics (R11).
After the migration, open `/instructor` and `/instructor/analytics` beside `/instructor/earnings`: the three
tile rows must be **pixel-identical** in border, padding, label case, icon chip and value size. That equality
is the point of the extraction — if one of them shifted, the move was not verbatim.

## 5. Lint and types

```bash
cd front-end && npm run lint && npx tsc --noEmit
```
