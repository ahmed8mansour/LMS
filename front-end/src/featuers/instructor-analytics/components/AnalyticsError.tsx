import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/atoms/button";

/**
 * Page-level error for a snapshot (FR-022). Replaces the tiles and charts entirely: the
 * snapshot is all-or-nothing, so there is never a half-loaded page to show beside it, and
 * a zero must never stand in for data that failed to load.
 */
export function AnalyticsError({ onRetry }: { onRetry: () => void }) {
    return (
        <div role="alert" className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">We couldn&apos;t load analytics</h2>
                <p className="text-sm text-graytext2">Check your connection and try again.</p>
            </div>
            <Button onClick={onRetry} className="bg-darkmint text-white hover:bg-darkmint/90">
                <RotateCw className="h-4 w-4" />
                Retry
            </Button>
        </div>
    );
}
