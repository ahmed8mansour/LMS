import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarPlus, MessageSquare, Sparkles, Star } from "lucide-react";
import { avgRatingLabel, fiveStarRate } from "../types/instructorReviews.types";
import type { ReviewStats } from "../types/instructorReviews.types";

interface TileProps {
    label: string;
    icon: LucideIcon;
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

function Empty({ label }: { label: string }) {
    return <span className="text-lg text-graytext2">{label}</span>;
}

/**
 * The four summary tiles (FR-006 – FR-013).
 *
 * Two rules this component exists to hold:
 *
 * 1. **It receives `stats`, which describes the whole scope, and never `results`.** The
 *    star filter must not move these numbers (FR-007, SC-004) — passing anything derived
 *    from the visible rows would break that silently.
 * 2. **A figure is shown only when a real denominator exists.** With no reviews the tile
 *    says so in words: "0.0" and "0%" always mean zero out of something (FR-012, SC-008).
 *    Same rule as AnalyticsTiles in spec 009.
 */
export function ReviewsTiles({ stats }: { stats: ReviewStats }) {
    const empty = stats.total_reviews === 0;
    const noData = "No reviews yet";

    const avg = avgRatingLabel(stats);
    const rate = fiveStarRate(stats);

    return (
        <section aria-label="Rating summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile
                label="Avg rating"
                icon={Star}
                title={avg ?? noData}
                // One decimal always: an average of exactly 4 reads "4.0", not "4"
                // (spec Edge Cases).
                value={avg === null ? <Empty label={noData} /> : avg}
                secondary={avg === null ? undefined : "out of 5"}
            />
            <Tile
                label="Total reviews"
                icon={MessageSquare}
                title={`${stats.total_reviews}`}
                value={stats.total_reviews.toLocaleString("en-US")}
            />
            <Tile
                label="5-star"
                icon={Sparkles}
                title={rate === null ? noData : `${rate}%`}
                value={rate === null ? <Empty label={noData} /> : `${rate}%`}
                secondary={
                    rate === null
                        ? undefined
                        : `${stats.five_star_count.toLocaleString("en-US")} of ${stats.total_reviews.toLocaleString("en-US")}`
                }
            />
            <Tile
                label="This month"
                icon={CalendarPlus}
                title={`${stats.this_month_count}`}
                // Deliberately a plain count even when the scope is empty: "0" new
                // reviews this month is a true and useful statement, unlike "0.0" stars.
                value={empty ? <Empty label="—" /> : `+${stats.this_month_count.toLocaleString("en-US")}`}
            />
        </section>
    );
}
