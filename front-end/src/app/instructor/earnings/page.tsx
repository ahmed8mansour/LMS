import { Suspense } from "react";
import { EarningsSkeleton, InstructorEarnings } from "@/features/instructor-earnings";

// The page reads ?period= through useSearchParams, which Next 16 requires to sit under a
// Suspense boundary.
export default function InstructorEarningsPage() {
    return (
        <Suspense fallback={<EarningsSkeleton />}>
            <InstructorEarnings />
        </Suspense>
    );
}
