"use client";
import { useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useCourseReviews } from "../../hooks/useCourseReviews";
import { Skeleton } from "@/components/atoms/skeleton";
import ReviewCard from "./ReviewCard";

function ReviewCardSkeleton() {
    return (
        <div className="min-w-[320px] flex-1 bg-white p-6 rounded-xl border border-graylighttext/30 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-20 rounded" />
                </div>
            </div>
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <Skeleton className="h-3 w-16" />
        </div>
    );
}

export default function ReviewCarouselSection({ course_id }: { course_id: number }) {
    const [page, setPage] = useState(1);
    const { data: reviewsPage, isLoading, isError, refetch } = useCourseReviews(course_id, page);

    if (isError) {
        return (
            <section>
                <h3 className="text-xl font-bold text-darktext mb-6">Student feedback</h3>
                <div className="flex flex-col items-center justify-center gap-3 py-10 bg-white rounded-xl border border-graylighttext/30">
                    <p className="text-sm text-graytext2">Couldn&apos;t load student feedback</p>
                    <button
                        onClick={() => refetch()}
                        className="bg-darkmint hover:bg-darkmint/90 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section>
                <h3 className="text-xl font-bold text-darktext mb-6">Student feedback</h3>
                <div className="flex gap-6 overflow-hidden pb-4">
                    <ReviewCardSkeleton />
                    <ReviewCardSkeleton />
                </div>
            </section>
        );
    }

    if ((reviewsPage?.results.length ?? 0) === 0) {
        return (
            <section>
                <h3 className="text-xl font-bold text-darktext mb-6">Student feedback</h3>
                <div className="text-center py-12 bg-white rounded-xl border border-graylighttext/30">
                    <h4 className="text-lg font-semibold text-darktext mb-2">No reviews yet</h4>
                    <p className="text-graytext2">Be the first to share your experience with this course!</p>
                </div>
            </section>
        );
    }

    return (
        <section>
            <h3 className="text-xl font-bold text-darktext mb-6">Student feedback</h3>
            <div className="relative group">
                <div className="flex gap-6 overflow-hidden pb-4 flex-wrap">
                    {reviewsPage?.results.map((review) => (
                        <ReviewCard key={review.id} review={review} />
                    ))}
                </div>
                <div className="flex justify-center gap-4 mt-4">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        aria-label="Previous reviews"
                        className="size-10 rounded-full border border-graylighttext/40 flex items-center justify-center text-darktext hover:bg-darkmint hover:text-white hover:border-darkmint transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <FaChevronLeft size={14} />
                    </button>
                    <button
                        type="button"
                        disabled={!reviewsPage?.next}
                        onClick={() => setPage((p) => p + 1)}
                        aria-label="Next reviews"
                        className="size-10 rounded-full border border-graylighttext/40 flex items-center justify-center text-darktext hover:bg-darkmint hover:text-white hover:border-darkmint transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                        <FaChevronRight size={14} />
                    </button>
                </div>
            </div>
        </section>
    );
}
