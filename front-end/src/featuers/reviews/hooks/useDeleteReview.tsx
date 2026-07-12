import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsAPI } from '../api/reviews.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useDeleteReview() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: number) => reviewsAPI.deleteReview(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
            queryClient.invalidateQueries({ queryKey: ['course-reviews'] });
            queryClient.invalidateQueries({ queryKey: ['reviewable-courses'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            toastsuccess('Review deleted', 'Your review has been removed.');
        },
        onError: (error: unknown) => {
            handleAuthError(error, 'Failed to delete review');
        },
    });
}
