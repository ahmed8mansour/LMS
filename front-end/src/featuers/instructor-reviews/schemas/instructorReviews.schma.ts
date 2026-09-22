import { z } from "zod";

/**
 * The instructor reviews response contract
 * (specs/012-instructor-reviews/contracts/instructor-reviews.md §2).
 *
 * Parsed, not cast: a payload that doesn't match throws on purpose, so the page shows its
 * error state instead of rendering missing values as blanks or zeros.
 */

export const ReviewStatsSchema = z.object({
    /**
     * Mean rating over the scope, or `null` when the scope holds no reviews.
     *
     * `.nullable()`, deliberately NOT `.optional()` with a default. Defaulting it to 0
     * would print "0.0" for a course nobody has reviewed, which FR-012 forbids — "no
     * reviews yet" and "rated zero" have to stay distinguishable at every call site, and
     * the only way to guarantee that is to make the null case unavoidable.
     */
    avg_rating: z.number().nullable(),
    /** Reviews in the scope. NOT the length of `results`, and NOT the page's `count`. */
    total_reviews: z.number(),
    /**
     * Reviews rated 5. A count, not a percentage — the client divides, so that a scope
     * with no reviews never reaches a division at all (research R6).
     */
    five_star_count: z.number(),
    /** Reviews CREATED since the first instant of the current UTC calendar month. */
    this_month_count: z.number(),
});

export const ReviewerRefSchema = z.object({
    /** First + last name, falling back to username. Never blank (FR-015). */
    name: z.string(),
    /** `null` when absent or empty — the client has one absent case to handle. */
    avatar: z.string().nullable(),
});

export const ReviewCourseRefSchema = z.object({
    id: z.number(),
    title: z.string(),
});

export const ReviewRowSchema = z.object({
    /**
     * The REVIEW id. Unique per row in both scopes — `Review` is unique per
     * (student, course), so unlike spec 010's roster nothing repeats here.
     */
    id: z.number(),
    rating: z.number(),
    /**
     * `""` when the student wrote none — never `null`. The model is `blank=True`, not
     * nullable, and the empty string is what the card turns into an explicit
     * "no comment" line rather than a gap (FR-018).
     */
    comment: z.string(),
    /** "YYYY-MM-DD". A date, NOT a timestamp — never pass it to `new Date()`. */
    updated_at: z.string(),
    reviewer: ReviewerRefSchema,
    /** Always present, in both scopes. The card always renders it (spec Assumptions). */
    course: ReviewCourseRefSchema,
});

export const ReviewsPageSchema = z.object({
    /**
     * Describes the WHOLE scope and is unaffected by the star filter (FR-007), so it is
     * not interchangeable with `count` below: under `?rating=4` they legitimately differ,
     * and that difference is what tells "no reviews match this filter" from "no reviews
     * yet" (contracts §4).
     */
    stats: ReviewStatsSchema,
    /** Reviews matching scope + filter — not the length of `results`. */
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(ReviewRowSchema),
});
