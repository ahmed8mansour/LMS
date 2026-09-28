import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";
import { StarRating } from "@/components/atoms/StarRating";
import { formatReviewDate } from "../types/instructorReviews.types";
import type { ReviewRow } from "../types/instructorReviews.types";

/** Initials for the no-picture case (FR-016). */
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * One review (FR-014 – FR-019).
 *
 * Carries all six contracted fields: the reviewer's picture and name, the course title,
 * the stars, the comment, and the date it was last updated.
 *
 * The course title is rendered in BOTH scopes, so this component takes no "hide course"
 * prop. In the workspace tab that repeats the page header, and the spec's Assumptions
 * accept that redundancy in exchange for one row presentation serving both pages.
 */
export function ReviewCard({ review }: { review: ReviewRow }) {
    return (
        <article className="flex flex-col gap-3 rounded-xl border border-graytext/20 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-10 shrink-0 border border-graytext/15">
                        {review.reviewer.avatar && <AvatarImage src={review.reviewer.avatar} alt="" />}
                        {/* Radix falls back automatically when the image is absent OR
                            fails to load, so a removed Cloudinary asset shows initials
                            rather than a broken image (FR-016, spec Edge Cases). */}
                        <AvatarFallback className="bg-darkmint/10 text-xs font-semibold text-darkmint">
                            {initials(review.reviewer.name)}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex min-w-0 flex-col gap-1">
                        {/* Long and non-Latin names truncate visibly rather than pushing
                            the layout sideways; the full name stays on hover. */}
                        <span
                            className="min-w-0 truncate font-semibold text-darktext"
                            title={review.reviewer.name}
                        >
                            {review.reviewer.name}
                        </span>
                        {/* The StarRating atom, never hand-drawn stars: it already
                            carries role="img" with an "N out of 5 stars" label, which is
                            what FR-017 needs — the rating must not be legible by shape
                            alone. */}
                        <StarRating rating={review.rating} size={16} />
                    </div>
                </div>

                <div className="flex min-w-0 shrink-0 flex-col items-start gap-0.5 text-sm sm:items-end">
                    <span className="min-w-0 max-w-[16rem] truncate font-medium text-darktext" title={review.course.title}>
                        {review.course.title}
                    </span>
                    {/* A date, never a timestamp. formatReviewDate splits the string —
                        see its comment for why new Date() is wrong here. */}
                    <time className="text-graytext2" dateTime={review.updated_at}>
                        {formatReviewDate(review.updated_at)}
                    </time>
                </div>
            </div>

            {review.comment.trim() === "" ? (
                // An explicit line, never an empty block: a blank gap here reads as a
                // loading failure rather than as a student who wrote nothing (FR-018).
                <p className="text-sm italic text-graytext2">No comment written.</p>
            ) : (
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-darktext/90">
                    {review.comment}
                </p>
            )}
        </article>
    );
}
