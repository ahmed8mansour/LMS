"use client";

import { TrendingUp, BookOpen, History } from "lucide-react";
import { Button } from "@/components/atoms/button";
import BounceLoader from "@/components/atoms/bouncing-loader";
import { useBillingSummary } from "../../hooks/useBillingSummary";

export function BillingSummary() {
    const { data, isLoading, isError } = useBillingSummary();

    if (isError) {
        return (
            <section>
                <h3 className="text-lg font-headline font-bold mb-4">Payment Summary</h3>
                <div className="flex flex-col items-center justify-center gap-3 py-10 bg-background rounded-xl border border-border/30">
                    <p className="text-sm text-muted-foreground">Couldn&apos;t load payment summary</p>
                    <Button variant="darkmint" size="sm" onClick={() => window.location.reload()}>
                        Try Again
                    </Button>
                </div>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section>
                <h3 className="text-lg font-headline font-bold mb-4">Payment Summary</h3>
                <div className="flex items-center justify-center py-10">
                    <BounceLoader />
                </div>
            </section>
        );
    }

    const totalSpent = Number(data?.total_spent ?? 0);
    const coursesPurchased = data?.courses_purchased ?? 0;
    const lastPaymentDate = data?.last_payment_date
        ? new Date(data.last_payment_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : "—";

    return (
        <section>
            <h3 className="text-lg font-headline font-bold mb-4 flex items-center gap-2">
                Payment Summary
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl border border-border/30 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Total Spent</p>
                    <p className="text-xl md:text-2xl font-black text-foreground">${totalSpent.toFixed(2)}</p>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1 font-semibold">
                        <TrendingUp className="text-xs" />
                        Lifetime spending
                    </div>
                </div>
                <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl border border-border/30 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Courses Purchased</p>
                    <p className="text-xl md:text-2xl font-black text-foreground">{coursesPurchased}</p>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <BookOpen className="text-xs" />
                        Active Learning
                    </div>
                </div>
                <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl border border-border/30 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Last Payment Date</p>
                    <p className="text-xl md:text-2xl font-black text-foreground">{lastPaymentDate}</p>
                    <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <History className="text-xs" />
                        Most recent purchase
                    </div>
                </div>
            </div>
        </section>
    );
}
