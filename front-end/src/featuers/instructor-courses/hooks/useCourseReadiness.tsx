import { useQuery } from '@tanstack/react-query';
import { instructorCoursesAPI } from '../api/instructorCourses.api';

// The server's itemized readiness verdict for one owned course (spec 007).
//
// Why this key shape: TanStack Query invalidates by PREFIX, and the curriculum,
// lecture, and video mutations already invalidate ['instructor', 'course', id]
// (or the whole ['instructor', 'course'] prefix). Nesting readiness under it
// means every one of those edits refreshes this checklist with no changes to
// those hooks (research R9, FR-020 / FR-026).
export function readinessQueryKey(courseId: number) {
    return ['instructor', 'course', courseId, 'readiness'] as const;
}

export function useCourseReadiness(courseId: number) {
    return useQuery({
        queryKey: readinessQueryKey(courseId),
        queryFn: () => instructorCoursesAPI.readiness(courseId),
        enabled: Number.isFinite(courseId),
        // A failure is shown as "readiness unknown" with an explicit retry, and
        // publish stays unavailable meanwhile (FR-021) — no silent retries.
        retry: false,
    });
}
