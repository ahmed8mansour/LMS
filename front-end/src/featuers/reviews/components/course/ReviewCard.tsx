import { FaQuoteRight } from "react-icons/fa";
import { StarRating } from "@/components/atoms/StarRating";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";
import { Review } from "../../types/reviews.types";

export default function ReviewCard({ review }: { review: Review }) {
    const initials = review.student_name?.slice(0, 2).toUpperCase() ?? "?";

    return (
        <div className="min-w-[320px] flex-1 md:max-w-1/2 bg-white p-6 rounded-xl border border-graylighttext/30 shadow-sm relative">
            <FaQuoteRight className="absolute top-4 right-4 text-darkmint/10 text-3xl" />
            <div className="flex items-center gap-3 mb-4">
                <Avatar className="size-12">
                    <AvatarImage src={review.student_avatar ?? undefined} alt={review.student_name} />
                    <AvatarFallback className="bg-lightmint text-darkmint font-bold">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="font-bold text-sm text-darktext">{review.student_name}</span>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase tracking-wider w-fit">
                        Verified Learner
                    </span>
                </div>
            </div>
            <StarRating rating={review.rating} size={20} className="mb-3" />
            {review.comment && (
                <p className="text-sm text-graytext2 leading-relaxed mb-4 italic">
                    &quot;{review.comment}&quot;
                </p>
            )}
            <span className="text-xs text-graylighttext">{review.created_at.split("T")[0]}</span>
        </div>
    );
}
