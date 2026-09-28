import type { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';

export function useEnrolledStudentCourseOverview(id: string | number) {
    const queryResult = useQuery({
        queryKey: ['dashboard', 'student', 'enrolled', 'overview', String(id)],
        queryFn: () => progressAPI.getEnrolledCourseOverview(id),
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
            : "We could not load this enrolled course. Try again or return to your dashboard."
    };
}
