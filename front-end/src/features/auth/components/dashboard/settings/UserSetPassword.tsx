import { Info } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/atoms/button'
import { Label } from '@/components/atoms/label'

export function UserSetPassword() {
    return (
        <section className="bg-muted border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 md:p-6">
            <div className="flex gap-3 md:gap-4 items-start bg-darkmint/10 p-3 md:p-4 rounded-lg mb-4 md:mb-6 border border-primary">
                <Info className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium leading-relaxed">
                You signed up with Google. Set a password to also enable email login. This will allow you to access your account using your email address and a separate password.
                </p>
            </div>
            <div className="space-y-4 md:space-y-6 max-w-xl">
                <h3 className="text-lg font-bold text-foreground">Set Password</h3>
                <p className="text-sm text-muted-foreground">You will receive an OTP by email and then be able to choose a password for your account.</p>
                <Button asChild variant="darkmint" className="w-full sm:w-auto">
                    <Link href="/google-set-password">Start Set Password Flow</Link>
                </Button>
            </div>
            </div>
        </section>
    )
}
