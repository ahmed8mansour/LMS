import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsAPI } from '../api/reviews.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';
import { SubmitReviewInput } from '../types/reviews.types';

export function useSubmitReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: SubmitReviewInput) => reviewsAPI.submitReview(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviewable-courses'] });
            queryClient.invalidateQueries({ queryKey: ['course-reviews'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
            toastsuccess('Review submitted', 'Thanks for sharing your feedback!');
        },
        onError: (error: unknown) => {
            handleAuthError(error, 'Failed to submit review');
        },
    });
}
