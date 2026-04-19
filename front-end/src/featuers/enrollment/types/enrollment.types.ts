import { Course } from "@/featuers/courses/types/course.types"

export interface OrderSummary {
    id: number
    currency: string
    amount: string
    status: 'pending' | 'paid' | 'failed' | 'refunded'
}

export interface CreatePaymentIntentResponse {
    client_secret: string
    order: OrderSummary
}

export interface OrderDetails {
    order_id: number
    client_secret: string
    amount: string
    currency: string
    course: Course
    status: 'pending' | 'paid' | 'failed' | 'refunded'
}