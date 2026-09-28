import { z } from "zod";

// Parsing is load-bearing: a body that doesn't match the contract throws in the API
// function and becomes the page's error state, instead of rendering a missing figure as
// $0.00 or a missing series as an empty chart.

/**
 * Money arrives as a quantised decimal string — "0.00", "4120.00" — never a JSON number.
 * JSON has one numeric type and it is a float; cents do not survive it, and this page's
 * whole claim is that its columns add up to its tiles.
 *
 * The regex does three of this feature's invariants in one line: it rejects a float
 * (12.5), a bare integer (12), and a negative (-12.00). Nothing on this page can
 * legitimately be below zero — a refund is attributed to the sale it reverses and never
 * exceeds it, so $0.00 is the floor (FR-011a, SC-013). A negative here is a server bug,
 * and this is where it should stop.
 */
const money = z.string().regex(/^\d+\.\d{2}$/, "expected a decimal string with two places");

const count = z.number().int().min(0);
const isoDate = z.string();

export const PeriodSchema = z.enum(["month", "year", "all"]);

export const EarningsWindowSchema = z.object({
    // null only for "all time" with no sales at all.
    start: isoDate.nullable(),
    end: isoDate,
});

export const EarningsStatsSchema = z.object({
    total_revenue: money,
    refunds: money,
    net: money,
    sales: count,
});

export const TrendBucketSchema = z.object({
    start: isoDate,
    end: isoDate,
    // Named `amount`, not `count` as the analytics bucket is: one key meaning "integer"
    // in one endpoint and "decimal string" in another is how a shared label formatter
    // starts rendering $NaN (research P5).
    amount: money,
});

export const CourseEarningsSchema = z.object({
    id: z.number().int(),
    title: z.string(),
    sales: count,
    revenue: money,
});

export const EarningsSnapshotSchema = z.object({
    period: PeriodSchema,
    window: EarningsWindowSchema,
    currency: z.literal("USD"),
    stats: EarningsStatsSchema,
    trend: z.array(TrendBucketSchema),
    courses: z.array(CourseEarningsSchema),
    courses_count: count,
    has_sales_ever: z.boolean(),
});
