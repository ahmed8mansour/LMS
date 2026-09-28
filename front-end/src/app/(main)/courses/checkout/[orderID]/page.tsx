"use client";

import { CourseCheckout } from "@/features/enrollment";

export default function CheckoutPage() {
    return (
        <div className="min-h-screen font-manrope bg-darkbg py-8">
            <main className="container mx-auto px-4">
                <CourseCheckout />
            </main>
        </div>
    );
}
