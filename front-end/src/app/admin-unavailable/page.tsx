import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AdminUnavailablePage() {
    return (
        <main className="font-manrope bg-lightbg min-h-screen flex items-center justify-center p-6">
            <div className="max-w-md w-full flex flex-col items-center gap-5 rounded-2xl border border-darkbg bg-white p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                    <ShieldAlert className="h-7 w-7" />
                </div>
                <div className="flex flex-col gap-2">
                    <h1 className="text-xl font-bold text-darktext">Admin experience is not available yet</h1>
                    <p className="text-sm text-graytext2">
                        Your account is an administrator. The dedicated admin experience is still being built.
                        In the meantime, please continue to use the existing admin tools.
                    </p>
                </div>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-lg bg-darkmint px-5 py-2.5 font-semibold text-white transition-colors hover:bg-darkmint/90"
                >
                    Back to home
                </Link>
            </div>
        </main>
    );
}
