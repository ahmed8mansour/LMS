import { useQuery } from '@tanstack/react-query';
import { instructorCoursesAPI } from '../api/instructorCourses.api';

// Fetches a single owned course. A non-owned / missing id returns 404 from the
// backend (ownership gate) and surfaces here as an error the UI renders as not-found.
export function useInstructorCourse(id: number) {
    return useQuery({
        queryKey: ['instructor', 'course', id],
        queryFn: () => instructorCoursesAPI.get(id),
        enabled: Number.isFinite(id),
        retry: false,
    });
}
