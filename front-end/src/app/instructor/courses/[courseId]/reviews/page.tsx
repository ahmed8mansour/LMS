"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CourseReviews, ReviewsSkeleton } from "@/featuers/instructor-reviews";

export default function CourseReviewsPage() {
    const params = useParams();
    const courseId = Number(params.courseId);

    // The Suspense boundary is required, not decorative: useReviewParams reads
    // ?rating= and ?page= through useSearchParams (Next 16).
    return (
        <Suspense fallback={<ReviewsSkeleton />}>
            <CourseReviews courseId={courseId} />
        </Suspense>
    );
}
