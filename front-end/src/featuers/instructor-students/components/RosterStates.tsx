import Link from "next/link";
import { AlertTriangle, RotateCw, SearchX, Users } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";

/**
 * The three non-table states of a roster (T019).
 *
 * Kept in one file because they are variants of the same idea and always change together.
 */

/**
 * Preserves the layout while a roster, a search, or a page loads, so nothing jumps when
 * real rows arrive (FR-036). It replaces the table rather than dimming it: showing the
 * previous page's rows during a fetch is exactly what FR-036 forbids.
 */
export function RosterSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
            <span className="sr-only">Loading students</span>
            <div className="rounded-xl border border-graytext/20 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                    {Array.from({ length: rows }).map((_, index) => (
                        <div key={index} className="flex items-center gap-4">
                            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                            <Skeleton className="h-4 w-40 max-w-[35%]" />
                            <Skeleton className="ml-auto h-4 w-24 shrink-0" />
                            <Skeleton className="h-2 w-24 shrink-0 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
            <Skeleton className="h-4 w-48" />
        </div>
    );
}

/** FR-037: a plain message and a retry, never a raw technical error. */
export function RosterError({ onRetry }: { onRetry: () => void }) {
    return (
        <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">We couldn&apos;t load your students</h2>
                <p className="text-sm text-graytext2">Check your connection and try again.</p>
            </div>
            <Button onClick={onRetry} className="bg-darkmint text-white hover:bg-darkmint/90">
                <RotateCw className="h-4 w-4" />
                Retry
            </Button>
        </div>
    );
}

export type RosterEmptyVariant = "no-students" | "no-matches" | "no-courses";

interface RosterEmptyProps {
    variant: RosterEmptyVariant;
    /** The search term, for the "no-matches" variant. */
    term?: string;
    onClearSearch?: () => void;
}

/**
 * The empty states.
 *
 * `no-matches` is deliberately a different shape from `no-students` — FR-019 requires them
 * to be distinguishable, because "nobody is enrolled" and "nobody matches what you typed"
 * call for completely different next actions. `no-courses` exists so a brand-new
 * instructor is pointed at creating a course instead of shown a blank table (FR-029).
 */
export function RosterEmpty({ variant, term, onClearSearch }: RosterEmptyProps) {
    if (variant === "no-matches") {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkbg text-graytext2">
                    <SearchX className="h-7 w-7" />
                </div>
                <div className="flex max-w-md flex-col gap-1.5">
                    <h2 className="text-xl font-bold text-darktext">No students match</h2>
                    <p className="text-sm text-graytext2">
                        Nobody matched{" "}
                        <span className="font-semibold text-darktext">&ldquo;{term}&rdquo;</span>. Try a
                        shorter name, or clear the search.
                    </p>
                </div>
                {onClearSearch && (
                    <Button
                        onClick={onClearSearch}
                        className="bg-darkmint text-white hover:bg-darkmint/90"
                    >
                        Clear search
                    </Button>
                )}
            </div>
        );
    }

    if (variant === "no-courses") {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                    <Users className="h-7 w-7" />
                </div>
                <div className="flex max-w-md flex-col gap-1.5">
                    <h2 className="text-xl font-bold text-darktext">No students yet</h2>
                    <p className="text-sm text-graytext2">
                        You don&apos;t have any courses yet. Create one and your students will appear here as
                        they enrol.
                    </p>
                </div>
                <Link
                    href="/instructor/courses/new"
                    className="rounded-lg bg-darkmint px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-darkmint/90"
                >
                    Create your first course
                </Link>
            </div>
        );
    }

    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                <Users className="h-7 w-7" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">No students yet</h2>
                <p className="text-sm text-graytext2">
                    Nobody has enrolled yet. Once students join, they&apos;ll show up here with their
                    progress.
                </p>
            </div>
        </div>
    );
}
