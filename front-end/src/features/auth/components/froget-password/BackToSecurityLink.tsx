"use client"
import Link from "next/link"
import { FaArrowLeft } from "react-icons/fa"
import { settingsSecurityPath } from "@/lib/cookies"

/**
 * The set-password wizard is entered from Settings -> Security, which exists under
 * both the student and the instructor shell. A hardcoded /dashboard link dropped
 * instructors on their dashboard (via a proxy.ts bounce) instead of back where
 * they started, so the target is resolved from the routing role cookie.
 */
export function BackToSecurityLink() {
    return (
        <Link href={settingsSecurityPath()} className="text-darkmint font-normal text-sm text-center flex items-center mb-10 gap-x-2">
            <FaArrowLeft /> Back to security settings
        </Link>
    )
}
