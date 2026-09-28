import type { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';

export function useCourseCompletion(id: string | number) {
    // Keyed under 'dashboard' like every other learning read, so marking a
    // lecture complete or submitting a quiz refreshes this summary too.
    const queryResult = useQuery({
        queryKey: ['dashboard', 'student', 'enrolled', 'completion', String(id)],
        queryFn: () => progressAPI.getCourseCompletion(id),
        staleTime: 5 * 60 * 1000,

        retry: (failureCount, error: unknown) => {
            const statusCode = (error as AxiosError).response?.status;
            if (statusCode === 403 || statusCode === 404) return false;
            return failureCount < 3;
        }
    });

    const statusCode = (queryResult.error as AxiosError | null)?.response?.status;
    return {
        ...queryResult,
        isForbidden: statusCode === 403,
        isNotFound: statusCode === 404,
        customErrorMessage: statusCode === 403
            ? "You are not allowed to access this course. Please enroll first."
            : "We could not load your completion summary. Try again or return to your dashboard."
    };
}
