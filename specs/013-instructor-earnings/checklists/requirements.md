# Specification Quality Checklist: Instructor Earnings

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-23
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Status: all items pass.** 46 functional requirements, 15 success criteria, 5 user stories.

Three open questions were resolved with the product owner on 2026-09-23 and recorded in the spec's
Clarifications section:

1. **Refund attribution (FR-010)** — a refund is counted under the **date of the sale it reverses**, never the
   date it was issued. Accepted consequence: a past period's figures can drop when a refund lands, bounded by
   the platform's 14-day refund window.
2. **Revenue trend (FR-016)** — the bars are **net** revenue per bucket and add up to the **Net** tile, so the
   chart, the tiles and the per-course table all reconcile.
3. **Free enrolments (FR-008a, FR-023)** — a zero-amount enrolment is **not** a sale and moves nothing on this
   page; a course that is only given away is not listed at all.

Two consequences of answer 1 were followed through the whole document rather than left implicit:

- **No figure can be negative (FR-011a).** Because a refund follows its own sale and never exceeds it, $0.00
  is the floor for the tiles, every bucket and every row. Requirements that previously described negative
  amounts now describe the real case instead: a period, bucket or course whose sales were **all** refunded
  reads $0.00 net and must stay distinguishable from one with no sales (FR-021, FR-037, SC-013).
- **Sales and revenue reconcile with different tiles (FR-027).** "Sales" counts purchases made, including
  later-refunded ones, so it matches the sales behind **total revenue**; the revenue column is net and matches
  **net**. A course sold once and refunded reads "1 sale · $0.00".

Ownership and privacy requirements (FR-030 – FR-035) are deliberately stronger than in spec 012, because no
figure on this page is public anywhere — a leak exposes a competitor's whole business.

Ready for `/speckit.plan`.
