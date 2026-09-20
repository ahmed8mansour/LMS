"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AnalyticsSkeleton, CourseAnalytics } from "@/featuers/instructor-analytics";

export default function CourseAnalyticsPage() {
    const params = useParams();
    const courseId = Number(params.courseId);

    return (
        <Suspense fallback={<AnalyticsSkeleton />}>
            <CourseAnalytics courseId={courseId} />
        </Suspense>
    );
}
