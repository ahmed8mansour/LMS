import { Suspense } from "react";
import { InstructorReviews, ReviewsSkeleton } from "@/featuers/instructor-reviews";

// The page reads ?rating= and ?page= through useSearchParams, which Next 16 requires to
// sit under a Suspense boundary.
export default function InstructorReviewsPage() {
    return (
        <Suspense fallback={<ReviewsSkeleton />}>
            <InstructorReviews />
        </Suspense>
    );
}
