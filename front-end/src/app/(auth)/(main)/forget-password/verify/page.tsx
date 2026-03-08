import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { PasswordInput } from "@/components/atoms/password-input"
import { FaArrowRight , FaArrowLeft } from "react-icons/fa";
import Link from "next/link";
import { Field, FieldDescription, FieldLabel } from "@/components//atoms/field"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSeparator,
    InputOTPSlot,
} from "@/components/atoms/input-otp"
import { RefreshCwIcon } from "lucide-react"
import { FPverifyOTPForm } from "@/featuers/auth";
export default function page() {
    return (
                <div className="login_component flex items-center justify-center h-full font-manrope">
                    <div className="xl:w-85/100 2xl:2/3 w-full flex flex-wrap items-center justify-start ">
                        <div className="w-full">
                            <Link href={'/login'} className="text-darkmint font-normal text-sm text-center flex items-center mb-10  gap-x-2">
                                <FaArrowLeft /> Back to login
                            </Link>
                        </div>
                        <div className="form_header mb-7">
                            <h2 className="text-darktext font-extrabold text-3xl/7.5 mb-3">Verify OTP</h2>
                            <p className="font-normal text-base/6 text-graylighttext mb-3">We've sent a 6-digit code to your email. Please enter it below to proceed with recovery.</p>
                            <span className="text-graylighttext ">Note : The code will expire in 10 minutes</span>.
                        </div>
                        <FPverifyOTPForm/>
                    </div>
                </div>
    )
}
