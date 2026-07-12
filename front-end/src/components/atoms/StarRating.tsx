import { IoMdStar, IoMdStarOutline } from "react-icons/io";
import { cn } from "@/lib/utils";

interface StarRatingProps {
    rating: number;
    size?: number;
    className?: string;
}

function Star({ fill, size }: { fill: number; size: number }) {
    return (
        <span className="relative inline-flex" style={{ width: size, height: size }}>
            <IoMdStarOutline size={size} className="absolute inset-0 text-[#FACC15]" />
            <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
            >
                <IoMdStar size={size} className="text-[#FACC15]" />
            </span>
        </span>
    );
}

export function StarRating({ rating, size = 20, className }: StarRatingProps) {
    const clamped = Math.max(0, Math.min(5, rating));

    return (
        <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${clamped} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, index) => {
                const fill = Math.max(0, Math.min(1, clamped - index));
                return <Star key={index} fill={fill} size={size} />;
            })}
        </div>
    );
}
