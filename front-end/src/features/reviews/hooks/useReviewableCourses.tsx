import { useQuery } from '@tanstack/react-query';
import { reviewsAPI } from '../api/reviews.api';

export function useReviewableCourses() {
    return useQuery({
        queryKey: ['reviewable-courses'],
        queryFn: () => reviewsAPI.getReviewableCourses(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
