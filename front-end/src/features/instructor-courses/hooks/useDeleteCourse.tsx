import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorCoursesAPI } from '../api/instructorCourses.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

// Permanently deletes an owned course (cascades server-side). Callers confirm first
// via DeleteCourseDialog. On success the My Courses list is refreshed.
export function useDeleteCourse() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => instructorCoursesAPI.remove(id),
        onSuccess() {
            queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
            toastsuccess('Course deleted', 'The course was permanently removed.');
        },
        onError(error: AxiosError) {
            handleAuthError(error, 'Could not delete course');
        },
    });
}
