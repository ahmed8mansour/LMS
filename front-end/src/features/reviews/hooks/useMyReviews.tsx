import { useQuery } from '@tanstack/react-query';
import { reviewsAPI } from '../api/reviews.api';

export function useMyReviews() {
    return useQuery({
        queryKey: ['my-reviews'],
        queryFn: reviewsAPI.getMyReviews,
        staleTime: 5 * 60 * 1000,
    });
}
