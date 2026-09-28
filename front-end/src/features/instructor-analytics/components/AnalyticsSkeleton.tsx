import { Skeleton } from "@/components/atoms/skeleton";

/**
 * Loading state for a whole snapshot (FR-020). Mirrors the real layout so the page doesn't
 * jump, and shows no numbers or empty-state copy: a flashed "0%" or "No quizzes" would be
 * a claim the data hasn't made.
 */
export function AnalyticsSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Loading analytics</span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-xl" />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
            </div>
        </div>
    );
}
