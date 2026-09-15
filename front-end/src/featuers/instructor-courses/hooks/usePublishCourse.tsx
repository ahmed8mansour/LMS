import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorCoursesAPI } from '../api/instructorCourses.api';
import { handleAuthError, toastinfo, toastsuccess } from '@/lib/toast';

// Publish transitions for one owned course (spec 007).
export function usePublishCourse(courseId: number) {
    const queryClient = useQueryClient();

    // Every surface showing this course's status or readiness sits under one of
    // these prefixes: ['instructor','course',id] also matches the readiness query
    // (['instructor','course',id,'readiness']), and ['instructor','courses'] is the
    // My Courses list with its badges (FR-008).
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['instructor', 'course', courseId] });
        queryClient.invalidateQueries({ queryKey: ['instructor', 'courses'] });
    };

    const publish = useMutation({
        mutationFn: () => instructorCoursesAPI.publish(courseId),
        onSuccess(result) {
            refresh();
            if (result.changed) {
                toastsuccess('Course published', result.detail);
            } else {
                // Idempotent no-op (a double-click): information, not an error (FR-005).
                toastinfo('Already published', result.detail);
            }
        },
        onError(error: AxiosError) {
            // The server judged the course as it is *now*, which may not match what
            // this page last loaded. Refresh so the panel shows the real reasons
            // instead of a stale "ready" (FR-014).
            refresh();
            handleAuthError(error, 'Could not publish');
        },
    });

    const unpublish = useMutation({
        mutationFn: () => instructorCoursesAPI.unpublish(courseId),
        onSuccess(result) {
            refresh();
            if (result.changed) {
                toastsuccess('Course unpublished', result.detail);
            } else {
                toastinfo('Already a draft', result.detail);
            }
        },
        onError(error: AxiosError) {
            refresh();
            handleAuthError(error, 'Could not unpublish');
        },
    });

    return { publish, unpublish };
}
