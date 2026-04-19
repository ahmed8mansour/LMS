"use client"
import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import { Field, FieldGroup } from "@/components/atoms/field";
import { Separator } from "@/components/atoms/separator";
import { Skeleton } from "@/components/atoms/skeleton";
import { FaCreditCard, FaCcVisa, FaCcMastercard } from "react-icons/fa";
import { MdOndemandVideo, MdVerifiedUser } from "react-icons/md";
import { IoInfiniteOutline } from "react-icons/io5";
import { LiaCertificateSolid } from "react-icons/lia";
import { FiDownload } from "react-icons/fi";
import { useGetOrderDetail } from '../hooks/useGetOrderDetail';
import { useProceedPayment } from "../hooks/useProceedPayment";
import { useParams } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';
import { notFound } from "next/navigation";
import BounceLoader from '@/components/atoms/bouncing-loader';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, {
        locale: 'en',
    })
    : null;

// Payment form component that uses Stripe hooks (must be inside Elements provider)
function PaymentForm() {
    const elements = useElements();
    const stripe = useStripe();
    const { isPending, mutate: proceedPayment } = useProceedPayment();
    const [paymentElementReady, setPaymentElementReady] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        proceedPayment({ stripe, elements });
    };

    if (!stripe || !elements) {
        return (
            <div className="flex items-center justify-center py-10">
                <BounceLoader />
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup>
                {/* Payment Section */}
                <Field>
                    <Label className="text-sm font-semibold text-darktext">
                        Payment Information
                    </Label>
                    <div className="w-full p-4 rounded-md border border-graylighttext/40 bg-white flex flex-col gap-4">
                        {/* Card Header */}
                        <div className="flex justify-between items-center pb-3 border-b border-graylighttext/30">
                            <span className="text-graytext2 text-sm">Card details</span>
                            <div className="flex gap-2">
                                <FaCcVisa className="w-8 h-5 text-[#1A1F71]" />
                                <FaCcMastercard className="w-8 h-5 text-[#EB001B]" />
                            </div>
                        </div>
                        {/* Stripe PaymentElement */}
                        <PaymentElement
                            onReady={() => setPaymentElementReady(true)}
                        />
                    </div>
                </Field>
            </FieldGroup>

            {/* Submit Section */}
            <div className="space-y-4 pt-2">
                <Button
                    className="h-12 w-full text-lg font-bold"
                    variant="darkmint"
                    disabled={!paymentElementReady || isPending}
                >
                    {isPending ? (
                        <span className="flex items-center justify-center gap-2">
                            <BounceLoader />
                            Processing...
                        </span>
                    ) : (
                        'Pay Now'
                    )}
                </Button>
                <div className="flex items-center justify-center gap-2 text-darkmint text-sm">
                    <MdVerifiedUser className="w-4 h-4" />
                    <span>Secured by Stripe</span>
                </div>
            </div>
        </form>
    );
}

// Main checkout component
export function CourseCheckout() {
    const params = useParams();
    const order_id = params.orderID as string | undefined;

    const { data: orderData, isLoading, isError } = useGetOrderDetail(order_id || null);
    const course_data = orderData?.course;

    if (isLoading) return (
        <div className="flex items-center justify-center flex-1">
            <BounceLoader />
        </div>
    );
    if (isError || !orderData) return notFound();

    const options = {
        clientSecret: orderData.client_secret,
        appearance: { theme: 'flat' as const }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column: Payment Form */}
            <div className="lg:col-span-7 space-y-6">
                <div className="space-y-2">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-darkmint">
                        Complete your enrollment
                    </h1>
                    <p className="text-graytext2 text-base md:text-lg">
                        You're one step away from accessing your course
                    </p>
                </div>
                <Elements
                    stripe={stripePromise}
                    options={options}

                >
                    <PaymentForm />
                </Elements>
            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-5">
                <div className="bg-white rounded-xl border border-graylighttext/40 shadow-sm overflow-hidden sticky top-8">
                    <div className="p-6 space-y-6">
                        <h3 className="text-xl font-bold text-darktext">Order Summary</h3>

                        {/* Course Info */}
                        <div className="flex gap-4">
                            <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-darkbg">
                                {course_data?.thumbnail ?
                                    <Image
                                        src={course_data?.thumbnail}
                                        alt='course thumbnail'
                                        width={96}
                                        height={96}
                                        className="w-full h-full object-cover"
                                    />
                                    :
                                    <Skeleton className="w-full h-full" />
                                }
                            </div>
                            <div className="flex flex-col justify-center">
                                <h4 className="font-bold text-darktext leading-tight">
                                    {course_data?.title}
                                </h4>
                                <p className="text-sm text-graytext2 mt-1">
                                    Instructor: {course_data?.instructor_profile.first_name} {course_data?.instructor_profile.last_name}
                                </p>
                                <div className="flex items-center gap-1 mt-2">
                                    <span className="text-xs font-bold text-darktext">
                                        {course_data?.rating} ({course_data?.reviews_count} ratings)
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Separator className="bg-graylighttext/40" />

                        {/* Pricing */}
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-graytext2">
                                <span>Original Price</span>
                                <span className="line-through">{course_data?.price}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-graytext2">Discount</span>
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
                                    -0% Off
                                </span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-lg font-bold text-darktext">
                                    Total Price
                                </span>
                                <span className="text-3xl font-extrabold text-darkmint">
                                    ${course_data?.price}
                                </span>
                            </div>
                        </div>

                        <Separator className="bg-graylighttext/40" />

                        {/* What's Included */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold text-darktext uppercase tracking-wider">
                                What's included:
                            </h4>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-3 text-sm text-graytext2">
                                    <MdOndemandVideo className="text-darkmint w-5 h-5" />
                                    <span>24.5 On-demand video hours</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm text-graytext2">
                                    <IoInfiniteOutline className="text-darkmint w-5 h-5" />
                                    <span>Full lifetime access</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm text-graytext2">
                                    <LiaCertificateSolid className="text-darkmint w-5 h-5" />
                                    <span>Certificate of completion</span>
                                </li>
                                <li className="flex items-center gap-3 text-sm text-graytext2">
                                    <FiDownload className="text-darkmint w-5 h-5" />
                                    <span>48 Downloadable resources</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-lightbg p-4 text-center">
                        <p className="text-xs text-graytext2 font-medium">
                            Access will be granted immediately after successful payment.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
