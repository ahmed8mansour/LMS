import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { instructorCoursesAPI } from '../api/instructorCourses.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

// Creates a draft course, then routes into its workspace (FR-007).
export function useCreateCourse() {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: instructorCoursesAPI.create,
        onSuccess(course) {
            queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
            toastsuccess('Course created', 'Your draft course was created.');
            router.push(`/instructor/courses/${course.id}`);
        },
        onError(error: AxiosError) {
            handleAuthError(error, 'Could not create course');
        },
    });
}
