# Feature Specification: Instructor Earnings — Revenue, Refunds, Net, Trend and Per-Course Breakdown

**Feature Branch**: `013-instructor-earnings`
**Created**: 2026-09-23
**Status**: Draft
**Input**: User description: "read the planning/instructor-experience-discovery.md, now it's 013's turn.
This spec info: instructor can see total revenue, refunds, net; instructor can see the revenue trend as a bar
chart; instructor can see the data per-course (name of the course, sales, revenue); instructor can filter all
of the above by those filters (all time, this year, this month).
UI/UX frames: https://claude.ai/code/artifact/46addddf-c7d7-47b8-a58c-6dc7d9fa8cc5"

## Overview

Students have been able to buy courses since the payments work landed, and every purchase and refund is
already recorded against the course that was sold. The instructor who owns that course, however, has never
been able to see a single figure of it from their own workspace: the sidebar **Earnings** item leads to a
"coming soon" placeholder, and the only money an instructor can see anywhere is the one all-time **Earnings**
tile on their dashboard. This is discovery US-12 and capability C10 — the last item of the instructor
experience and the second half of Phase 3.

This feature fills that placeholder with a single read-only **Earnings** page covering every course the
instructor owns, showing, for one selected period:

1. **Three money tiles** — **total revenue**, **refunds**, and **net**.
2. **A revenue trend**, drawn as a bar chart across the period.
3. **A per-course table** — each course's **name**, its **sales**, and its **revenue**.
4. **A period filter** offering **All time**, **This year**, and **This month**, which drives all three of the
   above together.

Everything here is **read-only and derived from orders the platform already holds**. This feature stores
nothing, changes no payment, and deliberately adds no way for an instructor to issue a refund, request a
payout, change a price, or export a statement. Refunds remain an administrator action.

## Clarifications

### Session 2026-09-23

- Q: Which date is a refund counted under — the date of the original purchase, or the date the refund was
  issued? → A: **The date of the original purchase.** A refund is attributed to the sale it reverses, so each
  period's three tiles read "of what I sold in this period, this much came back", and revenue and refunds
  always describe the same set of sales. The consequence is accepted deliberately: a past period's figures can
  change later, because a refund issued in February lowers January's net. The refund's own date is not used
  anywhere on this page.
- Q: What do the bars of the revenue trend show? → A: **Net revenue per bucket**, so the bars add up to the
  **Net** tile and the chart reconciles with both the tiles and the per-course table (which is also net).
- Q: Do free (zero-price) enrolments count as sales? → A: **No.** A free enrolment is recorded as a paid order
  of $0.00; it adds nothing to revenue and is not counted as a sale, so a course that is only ever given away
  does not appear on this page at all. Its enrolments are visible on the Students and Analytics pages, which
  is where that traffic belongs.
- Q: Can any figure on this page be negative? → A: **No**, and this follows from the first answer. Because a
  refund is attributed to the sale it reverses, and a refund never returns more than was paid, refunds can
  never exceed revenue in a period, a bucket, or a course. A negative figure anywhere is a defect, not a state
  to present. A period, bucket or course whose sales were *all* refunded reads net **$0.00** and is
  distinguishable from one with no sales at all.
- Q: Does a refunded purchase still count as a **sale** in the per-course table? → A: **Yes.** "Sales" counts
  the purchases made in the period, including any later refunded, so it reconciles with the **total revenue**
  tile; the **revenue** column is net and reconciles with the **net** tile. A course whose single purchase was
  refunded therefore reads "1 sale · $0.00".
- Q: What do "this month" and "this year" mean? → A: **Calendar month-to-date and calendar year-to-date, in
  UTC.** "This month" starts at the first instant of the current calendar month and ends now; "this year"
  starts at the first instant of 1 January of the current year and ends now. Neither is a rolling window, and
  both reset at their boundary. This matches "reviews this month" in spec 012 and the UTC rule of spec 009.
- Q: Does an instructor keep the whole amount a student paid? → A: **Yes.** The platform models no commission,
  platform fee, tax, or payout deduction anywhere, so an order's amount is the instructor's revenue from it in
  full. This page reports what was collected for their courses; it is not a payout statement.
- Q: Which orders count as revenue? → A: **Orders that were actually paid**, at the amount that was actually
  paid. Pending and failed orders count as nothing, and a later price change never alters an order already
  made.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See revenue, refunds, and net (Priority: P1)

An instructor selects **Earnings** in the sidebar. Three tiles tell them what their courses took in over the
selected period, how much of it was refunded, and what is left — the answer to "how am I doing?" in one
screen, replacing today's placeholder.

**Why this priority**: This is the feature at its smallest useful size and discovery US-12 exactly. The three
figures are the reason an instructor opens the page at all; the trend and the per-course table explain them
but are worthless without them. It is also the only place in the product, other than one dashboard tile, where
an instructor can see money.

**Independent Test**: For an instructor owning courses with a known set of paid, refunded, pending, failed and
free orders, open the Earnings page and confirm each of the three tiles matches the underlying orders under
FR-006 – FR-014.

**Acceptance Scenarios**:

1. **Given** an instructor with sales, **When** they open the Earnings page from the sidebar, **Then** they
   see the three tiles, the revenue trend, the per-course table and the period filter, with the Earnings
   navigation item marked active and the period set to **This month**.
2. **Given** orders in the period of $50, $30 and $20 of which the $20 one was refunded, **When** the page
   loads, **Then** total revenue reads $100.00, refunds read $20.00, and net reads $80.00.
3. **Given** the figures above, **When** the instructor reads them, **Then** net is exactly total revenue
   minus refunds, and every amount is shown to the cent with its currency.
4. **Given** a pending order and a failed order in the period, **When** the page loads, **Then** neither
   contributes to any of the three tiles.
5. **Given** a course whose price was raised after a student bought it, **When** the page loads, **Then** that
   sale contributes the amount the student actually paid, not the current price.
6. **Given** an instructor whose courses have never been bought, **When** the page loads, **Then** the page
   shows a "no earnings yet" state rather than three tiles reading $0.00.
7. **Given** an instructor with sales in earlier periods but none in the selected one, **When** the page
   loads, **Then** it shows a "nothing in this period" state that keeps the period filter usable, distinct
   from the "no earnings yet" state of Scenario 6.
8. **Given** a period in which every sale was refunded, **When** the page loads, **Then** total revenue and
   refunds both read that period's takings and net reads $0.00, shown as a real figure rather than as the
   "nothing in this period" state.
9. **Given** a course enrolled in for free by 200 students and never bought, **When** the page loads, **Then**
   none of the three tiles moves and the course is not listed in the table.

---

### User Story 2 - Change the period (Priority: P1)

The instructor switches between **All time**, **This year**, and **This month**. The tiles, the trend chart
and the per-course table all change together to describe the selected period, and it is always clear which
period is being shown.

**Why this priority**: The user description names the three periods as a requirement of the page, and without
them the tiles answer only one question. It is meaningless without User Story 1 but adds little weight to it,
and every other part of the page depends on it, so it ships in the first slice.

**Independent Test**: For an instructor with orders spread across the current month, earlier in the current
year, and in previous years, select each period in turn and confirm every tile, the chart and the table change
consistently under FR-004 and FR-015 – FR-015c, and that no part of the page describes a different period from
the rest.

**Acceptance Scenarios**:

1. **Given** the page is showing **This month**, **When** the instructor selects **This year**, **Then** the
   three tiles, the trend chart and the per-course table all update to the year-to-date period together, and
   the selected option is visibly marked.
2. **Given** orders from previous years, **When** **All time** is selected, **Then** they are included, and
   **When** **This year** is selected, **Then** they are excluded.
3. **Given** an order placed earlier this month, **When** **This month** is selected, **Then** it is included;
   **Given** an order placed last month, **When** **This month** is selected, **Then** it is excluded.
4. **Given** a period change is loading, **When** the new figures have not yet arrived, **Then** the page does
   not show a mix of values from the old and new periods.
5. **Given** any period, **When** the page is shown, **Then** exactly one of **All time**, **This year** and
   **This month** is marked selected, and no other period is offered.
6. **Given** a period is selected, **When** the instructor refreshes, navigates Back, or opens the same link
   again, **Then** the same period is restored.
7. **Given** a link carrying an unrecognised or missing period, **When** it is opened, **Then** the page shows
   **This month** without an error.
8. **Given** it is the first day of a new month and the instructor has made no sales yet that month, **When**
   the page opens at **This month**, **Then** it shows the "nothing in this period" state, and selecting
   **This year** shows the year's figures.

---

### User Story 3 - Read the revenue trend (Priority: P2)

Beneath the tiles, a bar chart shows how revenue moved across the selected period — day by day within a month,
month by month across a year or across all time — so the instructor can see whether they are growing.

**Why this priority**: The user description names the bar chart explicitly, and it is what turns three static
figures into a direction of travel. It is a reading aid over the tiles rather than a different capability, so
it can ship after User Stories 1 and 2 without changing them.

**Independent Test**: For an instructor with orders on known dates, select each period in turn and confirm the
number of bars, their boundaries, their values and the empty buckets under FR-016 – FR-021.

**Acceptance Scenarios**:

1. **Given** **This month** is selected, **When** the chart loads, **Then** it shows one bar per day from the
   first day of the current month through today, including days with no sales.
2. **Given** **This year** is selected, **When** the chart loads, **Then** it shows one bar per month from
   January through the current month, including months with no sales.
3. **Given** **All time** is selected, **When** the chart loads, **Then** it shows one bar per month from the
   month of the instructor's first counted order through the current month, with no month in between omitted.
4. **Given** a period in which nothing was sold, **When** the chart loads, **Then** it shows a "nothing in
   this period" state rather than a row of zero-height bars presented as data.
5. **Given** any period, **When** the instructor reads the chart, **Then** the bars' values add up to the
   figure named in FR-016, and each bar's period and amount are readable without relying on colour or on
   hovering alone.
6. **Given** a bucket whose every sale was refunded, **When** the chart loads, **Then** it reads $0.00 and is
   distinguishable from a bucket in which nothing was sold.
7. **Given** a sale made in January and refunded in February, **When** **This year** is selected, **Then** the
   January bucket carries the refund and the February bucket is untouched by it.
8. **Given** an instructor whose first sale was years ago, **When** **All time** is selected, **Then** the
   chart stays readable and the page does not scroll sideways.

---

### User Story 4 - See the breakdown per course (Priority: P1)

A table lists the instructor's courses, each with the number of sales it made in the period and the revenue it
brought in, so the instructor knows which course is earning and which is not.

**Why this priority**: The user description names the three columns explicitly, and this is the part of the
page an instructor can act on — the tiles say how much, the table says where it came from. It shares the
period filter with the tiles but is otherwise independent of the chart, so it ships in the first slice.

**Independent Test**: For an instructor owning several courses — including one with no sales in the period,
one that is unpublished but was sold before, and one whose only order was refunded — open the page at each
period and confirm the rows, their columns, their order and the totals under FR-022 – FR-029.

**Acceptance Scenarios**:

1. **Given** an instructor with sales across three courses, **When** the page loads, **Then** the table lists
   one row per course with the course's name, its number of sales and its revenue for the selected period.
2. **Given** the table has rows, **When** the instructor reads it, **Then** the rows are ordered by revenue,
   highest first.
3. **Given** the table has rows, **When** their revenue is added up, **Then** the sum equals the figure named
   in FR-027.
4. **Given** a course with no sales in the selected period, **When** the page loads, **Then** it is not
   listed, and **When** a longer period containing its sales is selected, **Then** it appears.
5. **Given** an unpublished course that was sold before it was unpublished, **When** the page loads at a
   period containing those sales, **Then** it is listed with them.
6. **Given** a course whose only purchase in the period was refunded, **When** the page loads, **Then** the
   course is still listed, reading "1 sale" with a revenue of $0.00, rather than disappearing from the table.
7. **Given** a course that has since been renamed, **When** the page loads, **Then** the row shows the
   course's current name.
8. **Given** a period in which no course sold anything, **When** the page loads, **Then** the table shows the
   "nothing in this period" state rather than an empty table with only headers.

---

### User Story 5 - Nobody reads another instructor's earnings (Priority: P1)

Only the instructor themselves can read their earnings. Another instructor, a student, or a signed-out visitor
is refused, whether they use the interface or address the page directly.

**Why this priority**: Discovery §15.4 names earnings as sensitive and reading another instructor's aggregates
as the biggest risk in the instructor read surface. Unlike reviews, none of these figures is public anywhere:
a leak here exposes a competitor's whole business.

**Independent Test**: Request the page and its data as the owning instructor, as a different instructor, as a
student, and while signed out, directly and without the interface, and confirm only the owner is served, under
FR-030 – FR-035.

**Acceptance Scenarios**:

1. **Given** an instructor with their own sales, **When** the page loads, **Then** every figure on it derives
   only from courses they own, and never from another instructor's course.
2. **Given** a signed-in instructor, **When** they request another instructor's earnings directly by any
   identifier, **Then** the request is refused and no amount, count or course name is returned.
3. **Given** a signed-in student, **When** they request the page or its data, **Then** the request is refused.
4. **Given** a signed-out visitor, **When** they open the address, **Then** they are sent to sign in and no
   earnings data is returned.
5. **Given** an instructor who also bought courses as a student, **When** the page loads, **Then** it never
   includes money they spent, only money their courses took in.
6. **Given** a staff account with no instructor profile, **When** it requests the page's data, **Then** it is
   refused cleanly with a meaningful message rather than an unhandled error.
7. **Given** any request, **When** it is served, **Then** it carries no buyer's name, email, payment method,
   card detail, receipt link or order identifier.

---

### Edge Cases

- **An instructor who has never sold anything.** Distinct from an instructor with sales outside the selected
  period: the first says earnings will appear once students enrol, the second says nothing happened in this
  period and offers a longer one. Neither shows $0.00 tiles presented as real figures.
- **An instructor who owns no courses at all.** Points them at creating a course, as the other instructor
  pages do, rather than at an empty earnings page.
- **Every sale in a period, bucket, or course was refunded.** Net is $0.00 — the floor, since a refund is
  attributed to the sale it reverses and never returns more than was paid. It must read as a real figure and
  stay distinguishable from "nothing was sold", which is a different thing entirely.
- **A free course.** Its enrolments are zero-amount orders: not sales, no revenue, no row. An instructor who
  only ever gives courses away sees the "no earnings yet" state, and finds their enrolments on the Students
  and Analytics pages instead.
- **A course sold once and refunded.** Reads "1 sale · $0.00" — the purchase happened, the money did not stay.
- **A course sold at one price, then repriced.** Historic orders keep the amount that was paid; the table's
  revenue never recomputes from the current price.
- **A course deleted after it was sold.** Its orders are removed with it, so its revenue leaves every figure,
  including **All time**. The page cannot show a row for a course that no longer exists.
- **A course renamed after it was sold.** One row, under the current name.
- **An order with no recorded date** (possible for the oldest rows, whose creation date was not captured). It
  cannot be placed in a period or a bucket; it must not break the page, and it must be treated consistently —
  counted in **All time** totals or in none, but never in some figures and not in others.
- **The month or year rolls over while the page is open.** The period is resolved when the page loads, so the
  figures change on the next load rather than under the instructor.
- **A refund issued for a sale made in an earlier period.** It lands on the earlier period, because a refund
  follows the sale it reverses (FR-010). A period an instructor already read can therefore be worth less the
  next time they look — accepted, and the price of revenue and refunds always describing the same sales. The
  platform's 14-day refund window bounds how far back a figure can move.
- **An instructor with dozens of courses.** The table lists only the courses with activity in the period, so
  the row count is bounded by what actually sold; it stays readable at every period.
- **An instructor whose first sale was several years ago.** **All time** produces many monthly buckets; the
  chart must stay legible and the page must not scroll sideways.
- **A very long course title.** Wraps or truncates visibly inside its cell without pushing the table sideways
  or hiding the sales and revenue columns.
- **Amounts large enough to need thousands separators.** Shown with separators and to the cent, consistently
  in tiles, chart and table.
- **A very narrow screen.** Every tile, every bar's value and every column of the table stays reachable
  without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

#### Page & layout

- **FR-001**: The instructor sidebar's **Earnings** item MUST open an earnings page covering every course the
  instructor owns, with the Earnings navigation item marked active, replacing today's placeholder.
- **FR-002**: The page MUST present, in order: a header carrying the page title and the period filter; the
  three money tiles; the revenue trend chart; and the per-course table.
- **FR-003**: The page MUST make clear that it describes all of the instructor's courses and which period is
  selected, so that no figure on it can be read without knowing its period.
- **FR-004**: Every figure on the page — each tile, every bar of the chart, and every row of the table — MUST
  describe the **same selected period**. A period change MUST update all of them together, and the page MUST
  NOT show one part of itself on the old period while another shows the new one.
- **FR-005**: The page MUST remain fully usable down to a 375px-wide viewport, with no horizontal page
  scrolling and no information made unreachable; tiles, chart and table MAY be restructured at narrow widths
  as long as every figure in FR-006 and every column in FR-022 stays reachable.

#### What counts as revenue

- **FR-006**: The page MUST show exactly three money tiles, labelled and in this order: **total revenue**,
  **refunds**, and **net**.
- **FR-007**: **Total revenue** MUST be the sum of the amounts of the counted sales of the instructor's
  courses in the selected period, where a **counted sale** is an order for one of their courses that was paid
  for, for an amount greater than zero — including an order that was later refunded.
- **FR-008**: An order that is **pending** or that **failed** MUST contribute nothing to any figure on this
  page.
- **FR-008a**: A **free enrolment** — an order of zero amount — MUST NOT be a counted sale and MUST contribute
  nothing to any figure on this page, including the sales count of FR-023.
- **FR-009**: A counted sale MUST contribute the amount that was actually paid for it, never the course's
  current price.
- **FR-010**: **Refunds** MUST be the sum of the amounts of the counted sales **in the selected period** that
  were refunded. A refund MUST be attributed to the **date of the sale it reverses**, not to the date the
  refund was issued, so that refunds and revenue always describe the same set of sales. The date a refund was
  issued MUST NOT determine which period, bucket, or course row it falls in.
- **FR-011**: **Net** MUST be exactly total revenue minus refunds for the selected period.
- **FR-011a**: Under FR-010, refunds can never exceed revenue in a period, a bucket, or a course row, so no
  amount on this page can legitimately be negative. The page MUST NOT present a negative figure as a normal
  state, and a period, bucket, or course whose counted sales were **all** refunded MUST read net **$0.00**
  while remaining distinguishable from one that had no sales at all (FR-021, FR-037).
- **FR-012**: Every amount on the page MUST be shown to the cent with its currency and with thousands
  separators, and MUST NOT be abbreviated (for example "$8.9k") anywhere it has to reconcile with another
  figure.
- **FR-013**: Figures MUST be computed from the orders themselves when the page loads, and the three tiles,
  the chart and the table MUST be internally consistent for the same period (FR-016, FR-027).
- **FR-014**: The **net** figure for **All time** MUST agree with the earnings tile on the instructor
  dashboard, so the two pages never contradict each other.

#### Period filter

- **FR-015**: The page MUST offer exactly three periods — **All time**, **This year**, and **This month** — of
  which exactly one is selected at a time, with the selection visibly marked.
- **FR-015a**: **This month** MUST mean from the first instant of the current calendar month to now; **This
  year** MUST mean from the first instant of 1 January of the current year to now; **All time** MUST mean
  every order ever made for the instructor's courses. All three MUST be interpreted in **UTC**, and the page
  MUST indicate that its dates are UTC.
- **FR-015b**: Opening the page from the sidebar MUST start at **This month**.
- **FR-015c**: The selected period MUST be part of the page's address, so refreshing, navigating
  Back/Forward, or opening a shared link restores it, without a full page reload when it changes. A period in
  the address that is missing or unrecognised MUST fall back to **This month** without showing an error.

#### Revenue trend

- **FR-016**: The revenue trend MUST be a bar chart of **net** revenue per time bucket across the selected
  period — each bucket's counted sales less the refunds attributed to them — and its bars MUST add up to the
  **net** tile of FR-006.
- **FR-017**: Buckets MUST be **daily** for **This month** (from the first day of the month through today)
  and **monthly** for **This year** (January through the current month) and for **All time** (from the month
  of the earliest counted order through the current month).
- **FR-018**: Every bucket in the period MUST be shown, including buckets with no activity, so that gaps are
  visible rather than silently closed up.
- **FR-019**: Bucket boundaries MUST be computed in **UTC**, so the same data yields the same chart for every
  viewer.
- **FR-020**: Each bar's period and amount MUST be readable without relying on colour alone and without
  requiring a pointer, so the chart is usable by assistive technology and on touch devices.
- **FR-021**: A bucket worth **$0.00 because every sale in it was refunded** MUST be distinguishable from a
  bucket in which nothing was sold, so that a refunded week does not read as a quiet one.

#### Per-course breakdown

- **FR-022**: The page MUST show a table with exactly three columns, labelled and in this order: the course's
  **name**, its **sales**, and its **revenue** for the selected period.
- **FR-023**: **Sales** MUST be the number of counted sales of that course in the period — the purchases made,
  **including** any that were later refunded, and **excluding** free enrolments (FR-008a). A course whose only
  purchase in the period was refunded therefore reads "1 sale" with a revenue of $0.00.
- **FR-024**: **Revenue** MUST be that course's **net** revenue for the period — its counted sales less the
  refunds attributed to them — computed under the same rules as the tiles (FR-007 – FR-011a).
- **FR-025**: The table MUST list only the instructor's courses with at least one counted sale in the selected
  period, and MUST include such a course whether it is published or not. A course with only free enrolments
  MUST NOT be listed.
- **FR-026**: Rows MUST be ordered by revenue, highest first, with a deterministic tie-break so the same
  period always produces the same order.
- **FR-027**: The revenue column MUST add up to the **net** tile for the same period, and the sales column
  MUST add up to the total number of counted sales in it — the same sales the **total revenue** tile is the
  value of.
- **FR-028**: A course MUST be shown under its **current** name.
- **FR-029**: The table MUST show every qualifying row for the period without paging, and MUST remain readable
  for an instructor with many courses.

#### Access & privacy

- **FR-030**: Every request for this page's data MUST require an authenticated instructor; students and
  signed-out visitors MUST be refused, and signed-out visitors MUST be sent to sign in.
- **FR-031**: Ownership MUST be enforced on the server for every request. Every figure MUST be derived only
  from orders for courses whose owner is the requesting instructor, and an identifier supplied by the client
  MUST never be trusted to widen that scope.
- **FR-032**: The page MUST NOT include money the instructor **spent** as a student, only money their courses
  took in.
- **FR-033**: The data behind this page MUST expose **only** the figures in FR-006, FR-016 and FR-022. It MUST
  NOT expose any buyer's identity, name, email or contact detail, any payment method, card detail, receipt
  link or gateway reference, or any individual order identifier.
- **FR-034**: A caller who passes the instructor gate but has no instructor profile MUST receive a meaningful
  refusal rather than an unhandled error.
- **FR-035**: The page MUST be **read-only**. No control on it may issue or reverse a refund, change a price,
  request or record a payout, or alter any order; and this feature MUST NOT add any way to contact a buyer.

#### States

- **FR-036**: An instructor whose courses have **never** been bought MUST see a "no earnings yet" state
  explaining that earnings appear once students enrol, rather than three tiles reading $0.00. An instructor
  whose courses have only ever been enrolled in for free MUST see this state too (FR-008a).
- **FR-037**: A selected period with **no counted sale**, for an instructor who has sold before, MUST show a
  distinct "nothing in this period" state that names the period, keeps the period filter usable, and is
  visibly different from the state of FR-036. A period that **did** contain counted sales MUST NOT show this
  state even when all of them were refunded and net is $0.00; it MUST show its real figures.
- **FR-038**: An instructor who owns **no courses at all** MUST see a state pointing them at creating one,
  distinct from both FR-036 and FR-037.
- **FR-039**: While the page or a period change is loading, the page MUST show a placeholder that preserves
  the layout, and MUST NOT show figures from the previous period as if they were the new result.
- **FR-040**: When the data fails to load, the page MUST show a plain message with a way to retry, MUST NOT
  show a raw technical error, and MUST leave the period filter in a state the instructor can recover from.
- **FR-041**: An order that cannot be placed in time because it has no recorded date MUST NOT break the page,
  and MUST be treated the same way by the tiles, the chart and the table, so they continue to agree.

### Key Entities *(include if feature involves data)*

- **Earnings summary (computed)**: The three figures describing one instructor and one period — total revenue,
  refunds, and net. Derived on read; never stored.
- **Revenue trend (computed)**: An ordered series of buckets covering the selected period, each with its
  boundaries and its amount, including buckets with no activity.
- **Course earnings row (computed)**: One owned course's name, its number of counted sales, and its revenue
  for the selected period.
- **Period (value)**: One of "all time", "this year", or "this month", resolved in UTC when the page loads.
- **Counted sale (derived)**: An order for one of the instructor's courses that was paid for, for an amount
  greater than zero, at the amount paid, attributed to its purchase date and to that course — whether or not
  it was later refunded.
- **Order (existing, referenced)**: Course, buyer, status (pending / paid / refunded / failed), amount,
  currency, creation date.
- **Transaction (existing, referenced)**: The record of a payment or a refund against an order — its status,
  amount and date.
- **Course (existing, referenced)**: Ownership, title, and publication state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An instructor can tell how much they earned this month, net of refunds, within 10 seconds of
  opening the Earnings page, and which course earned the most within 20 seconds.
- **SC-002**: Every one of the three tiles matches the underlying orders under FR-007 – FR-011 in 100% of
  verification cases, including periods containing refunded orders, pending and failed orders, free
  enrolments, repriced courses, and unpublished courses.
- **SC-003**: Net equals total revenue minus refunds in 100% of cases, and the all-time net equals the
  dashboard earnings tile in 100% of cases.
- **SC-004**: The chart's bars add up to the **net** tile, the table's revenue column adds up to the **net**
  tile, and the table's sales column adds up to the number of counted sales behind the **total revenue** tile,
  in 100% of verification cases, for all three periods.
- **SC-005**: Switching period changes every tile, the chart and the table together in 100% of cases; the page
  displays a mix of two periods 0 times.
- **SC-006**: The chart shows the bucket count and boundaries required by FR-017 in 100% of cases, and omits a
  bucket inside the period 0 times.
- **SC-007**: 100% of requests return only the caller's own courses' money, and 100% of requests from another
  instructor, a student, or a signed-out visitor are refused — verified independently of the interface.
  Another instructor's figures appear 0 times.
- **SC-008**: The data behind the page exposes a buyer's identity, contact details, payment method, receipt
  link, or order identifier 0 times.
- **SC-009**: A page with no data shows "$0.00" presented as a real figure 0 times, and the three empty states
  of FR-036 – FR-038 are distinguishable in 100% of cases.
- **SC-010**: Refreshing, navigating Back, or reopening a shared link restores the same period in 100% of
  cases; an unrecognised period in the address produces an error 0 times.
- **SC-011**: The page loads within the same responsiveness budget as the rest of the instructor shell for an
  instructor with 50 courses and 20,000 orders spanning 5 years, at every period.
- **SC-012**: The page renders without horizontal scrolling or clipped content at a 375px-wide viewport, with
  every tile, every bar's value and every table column reachable there.
- **SC-013**: A negative amount appears anywhere on the page 0 times, and a fully-refunded period, bucket or
  course reads its takings, the same figure in refunds, and $0.00 net in 100% of cases — shown as a real
  figure, and never as "nothing in this period".
- **SC-014**: A free enrolment moves a tile, a bucket, or a sales count 0 times, and a course with only free
  enrolments is listed 0 times.
- **SC-015**: A refund is counted under the period, bucket or course of the sale it reverses in 100% of
  verification cases, including refunds that cross a day, month and year boundary.

## Assumptions

- **The wireframe is the structural reference.** Layout follows the "Earnings" screen — a header carrying the
  title and the period chips; a row of three tiles (Total revenue / Refunds / Net); a "Revenue trend" bar
  chart; and a three-column table (Course / Sales / Revenue). The wireframe shows two chips (This month, This
  year); the user description adds **All time**, and "This month" stays the default as the wireframe marks it.
  Visual styling follows the existing design tokens, not the wireframe's greyscale.
- **One scope only: all of the instructor's courses.** The user description asks for a per-course
  *breakdown*, not a per-course *page*, and the course workspace tab bar (Overview · Curriculum · Analytics ·
  Students · Reviews) has no Earnings tab. Unlike specs 009, 010 and 012, this feature has a single page.
- **The instructor keeps the full amount.** No commission, platform fee, tax or payout deduction is modelled
  anywhere in the platform, so revenue is the full order amount. This is a record of what was collected for
  their courses, not a payout statement, and the page must not imply money has been or will be transferred.
- **One currency.** Every order is in USD, the only currency the platform accepts, so no conversion,
  multi-currency total, or per-currency split is needed. If a second currency is ever added, this page needs
  revisiting.
- **Refunds are whole-order.** A refund returns the full amount of one order within the platform's 14-day
  window; partial refunds do not exist. The figures therefore never have to represent a partly-refunded sale,
  and a refunded sale contributes its full amount to both revenue and refunds — which, with FR-010's
  attribution, is what makes $0.00 the floor for every figure on the page.
- **Free enrolments are not earnings.** They are recorded as paid orders of $0.00 and are excluded from every
  figure here, including the sales count. This deliberately differs from the dashboard and the Students page,
  which count a free enrolment as a student — it is a student, it is not a sale. An instructor who only gives
  courses away sees an empty Earnings page, by design.
- **Refunds stay an administrator action.** Instructors may read their refunds and may not cause or reverse
  one, consistent with discovery §11.5.
- **Unpublished courses are included.** A course can be unpublished after it has been sold; excluding it would
  make the tiles disagree with the table. This mirrors the same decision in spec 012.
- **No new earnings data is stored.** Both the summary and the breakdown are derived on read from existing
  orders, in line with discovery §13.7 (synchronous computation is acceptable at current scale). No caching or
  denormalisation is assumed.
- **Existing platform conventions carry over.** Ownership-scoped reads, direct payloads with no envelope, the
  instructor shell and its sidebar, the existing tile and table presentation, and the period-in-the-address
  pattern established by spec 009 are all reused as they stand.
- **UTC everywhere.** Periods, bucket boundaries and any date shown are UTC, so two instructors in different
  time zones reading the same page see the same figures — consistent with specs 009 and 012.
- **Chart presentation follows the project's dataviz conventions**, reusing what the analytics pages of spec
  009 established for bar charts rather than introducing a second chart style.

## Out of Scope

- **Payouts.** No payout, balance, payment schedule, bank detail, or "available to withdraw" figure exists in
  the platform, and none is introduced. The page reports collected revenue only.
- **Issuing or reversing refunds**, and anything else that changes an order. Refunds remain administrator-only.
- **A transaction list.** Discovery §7 mentions one under C10; this version shows aggregates only, and listing
  individual orders would expose buyer identity (FR-033). It is a later change if it is ever wanted.
- **Exporting or downloading a statement, invoice, or tax document.**
- **Per-course earnings inside the course workspace** (an Earnings tab beside Analytics and Students).
- **Custom date ranges, comparisons with a previous period, or forecasts.** Exactly three periods, no more.
- **Filtering the breakdown by course, or sorting it by another column.**
- **Revenue predictions, goals, or alerts**, and notifying an instructor when a sale or a refund happens.
- **Changing pricing, discounts, or coupons** — none of which this feature reads or writes.
- **Changing anything a student sees** — checkout, receipts, billing history and the refund window are
  untouched.
