import type { z } from "zod";
import type {
    BucketSchema,
    CompletionSchema,
    CourseAnalyticsSchema,
    CourseDropOffSchema,
    InstructorAnalyticsSchema,
    PeriodLabelSchema,
    QuizPassSchema,
    SectionDropOffSchema,
} from "../schemas/instructorAnalytics.schma";

export type CourseAnalytics = z.infer<typeof CourseAnalyticsSchema>;
export type InstructorAnalytics = z.infer<typeof InstructorAnalyticsSchema>;
export type Bucket = z.infer<typeof BucketSchema>;
export type CompletionStat = z.infer<typeof CompletionSchema>;
export type QuizPassStat = z.infer<typeof QuizPassSchema>;
export type SectionDropOff = z.infer<typeof SectionDropOffSchema>;
export type CourseDropOff = z.infer<typeof CourseDropOffSchema>;
export type PeriodLabel = z.infer<typeof PeriodLabelSchema>;

/** What travels in the page address and in the request. */
export type PeriodParam = "30" | "90" | "all";

export const PERIOD_OPTIONS: readonly { value: PeriodParam; label: string }[] = [
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
    { value: "all", label: "All time" },
] as const;

/**
 * FR-004a: an unrecognised or missing `?days=` falls back to 30 days silently. The API
 * itself is strict (a bad value is a 400), so this is the single place untyped address
 * input becomes a typed period.
 */
export function normalizePeriod(raw: string | null): PeriodParam {
    return raw === "90" || raw === "all" || raw === "30" ? raw : "30";
}

/**
 * Always computed from the counts, never from the rounded rate on the wire, so
 * "71% · 36 of 51" can never disagree with itself. Callers guarantee d > 0.
 */
export function percent(n: number, d: number): number {
    return Math.round((n / d) * 100);
}

/** The no-data label, which is never the same thing as a real 0% (FR-021, SC-005). */
export function emptyLabel(period: PeriodLabel): string {
    return period === "all" ? "No data yet" : "No data in this period";
}

const utc = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });

const dayFormat = utc({ month: "short", day: "numeric" });
const monthFormat = utc({ month: "short", year: "numeric" });

function asDate(iso: string): Date {
    return new Date(`${iso}T00:00:00Z`);
}

/** A day, a week range, or a month — all in UTC, because the buckets are (FR-011a). */
export function formatBucketLabel(bucket: Bucket, period: PeriodLabel): string {
    if (period === "all") return monthFormat.format(asDate(bucket.start));
    if (bucket.start === bucket.end) return dayFormat.format(asDate(bucket.start));
    return `${dayFormat.format(asDate(bucket.start))} – ${dayFormat.format(asDate(bucket.end))}`;
}

/** Cuts a long chart label, keeping the full text for the tooltip. */
export function truncate(text: string, max = 22): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
