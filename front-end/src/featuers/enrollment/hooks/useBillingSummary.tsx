import { useQuery } from '@tanstack/react-query';
import { enrollmentAPI } from '../api/enrollment.api';

export function useBillingSummary() {
    return useQuery({
        queryKey: ['billing', 'summary'],
        queryFn: () => enrollmentAPI.getBillingSummary(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
