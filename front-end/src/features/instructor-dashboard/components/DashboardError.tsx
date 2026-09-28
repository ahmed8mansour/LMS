import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/atoms/button";

interface DashboardErrorProps {
    /** Re-runs the snapshot query. */
    onRetry: () => void;
}

/**
 * Page-level error for the dashboard snapshot (FR-027). Replaces the whole page body:
 * the snapshot is all-or-nothing, so there is never a partially loaded dashboard to show
 * beside it.
 */
export function DashboardError({ onRetry }: DashboardErrorProps) {
    return (
        <div
            role="alert"
            className="max-w-6xl mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center"
        >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
                <h1 className="text-xl font-bold text-darktext">We couldn&apos;t load your dashboard</h1>
                <p className="text-sm text-graytext2">Check your connection and try again.</p>
            </div>
            <Button onClick={onRetry} className="bg-darkmint text-white hover:bg-darkmint/90">
                <RotateCw className="h-4 w-4" />
                Retry
            </Button>
        </div>
    );
}
