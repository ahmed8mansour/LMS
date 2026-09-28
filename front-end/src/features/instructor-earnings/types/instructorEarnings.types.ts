import type { z } from "zod";
import type {
    CourseEarningsSchema,
    EarningsSnapshotSchema,
    EarningsStatsSchema,
    EarningsWindowSchema,
    PeriodSchema,
    TrendBucketSchema,
} from "../schemas/instructorEarnings.schma";

export type EarningsSnapshot = z.infer<typeof EarningsSnapshotSchema>;
export type EarningsStats = z.infer<typeof EarningsStatsSchema>;
export type EarningsWindow = z.infer<typeof EarningsWindowSchema>;
export type TrendBucket = z.infer<typeof TrendBucketSchema>;
export type CourseEarnings = z.infer<typeof CourseEarningsSchema>;

/** What travels in the page address and in the request. */
export type PeriodParam = z.infer<typeof PeriodSchema>;

export const PERIOD_OPTIONS: readonly { value: PeriodParam; label: string }[] = [
    { value: "month", label: "This month" },
    { value: "year", label: "This year" },
    { value: "all", label: "All time" },
] as const;

export const DEFAULT_PERIOD: PeriodParam = "month";

/**
 * FR-015c: an unrecognised or missing `?period=` falls back to This month silently. The
 * API itself is strict (a bad value is a 400), so this is the single place untyped
 * address input becomes a typed period — and the reason a stale bookmark shows a page
 * instead of an error.
 */
export function normalizePeriod(raw: string | null): PeriodParam {
    return raw === "year" || raw === "all" || raw === "month" ? raw : DEFAULT_PERIOD;
}

export function periodLabel(period: PeriodParam): string {
    return PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "This month";
}

/** Lower-case, for mid-sentence use: "Nothing sold in this month." */
export function periodPhrase(period: PeriodParam): string {
    return period === "all" ? "at any time" : `in ${periodLabel(period).toLowerCase()}`;
}

/**
 * Money is shown exactly — $8,940.00, never $8.9k — because every figure on this page
 * has to reconcile with another one (FR-012).
 *
 * The amount is a STRING on the wire and stays one until this line; `Number()` here is
 * the last possible moment and only for formatting.
 */
export function formatMoney(amount: string, currency: string = "USD"): string {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}

const utc = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });

const dayFormat = utc({ month: "short", day: "numeric" });
const monthFormat = utc({ month: "short", year: "numeric" });
const fullFormat = utc({ month: "short", day: "numeric", year: "numeric" });

function asDate(iso: string): Date {
    return new Date(`${iso}T00:00:00Z`);
}

/** A day (This month) or a month (This year, All time) — in UTC, because the buckets are. */
export function formatBucketLabel(bucket: { start: string; end: string }, period: PeriodParam): string {
    return period === "month" ? dayFormat.format(asDate(bucket.start)) : monthFormat.format(asDate(bucket.start));
}

/** "Sep 1, 2026 – Sep 23, 2026 · UTC" for the header caption (FR-015a). */
export function formatWindow(window: EarningsWindow): string {
    const end = fullFormat.format(asDate(window.end));
    return window.start ? `${fullFormat.format(asDate(window.start))} – ${end}` : end;
}
