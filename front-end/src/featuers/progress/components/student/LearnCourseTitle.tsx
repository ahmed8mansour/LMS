"use client";

import { useParams } from "next/navigation";
import { Skeleton } from "@/components/atoms/skeleton";
import { useEnrolledStudentCourseOverview } from "../../hooks/useEnrolledStudentCourseOverView";

export function LearnCourseTitle() {
    const params = useParams<{ id?: string }>();
    const courseId = params.id;
    const { data, isLoading , isForbidden } = useEnrolledStudentCourseOverview(courseId ?? "");

    if (!courseId || isLoading) {
        return <Skeleton className="h-5 w-56" />;
    }
    if (isForbidden) return
    return <span className="line-clamp-1">{data?.course.title ?? ""}</span>;
}
