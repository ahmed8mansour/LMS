'use client'

import { TrendingUp, BookOpen, History, Filter, CreditCard, Wallet, Download, CheckCircle, HelpCircle } from 'lucide-react'
import { Button } from '@/components/atoms/button'

// TODO: replace with real API data
const mockBillingData = {
  totalSpent: 1248.50,
  coursesPurchased: 14,
  lastPaymentDate: "Oct 24, 2023",
  nextPaymentDate: "Nov 24, 2023",
  transactions: [
    {
      id: "TRX-9402",
      courseName: "Advanced UI Design Principles",
      amount: 199.00,
      method: { type: "card", last4: "4242" },
      status: "success",
      date: "Oct 24, 2023"
    },
    {
      id: "TRX-9381",
      courseName: "React Native Architecture",
      amount: 149.00,
      method: { type: "paypal" },
      status: "failed",
      date: "Oct 12, 2023"
    },
    {
      id: "TRX-9120",
      courseName: "Marketing Strategy for SaaS",
      amount: 89.00,
      method: { type: "card", last4: "4242" },
      status: "success",
      date: "Sep 28, 2023"
    },
    {
      id: "TRX-8994",
      courseName: "Typography Masterclass",
      amount: 59.00,
      method: { type: "card", last4: "4242" },
      status: "success",
      date: "Sep 15, 2023"
    }
  ]
}

export default function BillingPage() {
  return (
    <div className="flex-1 space-y-6 md:space-y-8">
      {/* Payment Summary Section */}
      <section>
        <h3 className="text-lg font-headline font-bold mb-4 flex items-center gap-2">
          Payment Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl border border-border/30 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-muted-foreground font-medium mb-1">Total Spent</p>
            <p className="text-xl md:text-2xl font-black text-foreground">${mockBillingData.totalSpent.toFixed(2)}</p>
            <div className="mt-2 text-xs text-green-600 flex items-center gap-1 font-semibold">
              <TrendingUp className="text-xs" />
              12% from last year
            </div>
          </div>
          <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl border border-border/30 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm text-muted-foreground font-medium mb-1">Courses Purchased</p>
            <p className="text-xl md:text-2xl font-black text-foreground">{mockBillingData.coursesPurchased}</p>
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <BookOpen className="text-xs" />
              Active Learning
            </div>
          </div>
          <div className="bg-darkmint/10 p-4 md:p-6 rounded-xl border border-border/30 shadow-sm hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
            <p className="text-sm text-muted-foreground font-medium mb-1">Last Payment Date</p>
            <p className="text-xl md:text-2xl font-black text-foreground">{mockBillingData.lastPaymentDate}</p>
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
              <History className="text-xs" />
              Next: {mockBillingData.nextPaymentDate}
            </div>
          </div>
        </div>
      </section>
      {/* Transaction History Section */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="text-lg font-headline font-bold">Transaction History</h3>
          <Button variant="darkmint" size="sm" className="w-full sm:w-auto">
            <Filter className="text-sm mr-1" />
            Filter
          </Button>
        </div>
        <div className="bg-background rounded-xl border border-border/30 shadow-sm overflow-hidden">
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
                {mockBillingData.transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-muted transition-colors">
                    <td className="px-4 md:px-6 py-4 text-sm font-medium">{transaction.id}</td>
                    <td className="px-4 md:px-6 py-4 text-sm font-bold text-foreground">{transaction.courseName}</td>
                    <td className="px-4 md:px-6 py-4 text-sm font-semibold">${transaction.amount.toFixed(2)}</td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {transaction.method.type === "card" ? <CreditCard className="text-lg" /> : <Wallet className="text-lg" />}
                        {transaction.method.type === "card" ? `•••• ${transaction.method.last4}` : "PayPal"}
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        transaction.status === "success" ? "bg-green-100 text-green-800" : "bg-destructive/10 text-destructive"
                      }`}>
                        {transaction.status === "success" ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-sm text-muted-foreground">{transaction.date}</td>
                    <td className="px-4 md:px-6 py-4 text-right">
                      <Button variant="ghost" size="sm">
                        {transaction.status === "success" ? <Download /> : <Download />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="px-4 md:px-6 py-4 bg-darkmint/10 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Showing 4 of 24 transactions</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="darkmint" size="sm">1</Button>
              <Button variant="outline" size="sm">2</Button>
              <Button variant="outline" size="sm">3</Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </div>
      </section>
      {/* Extra Actions Section */}
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
