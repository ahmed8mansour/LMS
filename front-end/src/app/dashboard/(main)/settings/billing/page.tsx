'use client'

import { BillingSummary, TransactionHistory } from '@/featuers/enrollment'
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/atoms/button";

export default function BillingPage() {
  return (
    <div className="flex-1 space-y-6 md:space-y-8">
      <BillingSummary />
      <TransactionHistory />
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl flex items-start gap-4">
                <div className="bg-primary/20 p-3 rounded-lg flex-shrink-0">
                    <CheckCircle className="text-primary" />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-foreground">Need a Tax Invoice?</h4>
                    <p className="text-sm text-muted-foreground mb-4">Add your business details to your profile to receive automated tax invoices for every purchase.</p>
                    <Button variant="link" className="p-0 h-auto">Update Billing Address</Button>
                </div>
            </div>
            <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl flex items-start gap-4">
                <div className="bg-primary/20 p-3 rounded-lg flex-shrink-0">
                    <CheckCircle className="text-primary" />
                </div>
                <div className="min-w-0">
                    <h4 className="font-bold text-foreground">Payment Issues?</h4>
                    <p className="text-sm text-muted-foreground mb-4">Our support team is available 24/7 to help you with any transaction or billing concerns.</p>
                    <Button variant="link" className="p-0 h-auto">Contact Support</Button>
                </div>
            </div>
        </section>
    </div>
  )
}
