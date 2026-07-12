import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { reviewsAPI } from '../api/reviews.api';

export function useCourseReviews(course_id: number, page: number) {
    return useQuery({
        queryKey: ['reviews', 'course', course_id, page],
        queryFn: () => reviewsAPI.getCourseReviews(course_id, page),
        staleTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: keepPreviousData,
    });
}
