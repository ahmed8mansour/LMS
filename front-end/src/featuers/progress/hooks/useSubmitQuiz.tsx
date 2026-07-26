import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';
import { QuizSubmission } from '../types/progress.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useSubmitQuiz(quizId: string | number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (payload: QuizSubmission) => progressAPI.submitQuiz(payload),
        onSuccess(data) {
            // Cache result for the result page to read
            // this setQueryData : 
            //          -this setquerydata is used to set the data for a specific query in the cache.
            //          -its stale time is zero (on every time we subscirbes to the tanstackquery , by refresh the page or smtg like that the data will bde cleared)
            //          -its gcTime is 5 minutes , so u can access the data using getquerydata for 5 minutes only
            queryClient.setQueryData(['quiz-result', String(quizId)], data);
            // Invalidate all dashboard queries so course progress, sidebar locks,
            // and quiz review state all refresh on return
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toastsuccess(data.passed ? 'Quiz passed! Great work.' : 'Quiz submitted.');
        },
        onError(error: AxiosError) {
            handleAuthError(error, 'Failed to submit quiz');
        },
    });
}
