import Link from "next/link";
import { FaArrowLeft } from "react-icons/fa";
import { FPverifyOTPForm } from "@/featuers/auth";

export default function GoogleSetPasswordVerify() {
    return (
        <div className="Forget_component flex items-center justify-center h-full">
            <div className="xl:w-85/100 2xl:2/3 w-full flex flex-wrap items-center justify-start ">
                <div className="w-full">
                    <Link href={'/google-set-password'} className="text-darkmint font-normal text-sm text-center flex items-center mb-10 gap-x-2">
                        <FaArrowLeft /> Back to set password
                    </Link>
                </div>
                <div className="form_header ">
                    <h2 className="text-darktext font-extrabold text-3xl/7.5 mb-3">Verify OTP</h2>
                    <p className="font-normal text-base/6 text-graylighttext mb-7">Enter the OTP sent to your email to continue setting your password.</p>
                </div>
                <FPverifyOTPForm mode="google_set_password" />
            </div>
        </div>
    )
}
