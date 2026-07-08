"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/atoms/button";
import BounceLoader from "@/components/atoms/bouncing-loader";
import { useStudentOrders } from "../../hooks/useStudentOrders";

export function TransactionHistory() {
    const [page, setPage] = useState(1);
    const { data, isLoading, isError, isPlaceholderData } = useStudentOrders(page);

    const totalPages = data ? Math.max(1, Math.ceil(data.count / data.results?.length)) : 1;

    if (isError) {
        return (
            <section>
                <h3 className="text-lg font-headline font-bold mb-4">Transaction History</h3>
                <div className="flex flex-col items-center justify-center gap-3 py-10 bg-background rounded-xl border border-border/30">
                    <p className="text-sm text-muted-foreground">Couldn&apos;t load transaction history</p>
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
                <h3 className="text-lg font-headline font-bold mb-4">Transaction History</h3>
                <div className="flex items-center justify-center py-10 bg-background rounded-xl border border-border/30">
                    <BounceLoader />
                </div>
            </section>
        );
    }

    if ((data?.results.length ?? 0) === 0) {
        return (
            <section>
                <h3 className="text-lg font-headline font-bold mb-4">Transaction History</h3>
                <div className="text-center py-12 bg-background rounded-xl border border-border/30">
                    <BookOpen className="w-12 h-12 text-graytext/40 mx-auto mb-4" />
                    <h4 className="text-lg font-semibold text-darktext mb-2">No purchases yet</h4>
                    <p className="text-graytext2 mb-4">Your paid course purchases will show up here</p>
                    <Link href="/courses">
                        <Button variant="darkmint">Browse Courses</Button>
                    </Link>
                </div>
            </section>
        );
    }

    return (
        <section>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                <h3 className="text-lg font-headline font-bold">Transaction History</h3>
            </div>
            <div className={`bg-background rounded-xl border border-border/30 shadow-sm overflow-hidden ${isPlaceholderData ? 'opacity-60' : ''}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-darkmint/10 border-b border-border/30">
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">#</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Course Name</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Method</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                                <th className="px-4 md:px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {data?.results.map((order) => (
                                <tr key={order.id} className="hover:bg-muted transition-colors">
                                    <td className="px-4 md:px-6 py-4 text-sm font-medium">{order.id}</td>
                                    <td className="px-4 md:px-6 py-4 text-sm font-bold text-foreground">{order.course_name}</td>
                                    <td className="px-4 md:px-6 py-4 text-sm font-semibold">${Number(order.amount).toFixed(2)}</td>
                                    <td className="px-4 md:px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <CreditCard className="text-lg" />
                                            Card
                                        </div>
                                    </td>
                                    <td className="px-4 md:px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                            order.status === "paid" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                                        }`}>
                                            {order.status === "paid" ? "Paid" : "Refunded"}
                                        </span>
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">
                                        {new Date(order.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 text-right">
                                        <Button variant="ghost" size="sm" disabled title="Receipts coming soon">
                                            <Download />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                <div className="px-4 md:px-6 py-4 bg-darkmint/10 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        Showing {data?.results.length ?? 0} of {data?.count ?? 0} transactions
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            Previous
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <Button
                                key={p}
                                variant={p === page ? "darkmint" : "outline"}
                                size="sm"
                                onClick={() => setPage(p)}
                            >
                                {p}
                            </Button>
                        ))}
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!data?.next}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
