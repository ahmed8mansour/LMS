import { Skeleton } from "@/components/atoms/skeleton";

/**
 * Loading state for the whole dashboard (FR-026). Mirrors the full layout so the page
 * doesn't jump when data arrives, and deliberately shows no numbers or empty-state copy:
 * a flashed "0" or "No enrollments yet" would be a claim the data hasn't made.
 */
export function DashboardSkeleton() {
    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Loading your dashboard</span>

            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-64 max-w-full" />
                    <Skeleton className="h-4 w-48 max-w-full" />
                </div>
                <Skeleton className="h-11 w-36" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-xl" />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
            </div>

            <Skeleton className="h-64 rounded-xl" />
        </div>
    );
}
