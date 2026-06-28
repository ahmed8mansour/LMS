import axiosInstance from '@/lib/axios';
import { CreatePaymentIntentResponse, OrderDetails } from '../types/enrollment.types';


async function createPaymentIntent(courseId: string): Promise<CreatePaymentIntentResponse> {
    const { data } = await axiosInstance.post('enrollment/create-payment-intent/', { course: courseId });
    return data;
}

async function getOrderDetail(orderId: string): Promise<OrderDetails> {
    const { data } = await axiosInstance.post('enrollment/get-order-details/', { order_id: orderId });
    return data;
}

export const enrollmentAPI = {
    createPaymentIntent,
    getOrderDetail,
};
