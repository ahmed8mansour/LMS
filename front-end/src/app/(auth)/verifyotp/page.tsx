"use client";
import { useAuthStore } from "@/store/auth.store";
import { OTPForm } from "@/featuers/auth/components/RegisterOTPComponent";
export default function page() {
    const setPendingEmail = useAuthStore((store)=>store.setPendingEmail)
    
    return (
        <div className="flex items-center justify-center h-screen p-4">
            <OTPForm/>
        </div>
    )
}
