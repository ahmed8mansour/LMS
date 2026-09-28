import type { z } from "zod";
import type {
    ReviewCourseRefSchema,
    ReviewRowSchema,
    ReviewStatsSchema,
    ReviewerRefSchema,
    ReviewsPageSchema,
} from "../schemas/instructorReviews.schma";

/**
 * Inferred from the Zod schemas, never written in parallel, so the runtime contract and
 * the compile-time types cannot drift (Constitution I).
 */

export type ReviewStats = z.infer<typeof ReviewStatsSchema>;
export type ReviewerRef = z.infer<typeof ReviewerRefSchema>;
export type ReviewCourseRef = z.infer<typeof ReviewCourseRefSchema>;
export type ReviewRow = z.infer<typeof ReviewRowSchema>;
export type ReviewsPage = z.infer<typeof ReviewsPageSchema>;

/** The three filter options, and nothing else (FR-021). */
export type RatingFilter = "all" | "5" | "4";

/** What the feed is scoped to: one owned course, or every owned course. */
export interface ReviewsQuery {
    courseId?: number;
    rating: RatingFilter;
    page: number;
}

/**
 * The single source of the filter chips.
 *
 * `RatingFilter.tsx` renders from this and `useReviewParams` validates against it, so
 * "exactly three options" is structural rather than a convention two files have to agree
 * on independently. Adding a fourth entry here is the only way to add a fourth chip —
 * which is deliberately a spec change, not a UI tweak.
 */
export const RATING_OPTIONS: ReadonlyArray<{ value: RatingFilter; label: string }> = [
    { value: "all", label: "All ratings" },
    { value: "5", label: "5" },
    { value: "4", label: "4" },
] as const;

/** Reviews per page — fixed by the server (FR-028); mirrored here only to label positions. */
export const REVIEWS_PAGE_SIZE = 10;

/** Narrows an arbitrary string from the address to a filter, falling back to "all". */
export function parseRatingFilter(raw: string | null): RatingFilter {
    // Everything unrecognised resolves to "all" — including "3", which the server also
    // treats as unrecognised (research R11). Honouring it would leave the page in a
    // state its own three chips cannot display or clear (FR-027).
    const match = RATING_OPTIONS.find((option) => option.value === raw);
    return match ? match.value : "all";
}

/** The label of the active filter, for the "no reviews match" state (FR-026). */
export function ratingFilterLabel(rating: RatingFilter): string {
    const match = RATING_OPTIONS.find((option) => option.value === rating);
    return match ? match.label : "All ratings";
}

/**
 * Format `updated_at` for display.
 *
 * By splitting the string, never by constructing a `Date`. `new Date("2026-07-14")` is
 * parsed as UTC midnight, so `.toLocaleDateString()` renders **13 July** anywhere west of
 * Greenwich — which would break FR-019's promise that every viewer sees the same date for
 * the same review.
 */
export function formatReviewDate(value: string): string {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;

    const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const label = monthNames[Number(month) - 1];
    if (!label) return value;

    return `${label} ${Number(day)}, ${year}`;
}

/** True when the scope holds at least one review — the "no reviews yet" gate (FR-042). */
export function hasReviews(stats: ReviewStats | undefined): boolean {
    return (stats?.total_reviews ?? 0) > 0;
}

/**
 * The 5-star rate as a whole percent, or `null` when there is nothing to divide.
 *
 * Returning `null` rather than 0 is the point: with no reviews there is no denominator,
 * and printing "0%" would say the instructor has no 5-star reviews when in fact they have
 * no reviews at all (FR-012, SC-008). The tile renders `null` as a neutral label.
 */
export function fiveStarRate(stats: ReviewStats): number | null {
    if (stats.total_reviews === 0) return null;
    return Math.round((stats.five_star_count / stats.total_reviews) * 100);
}

/**
 * The average, to one decimal, or `null` for an empty scope.
 *
 * Always one decimal: an average of exactly 4 must read "4.0", not "4" (spec Edge Cases).
 * The server already rounds; `.toFixed(1)` here is about the trailing zero, not precision.
 */
export function avgRatingLabel(stats: ReviewStats): string | null {
    if (stats.avg_rating === null) return null;
    return stats.avg_rating.toFixed(1);
}
