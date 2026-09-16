"use client";

import { useInstructorDashboard } from "../hooks/useInstructorDashboard";
import { isNoInstructorProfileError } from "../types/instructorDashboard.types";
import { DashboardError } from "./DashboardError";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { NeedsAttentionList } from "./NeedsAttentionList";
import { NoInstructorProfileState } from "./NoInstructorProfileState";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { RecentEnrollments } from "./RecentEnrollments";
import { RecentReviews } from "./RecentReviews";
import { SummaryTiles } from "./SummaryTiles";

/**
 * The instructor home (spec 008). This is the only place the snapshot query is read, so
 * the "never render a partial or misleading snapshot" rule is reviewable in one place:
 * exactly one of skeleton / no-profile / error / onboarding / full dashboard renders.
 */
export function InstructorDashboard() {
    const { data, error, isPending, isError, refetch } = useInstructorDashboard();

    if (isPending) {
        return <DashboardSkeleton />;
    }

    if (isError && isNoInstructorProfileError(error)) {
        return <NoInstructorProfileState />;
    }

    if (isError) {
        return <DashboardError onRetry={() => refetch()} />;
    }

    if (data.mode === "onboarding") {
        return <OnboardingChecklist onboarding={data.onboarding} />;
    }

    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <DashboardHeader name={data.instructor_name} />
            <SummaryTiles
                courses={data.courses}
                students={data.students}
                rating={data.rating}
                earnings={data.earnings}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RecentEnrollments enrollments={data.recent_enrollments} />
                <RecentReviews reviews={data.recent_reviews} />
            </div>
            <NeedsAttentionList needsAttention={data.needs_attention} />
        </div>
    );
}
