import type { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';

export function useEnrolledLectureDetail(id: string | number) {
    const queryResult = useQuery({
        queryKey: ['dashboard', 'student', 'enrolled', 'lecture', String(id)],
        queryFn: () => progressAPI.getEnrolledLectureDetail(id),
        enabled: Boolean(id),
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
            ? "This lecture is locked or you are not allowed to access it."
            : "We could not load this lecture. Try again or return to your course."
    };
}
