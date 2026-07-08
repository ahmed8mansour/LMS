import axiosInstance from '@/lib/axios';
import { CreatePaymentIntentResponse, OrderDetails, BillingSummary, OrdersPage } from '../types/enrollment.types';


async function createPaymentIntent(courseId: string): Promise<CreatePaymentIntentResponse> {
    const { data } = await axiosInstance.post('enrollment/create-payment-intent/', { course: courseId });
    return data;
}

async function getOrderDetail(orderId: string): Promise<OrderDetails> {
    const { data } = await axiosInstance.post('enrollment/get-order-details/', { order_id: orderId });
    return data;
}

async function getBillingSummary(): Promise<BillingSummary> {
    const { data } = await axiosInstance.get('enrollment/student/billing/summary/');
    return data;
}

async function getBillingOrders(page: number): Promise<OrdersPage> {
    const { data } = await axiosInstance.get(`enrollment/student/orders/?page=${page}`);
    return data;
}


export const enrollmentAPI = {
    createPaymentIntent,
    getOrderDetail,
    getBillingSummary,
    getBillingOrders,
};
