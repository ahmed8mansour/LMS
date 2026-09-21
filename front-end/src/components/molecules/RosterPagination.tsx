"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RosterPaginationProps {
    /** Total matching rows — from the server, never `rows.length`. */
    count: number;
    /** 1-based current page. */
    page: number;
    /** Rows on the current page, used for the position label's upper bound. */
    rows: number;
    pageSize: number;
    /** Driven by the server's `next` / `previous` being non-null, not by arithmetic. */
    hasNext: boolean;
    hasPrevious: boolean;
    onPageChange: (next: number) => void;
    /** Plural noun for the position label, e.g. "students", "reviews". */
    label?: string;
}

/**
 * Numbered paging for a server-paginated list.
 *
 * Lives in `molecules/` rather than inside a feature because no pagination component
 * existed anywhere in the project, and specs 012 (reviews) and 013 (earnings) will want
 * the same one — so its props carry no roster vocabulary.
 *
 * The position and the control states both come from the server: `count` for the total
 * and `hasNext`/`hasPrevious` for the arrows. Computing page counts client-side from
 * `rows.length` drifts the moment the page size changes or a row disappears mid-session.
 */
export function RosterPagination({
    count,
    page,
    rows,
    pageSize,
    hasNext,
    hasPrevious,
    onPageChange,
    label = "results",
}: RosterPaginationProps) {
    if (count === 0) return null;

    const from = (page - 1) * pageSize + 1;
    const to = from + rows - 1;
    // A single page still states its position, but shows no control that would do
    // nothing when clicked.
    const paged = hasNext || hasPrevious;

    const buttonClass = (enabled: boolean) =>
        cn(
            "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
            enabled
                ? "border-graytext/25 text-darktext hover:border-darkmint hover:text-darkmint"
                : "cursor-not-allowed border-graytext/15 text-graylighttext",
        );

    return (
        <nav
            aria-label="Pagination"
            className="flex flex-wrap items-center justify-between gap-3"
        >
            <p className="text-sm text-graytext2 tabular-nums" aria-live="polite">
                {count === 1 ? (
                    <>1 {label.replace(/s$/, "")}</>
                ) : (
                    <>
                        {from.toLocaleString("en-US")}&ndash;{to.toLocaleString("en-US")} of{" "}
                        <span className="font-semibold text-darktext">{count.toLocaleString("en-US")}</span>{" "}
                        {label}
                    </>
                )}
            </p>

            {paged && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onPageChange(page - 1)}
                        disabled={!hasPrevious}
                        className={buttonClass(hasPrevious)}
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        Previous
                    </button>
                    <button
                        type="button"
                        onClick={() => onPageChange(page + 1)}
                        disabled={!hasNext}
                        className={buttonClass(hasNext)}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            )}
        </nav>
    );
}
