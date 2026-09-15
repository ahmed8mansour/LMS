import {create} from 'zustand'
import { OrderDetails } from '@/featuers/enrollment/types/enrollment.types'

// The course attached to an order. `orderCourse` was imported here but never
// existed in enrollment.types; this is the type the order payload actually uses.
type orderCourse = OrderDetails['course']

type Order = {
    order_id:number | null;
    course_data :orderCourse | null;
    client_secret :string | null;

    setCheckoutData:(order_id:number | null , course_data:orderCourse | null , client_secret:string | null) => void;
}


export const useCheckoutStore = create<Order>((set) => ({
    order_id : null,
    course_data : null,
    client_secret : null,

    setCheckoutData(order_id, course_data, client_secret) {
        set({order_id:order_id , course_data:course_data , client_secret:client_secret})
    },
}))