import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { enrollmentAPI } from '../api/enrollment.api';

export function useStudentOrders(page: number) {
    return useQuery({
        queryKey: ['billing', 'orders', page],
        queryFn: () => enrollmentAPI.getBillingOrders(page),
        staleTime: 5 * 60 * 1000, // 5 minutes
        placeholderData: keepPreviousData,
    });
}
