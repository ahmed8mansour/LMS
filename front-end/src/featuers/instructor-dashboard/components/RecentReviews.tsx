import Link from "next/link";
import { StarRating } from "@/components/atoms/StarRating";
import type { RecentReview } from "../types/instructorDashboard.types";
import { formatDate } from "../types/instructorDashboard.types";

interface RecentReviewsProps {
    reviews: RecentReview[];
}

/**
 * The newest reviews across the instructor's courses (FR-010, FR-011). Read-only:
 * instructors can't reply to, report, or remove reviews anywhere in the product.
 * The server sends the full comment; truncation is a line clamp here (research R7).
 */
export function RecentReviews({ reviews }: RecentReviewsProps) {
    return (
        <section aria-labelledby="recent-reviews-title" className="rounded-xl border border-graytext/20 bg-white p-5 shadow-sm">
            <h2 id="recent-reviews-title" className="mb-3 text-lg font-semibold text-darktext">
                Recent reviews
            </h2>

            {reviews.length === 0 ? (
                <div className="rounded-lg bg-lightbg p-4">
                    <p className="font-semibold text-darktext">No reviews yet</p>
                    <p className="text-sm text-graytext2">Reviews students leave on your courses will appear here.</p>
                </div>
            ) : (
                <ul className="flex flex-col divide-y divide-graytext/15">
                    {reviews.map((review) => (
                        <li key={review.id} className="flex flex-col gap-1.5 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <StarRating rating={review.rating} size={14} />
                                <time dateTime={review.created_at} className="text-xs text-graytext2">
                                    {formatDate(review.created_at)}
                                </time>
                            </div>
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-sm">
                                <span className="truncate font-semibold text-darktext" title={review.reviewer.name}>
                                    {review.reviewer.name}
                                </span>
                                <Link
                                    href={`/instructor/courses/${review.course.id}`}
                                    className="min-w-0 truncate text-graytext2 hover:text-darkmint hover:underline"
                                    title={review.course.title}
                                >
                                    {review.course.title}
                                </Link>
                            </div>
                            {review.comment.trim() !== "" && (
                                <p className="line-clamp-2 break-words text-sm text-darktext">{review.comment}</p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
