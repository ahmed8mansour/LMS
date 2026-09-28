import { BookOpen, DollarSign, Star, Users } from "lucide-react";
import { StarRating } from "@/components/atoms/StarRating";
// Was an inlined local `Tile` until spec 013 needed a third copy of it. The markup is
// unchanged; it now lives in molecules so the dashboard, analytics and earnings tile
// rows stay identical by construction rather than by three people remembering.
import { StatTile as Tile } from "@/components/molecules/StatTile";
import type { DashboardSnapshot } from "../types/instructorDashboard.types";
import { formatMoney } from "../types/instructorDashboard.types";

type SummaryTilesProps = Pick<DashboardSnapshot, "courses" | "students" | "rating" | "earnings">;

function plural(count: number, word: string): string {
    return `${count.toLocaleString("en-US")} ${word}${count === 1 ? "" : "s"}`;
}

/** The four lifetime tiles (FR-004–FR-008). Values are rendered exactly as received. */
export function SummaryTiles({ courses, students, rating, earnings }: SummaryTilesProps) {
    const money = formatMoney(earnings.amount, earnings.currency);

    return (
        <section aria-label="Summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile
                label="Courses"
                icon={BookOpen}
                title={String(courses.total)}
                value={courses.total.toLocaleString("en-US")}
                secondary={`${courses.published.toLocaleString("en-US")} published`}
            />
            <Tile
                label="Students"
                icon={Users}
                title={String(students.distinct)}
                value={students.distinct.toLocaleString("en-US")}
                secondary={plural(students.enrollments, "enrollment")}
            />
            {rating.avg_rating !== null ? (
                <Tile
                    label="Avg rating"
                    icon={Star}
                    title={rating.avg_rating.toFixed(1)}
                    value={
                        <span className="flex items-center gap-2">
                            {rating.avg_rating.toFixed(1)}
                            <StarRating rating={rating.avg_rating} size={16} />
                        </span>
                    }
                    secondary={plural(rating.reviews_count, "review")}
                />
            ) : (
                // Never "0": an instructor with no reviews on published courses is unrated,
                // which is what their public profile says too (FR-006).
                <Tile label="Avg rating" icon={Star} title="Not yet rated" value={<span className="text-lg">Not yet rated</span>} />
            )}
            <Tile label="Earnings" icon={DollarSign} title={money} value={money} secondary="Lifetime" />
        </section>
    );
}
