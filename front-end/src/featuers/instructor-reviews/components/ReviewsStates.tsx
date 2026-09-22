import Link from "next/link";
import { AlertTriangle, FilterX, MessageSquare, RotateCw, Star } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";

/**
 * The non-list states of the reviews feed (T020).
 *
 * Kept in one file because they are variants of the same idea and always change together.
 */

/**
 * Preserves the layout while a feed, a filter change, or a page change loads, so nothing
 * jumps when real content arrives (FR-043).
 *
 * It REPLACES the tiles and cards rather than dimming them: showing the previous filter's
 * numbers and rows during a fetch is exactly what FR-043 forbids. This is also why
 * `useInstructorReviews` refuses `keepPreviousData`.
 */
export function ReviewsSkeleton({ cards = 4 }: { cards?: number }) {
    return (
        <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading reviews</span>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex flex-col gap-3 rounded-xl border border-graytext/20 bg-white p-5 shadow-sm"
                    >
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-16" />
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-4">
                {Array.from({ length: cards }).map((_, index) => (
                    <div
                        key={index}
                        className="flex flex-col gap-3 rounded-xl border border-graytext/20 bg-white p-4 shadow-sm sm:p-5"
                    >
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <Skeleton className="ml-auto h-3 w-28 shrink-0" />
                        </div>
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/5" />
                    </div>
                ))}
            </div>

            <Skeleton className="h-4 w-48" />
        </div>
    );
}

/** FR-044: a plain message and a retry, never a raw technical error. */
export function ReviewsError({ onRetry }: { onRetry: () => void }) {
    return (
        <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">We couldn&apos;t load your reviews</h2>
                <p className="text-sm text-graytext2">Check your connection and try again.</p>
            </div>
            <Button onClick={onRetry} className="bg-darkmint text-white hover:bg-darkmint/90">
                <RotateCw className="h-4 w-4" />
                Retry
            </Button>
        </div>
    );
}

export type ReviewsEmptyVariant = "no-reviews" | "no-matches" | "no-courses";

interface ReviewsEmptyProps {
    variant: ReviewsEmptyVariant;
    /** The active filter's label, for the "no-matches" variant. */
    filterLabel?: string;
    onClearFilter?: () => void;
}

/**
 * The empty states.
 *
 * `no-matches` is deliberately a different shape from `no-reviews` — FR-026 requires them
 * to be distinguishable, because "nobody has reviewed this yet" and "no review carries
 * this rating" call for completely different next actions, and only the second one has
 * anything to clear. `no-courses` exists so a brand-new instructor is pointed at creating
 * a course instead of shown a blank feed (FR-035).
 */
export function ReviewsEmpty({ variant, filterLabel, onClearFilter }: ReviewsEmptyProps) {
    if (variant === "no-matches") {
        return (
            <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkbg text-graytext2">
                    <FilterX className="h-7 w-7" />
                </div>
                <div className="flex max-w-md flex-col gap-1.5">
                    <h2 className="text-xl font-bold text-darktext">No reviews match this filter</h2>
                    <p className="text-sm text-graytext2">
                        Nothing is rated{" "}
                        <span className="font-semibold text-darktext">{filterLabel}</span> here. Clear the
                        filter to see every review.
                    </p>
                </div>
                {onClearFilter && (
                    <Button onClick={onClearFilter} className="bg-darkmint text-white hover:bg-darkmint/90">
                        Clear filter
                    </Button>
                )}
            </div>
        );
    }

    if (variant === "no-courses") {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                    <Star className="h-7 w-7" />
                </div>
                <div className="flex max-w-md flex-col gap-1.5">
                    <h2 className="text-xl font-bold text-darktext">No reviews yet</h2>
                    <p className="text-sm text-graytext2">
                        You don&apos;t have any courses yet. Create one, and the reviews your students leave
                        will appear here.
                    </p>
                </div>
                <Link
                    href="/instructor/courses/new"
                    className="rounded-lg bg-darkmint px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-darkmint/90"
                >
                    Create your first course
                </Link>
            </div>
        );
    }

    return (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                <MessageSquare className="h-7 w-7" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">No reviews yet</h2>
                <p className="text-sm text-graytext2">
                    Students can review a course once they finish it. Their feedback will appear here.
                </p>
            </div>
        </div>
    );
}
