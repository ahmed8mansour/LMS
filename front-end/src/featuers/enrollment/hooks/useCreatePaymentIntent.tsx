import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enrollmentAPI } from '../api/enrollment.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';
import { CreatePaymentIntentResponse, OrderDetails } from '../types/enrollment.types';

export function useCreatePaymentIntent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: enrollmentAPI.createPaymentIntent,
        onSuccess(data: CreatePaymentIntentResponse, variables) {
            // Get course data from cache
            const course_data = queryClient.getQueryData(['course', variables]) as any;

            // Update TanStack Query cache for getOrderDetails
            // Use string key to match useParams() return type
            queryClient.setQueryData(['order', data.order.id], {
                order_id: data.order.id,
                client_secret: data.client_secret,
                status: data.order.status,
                amount: data.order.amount,
                currency: data.order.currency,
                course: course_data,
            } as OrderDetails);

            toastsuccess('Order created successfully');
        },
        onError(error: any, variables, context) {
            handleAuthError(error, 'Creating Order Failed');
        },
    });
}




