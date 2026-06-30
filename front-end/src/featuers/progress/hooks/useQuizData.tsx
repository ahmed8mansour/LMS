import type { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';

export function useQuizData(quizId: string | number) {
    const queryResult = useQuery({
        queryKey: ['dashboard', 'student', 'quiz', String(quizId)],
        queryFn: () => progressAPI.getQuiz(quizId),
        enabled: Boolean(quizId),
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error: unknown) => {
            const statusCode = (error as AxiosError).response?.status;
            if (statusCode === 403 || statusCode === 404) return false;
            return failureCount < 3;
        },
    });

    const statusCode = (queryResult.error as AxiosError | null)?.response?.status;
    return {
        ...queryResult,
        isForbidden: statusCode === 403,
        isNotFound: statusCode === 404,
        customErrorMessage:
            statusCode === 403
                ? 'Quiz is locked. Complete all lectures in this section first.'
                : 'We could not load this quiz. Try again or return to your course.',
    };
}
