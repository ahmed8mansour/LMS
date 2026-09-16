import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpen, DollarSign, Star, Users } from "lucide-react";
import { StarRating } from "@/components/atoms/StarRating";
import type { DashboardSnapshot } from "../types/instructorDashboard.types";
import { formatMoney } from "../types/instructorDashboard.types";

type SummaryTilesProps = Pick<DashboardSnapshot, "courses" | "students" | "rating" | "earnings">;

interface TileProps {
    label: string;
    icon: LucideIcon;
    /** Plain-text version of the value, used as a tooltip when the value is truncated. */
    title: string;
    value: ReactNode;
    secondary?: ReactNode;
}

function Tile({ label, icon: Icon, title, value, secondary }: TileProps) {
    return (
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-graytext/20 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-graytext2">{label}</span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-darkmint/10 text-darkmint">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
            </div>
            <div className="truncate text-2xl font-bold text-darktext" title={title}>
                {value}
            </div>
            {secondary && <div className="truncate text-sm text-graytext2">{secondary}</div>}
        </div>
    );
}

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
