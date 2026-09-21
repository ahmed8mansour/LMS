"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CourseStudents, RosterSkeleton } from "@/featuers/instructor-students";

export default function CourseStudentsPage() {
    const params = useParams();
    const courseId = Number(params.courseId);

    // The Suspense boundary is required, not decorative: useRosterParams reads
    // ?search= and ?page= through useSearchParams (Next 16).
    return (
        <Suspense fallback={<RosterSkeleton />}>
            <CourseStudents courseId={courseId} />
        </Suspense>
    );
}
