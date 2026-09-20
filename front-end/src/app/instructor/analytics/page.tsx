import { Suspense } from "react";
import { AnalyticsSkeleton, InstructorAnalytics } from "@/featuers/instructor-analytics";

// The page reads ?days= through useSearchParams, which Next 16 requires to sit under a
// Suspense boundary.
export default function InstructorAnalyticsPage() {
    return (
        <Suspense fallback={<AnalyticsSkeleton />}>
            <InstructorAnalytics />
        </Suspense>
    );
}
