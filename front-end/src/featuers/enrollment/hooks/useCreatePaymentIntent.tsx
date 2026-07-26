import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { enrollmentAPI } from '../api/enrollment.api';
import { toastinfo, handleAuthError } from '@/lib/toast';
import { CreatePaymentIntentResponse, OrderDetails } from '../types/enrollment.types';

export function useCreatePaymentIntent() {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: enrollmentAPI.createPaymentIntent,
        onSuccess(data: CreatePaymentIntentResponse, variables) {
            // Get course data from cache
            const course_data = queryClient.getQueryData(['course', variables]) as any;

            // Prime the getOrderDetails cache so the checkout page renders instantly.
            // Use string key to match useParams() return type
            queryClient.setQueryData(['order', data.order.id], {
                order_id: data.order.id,
                client_secret: data.client_secret,
                status: data.order.status,
                amount: data.order.amount,
                currency: data.order.currency,
                course: course_data,
            } as OrderDetails);

            router.replace(`/courses/checkout/${data.order.id}/`);
        },
        onError(error: AxiosError) {
            // 409: a pending checkout already exists for this course. Resume it
            // instead of erroring — the checkout page self-fetches a fresh
            // client_secret via GetOrderDetails, so we only need the order id.
            if (error?.response?.status === 409 && error.response.data?.order_id) {
                toastinfo('Resuming checkout', 'You already have a checkout in progress');
                router.replace(`/courses/checkout/${error.response.data.order_id}/`);
                return;
            }
            handleAuthError(error, 'Creating Order Failed');
        },
    });
}




