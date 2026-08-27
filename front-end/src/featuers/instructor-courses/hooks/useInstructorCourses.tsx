import { useQuery } from '@tanstack/react-query';
import { instructorCoursesAPI } from '../api/instructorCourses.api';

// Fetches the full list of courses owned by the signed-in instructor.
// Filtering and search are done client-side (see MyCoursesGrid).
export function useInstructorCourses() {
    return useQuery({
        queryKey: ['instructor', 'courses'],
        queryFn: instructorCoursesAPI.list,
    });
}
