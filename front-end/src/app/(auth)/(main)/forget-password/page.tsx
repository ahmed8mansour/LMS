import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { PasswordInput } from "@/components/atoms/password-input"
import { FaArrowRight , FaArrowLeft } from "react-icons/fa";
import Link from "next/link";
import { FPsendOTPForm } from "@/featuers/auth";

export default function ForgetPassword() {
    return (
            <div className="Forget_component flex items-center justify-center h-full">
                <div className="xl:w-85/100 2xl:2/3 w-full flex flex-wrap items-center justify-start ">
                    <div className="w-full">
                        <Link href={'/login'} className="text-darkmint font-normal text-sm text-center flex items-center mb-10  gap-x-2">
                            <FaArrowLeft /> Back to login
                        </Link>
                    </div>
                    <div className="form_header ">
                        <h2 className="text-darktext font-extrabold text-3xl/7.5 mb-3">Forgot Password</h2>
                        <p className="font-normal text-base/6 text-graylighttext mb-7">Enter your email address and we'll send you an OTP to reset your password.</p>
                    </div>
                    <FPsendOTPForm />

                </div>
            </div>
    )
}