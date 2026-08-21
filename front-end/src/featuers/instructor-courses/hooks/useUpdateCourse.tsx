import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { instructorCoursesAPI } from '../api/instructorCourses.api';
import { CourseFormData } from '../schemas/instructorCourses.schma';
import { toastsuccess, handleAuthError } from '@/lib/toast';

// Updates an owned course's metadata / thumbnail, then returns to its overview.
export function useUpdateCourse() {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: ({ id, form }: { id: number; form: CourseFormData }) =>
            instructorCoursesAPI.update(id, form),
        onSuccess(course, { id }) {
            queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
            queryClient.invalidateQueries({ queryKey: ['instructor', 'course', id] });
            toastsuccess('Course updated', 'Your changes were saved.');
            router.push(`/instructor/courses/${course.id}`);
        },
        onError(error: AxiosError) {
            handleAuthError(error, 'Could not save changes');
        },
    });
}
