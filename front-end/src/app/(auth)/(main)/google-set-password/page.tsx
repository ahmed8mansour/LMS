import { FPsendOTPForm, BackToSecurityLink } from "@/featuers/auth";

export default function GoogleSetPassword() {
    return (
        <div className="Forget_component flex items-center justify-center h-full">
            <div className="xl:w-85/100 2xl:2/3 w-full flex flex-wrap items-center justify-start ">
                <div className="w-full">
                    <BackToSecurityLink />
                </div>
                <div className="form_header ">
                    <h2 className="text-darktext font-extrabold text-3xl/7.5 mb-3">Set Password</h2>
                    <p className="font-normal text-base/6 text-graylighttext mb-7">Send an OTP to your Google email and set a password for email login.</p>
                </div>
                <FPsendOTPForm mode="google_set_password" />
            </div>
        </div>
    )
}
