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
    client_secret?: string
    amount: string
    currency: string
    course: Course
    status: 'pending' | 'paid' | 'failed' | 'refunded'
    already_paid?: boolean
    message?: string
}


export interface FreeEnrollmentResponse {
    message: string
    enrollment_id: number
    course_id: number
}

export interface BillingSummary {
    total_spent: string
    courses_purchased: number
    last_payment_date: string | null
}

export interface OrderHistoryItem {
    id: string
    course_name: string
    amount: string
    currency: string
    status: 'paid' | 'refunded'
    method: string
    receipt_url: string | null
    date: string
}

export interface OrdersPage {
    count: number
    next: string | null
    previous: string | null
    results: OrderHistoryItem[]
}
