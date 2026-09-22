"use client";

import { isAxiosError } from "axios";
import { NoInstructorProfileState, isNoInstructorProfileError } from "@/featuers/instructor-dashboard";
import { RosterPagination } from "@/components/molecules/RosterPagination";
import { useInstructorReviews } from "../hooks/useInstructorReviews";
import { useReviewParams } from "../hooks/useReviewParams";
import { REVIEWS_PAGE_SIZE, ratingFilterLabel } from "../types/instructorReviews.types";
import { RatingFilter } from "./RatingFilter";
import { ReviewCard } from "./ReviewCard";
import { ReviewsEmpty, ReviewsError, ReviewsSkeleton } from "./ReviewsStates";
import { ReviewsTiles } from "./ReviewsTiles";

interface ReviewsFeedProps {
    /** Present for the workspace tab, absent for the sidebar page. */
    courseId?: number;
    title: string;
    subtitle?: string;
    /**
     * True only when the instructor owns no courses at all, so the empty state can point
     * them at creating one rather than saying "no reviews yet" (FR-035). Only the
     * all-courses page can know this; the workspace tab is always inside a course.
     */
    ownsNoCourses?: boolean;
    headingClassName?: string;
}

/**
 * The feed itself, shared by both scopes (FR-003).
 *
 * `CourseReviews` and `InstructorReviews` are thin wrappers over this: the two pages
 * differ only in scope, copy, and whether the "no courses" state is reachable, so the
 * state decision below lives in exactly one place rather than being written twice and
 * drifting.
 */
export function ReviewsFeed({
    courseId,
    title,
    subtitle,
    ownsNoCourses = false,
    headingClassName = "text-xl",
}: ReviewsFeedProps) {
    const { rating, page, setRating, setPage } = useReviewParams();
    const query = useInstructorReviews({ courseId, rating, page });

    if (isNoInstructorProfileError(query.error)) {
        return <NoInstructorProfileState />;
    }

    // A course that isn't this instructor's is a 404 — identical to one that doesn't
    // exist, deliberately (FR-038), so the copy must not distinguish them either. The
    // workspace layout already renders "Course not found", so this adds nothing.
    const notFound = isAxiosError(query.error) && query.error.response?.status === 404;

    const stats = query.data?.stats;
    const count = query.data?.count ?? 0;
    const filtering = rating !== "all";

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className={`font-bold text-darktext ${headingClassName}`}>{title}</h1>
                    {subtitle && <p className="text-sm text-graytext2">{subtitle}</p>}
                </div>
                <RatingFilter value={rating} onChange={setRating} />
            </div>

            {query.isPending ? (
                // The skeleton replaces the tiles and the list on every fetch — including
                // a filter or page change — rather than leaving stale content on screen
                // (FR-043).
                <ReviewsSkeleton />
            ) : notFound ? null : query.isError || !query.data || !stats ? (
                <ReviewsError onRetry={() => void query.refetch()} />
            ) : stats.total_reviews === 0 ? (
                // Nothing has ever been reviewed in this scope. The tiles are deliberately
                // NOT rendered here: four "no reviews yet" figures say less than one clear
                // empty state, and FR-012 forbids showing 0.0 / 0% (FR-042).
                <ReviewsEmpty variant={ownsNoCourses ? "no-courses" : "no-reviews"} />
            ) : (
                <>
                    {/* Rendered whenever reviews exist — including under a filter that
                        matches none of them, because the tiles describe the whole scope
                        and must not move when the filter changes (FR-007). */}
                    <ReviewsTiles stats={stats} />

                    {count === 0 ? (
                        // total_reviews > 0 but count === 0: reviews exist, this filter
                        // matches none. This is precisely the signal contracts §4
                        // describes, and it is why the two empty states can be told apart
                        // at all (FR-026 vs FR-042).
                        <ReviewsEmpty
                            variant="no-matches"
                            filterLabel={filtering ? `${ratingFilterLabel(rating)} stars` : undefined}
                            onClearFilter={() => setRating("all")}
                        />
                    ) : (
                        <>
                            <div className="flex flex-col gap-4">
                                {query.data.results.map((review) => (
                                    <ReviewCard key={review.id} review={review} />
                                ))}
                            </div>
                            <RosterPagination
                                count={count}
                                page={page}
                                rows={query.data.results.length}
                                pageSize={REVIEWS_PAGE_SIZE}
                                hasNext={query.data.next !== null}
                                hasPrevious={query.data.previous !== null}
                                onPageChange={setPage}
                                label="reviews"
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
}
