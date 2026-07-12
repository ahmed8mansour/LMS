import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsAPI } from '../api/reviews.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';
import { UpdateReviewInput } from '../types/reviews.types';

export function useUpdateReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: UpdateReviewInput }) =>
            reviewsAPI.updateReview(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
            queryClient.invalidateQueries({ queryKey: ['course-reviews'] });
            queryClient.invalidateQueries({ queryKey: ['reviewable-courses'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toastsuccess('Review updated', 'Your review has been updated successfully.');
        },
        onError: (error: unknown) => {
            handleAuthError(error, 'Failed to update review');
        },
    });
}
