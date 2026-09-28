import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface StatTileProps {
    label: string;
    icon: LucideIcon;
    /** Plain-text version of the value, used as a tooltip when the value is truncated. */
    title: string;
    value: ReactNode;
    secondary?: ReactNode;
}

/**
 * The summary tile shared by the instructor dashboard (008), analytics (009) and
 * earnings (013).
 *
 * It was inlined, twice, with byte-comparable markup in `SummaryTiles.tsx` and
 * `AnalyticsTiles.tsx` before spec 013 needed a third. Extracted verbatim rather than
 * copied a third time: the three tile rows are meant to look identical, and three
 * copies make that true only until the first edit to one of them (research P4, R11).
 *
 * Nothing here is feature-specific. A tile that needs its own behaviour composes this
 * one or renders its own value — it does not grow a flag on this component.
 */
export function StatTile({ label, icon: Icon, title, value, secondary }: StatTileProps) {
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
