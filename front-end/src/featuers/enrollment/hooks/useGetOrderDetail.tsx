import { useQuery, skipToken } from '@tanstack/react-query';
import { enrollmentAPI } from '../api/enrollment.api';
import { OrderDetails } from '../types/enrollment.types';



export function useGetOrderDetail(id: string | null) {
    return useQuery({
        queryKey: ['order', id],
        queryFn: id ? () => enrollmentAPI.getOrderDetail(id) : skipToken,
        staleTime: 5 * 60 * 1000, // 5 minutes
        initialData: id ? undefined : undefined,
    });
}




