import { useQuery } from '@tanstack/react-query';
import { instructorDashboardAPI } from '../api/instructorDashboard.api';
import { isNoInstructorProfileError } from '../types/instructorDashboard.types';

// Always fresh, never invalidated (spec 008 research R11).
//
// The global staleTime is 5 minutes, and the dashboard depends on nearly every
// instructor mutation (course create/update/delete, publish, curriculum, quizzes,
// video). Wiring this key into each of those hooks would couple all of 004–007 to this
// page, and one missed hook would mean a silently stale dashboard. Instead, gcTime: 0
// drops the snapshot when the page unmounts, so returning always shows the skeleton and
// then current data — never an old snapshot that visibly changes a moment later.
export function useInstructorDashboard() {
    return useQuery({
        queryKey: ['instructor', 'dashboard'],
        queryFn: instructorDashboardAPI.getSnapshot,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
        // A missing instructor profile won't fix itself on retry.
        retry: (failureCount, error) => !isNoInstructorProfileError(error) && failureCount < 1,
    });
}
