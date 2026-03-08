'use client';
import { Button } from "../../../components/atoms/button"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { Controller } from 'react-hook-form';
import { otpFormData } from "../schemas/auth.schma";
import { OTPSchema } from "../schemas/auth.schma";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldDescription, FieldLabel } from "@/components//atoms/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/atoms/input-otp"
import { RefreshCwIcon } from "lucide-react"
import { useForm, SubmitHandler } from "react-hook-form"

import { useRegisterVerifyOTP } from "../hooks/useRegisterVerifyOTP";
import { useRegisterResendOTP } from "../hooks/useRegisterResendOTP";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import ButtonLoading from "@/components/atoms/buttonloading";

export function OTPForm() {
    const router = useRouter()
    const pendingEmail = Cookies.get('pending_email')
    const { handleSubmit, control , formState:{errors}} = useForm<otpFormData>({resolver:zodResolver(OTPSchema)})
    const {mutate:useVerify , isSuccess:isVerified , isPending:isVerifing } = useRegisterVerifyOTP()
    const {mutate:useResend , isSuccess:isResent, isPending:isResending } = useRegisterResendOTP()



    
    const verifyOTP: SubmitHandler<otpFormData> = (data) => {
        if (!!pendingEmail) useVerify({ ...data, email:pendingEmail} , {
            onSuccess(data, variables, onMutateResult, context) {
                router.push('/dashboard/profile/')
            },
        })
        if(!pendingEmail) router.push("/register/")
    }


    const ResendOTP = () => {
        if (!!pendingEmail) useResend({email : pendingEmail})
        if(!pendingEmail) router.push("/register/")
    }
    

    


    return (
        <form className="otp_component mx-auto max-w-md border rounded-2xl font-manrope" onSubmit={handleSubmit(verifyOTP)}>
            <div className="otp_header mb-2 p-4">
                <h2 className="font-bold text-darkmint mb-2 text-xl">Verify your login</h2>
                <p className="text-graytext2 mb-2">
                    Enter the verification code we sent to your email address:{" "}
                    <span className="font-medium">{pendingEmail}</span>.
                </p>
                <span className="text-graytext2 mb-2">Note : The code will expire in 10 minutes</span>.
            </div>

            <div className="otp_body p-4">
                <Field>
                <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="otp-verification" className="text-darktext">
                        Verification code
                    </FieldLabel>
                    <Button variant="outline" size="sm" className="text-darktext" disabled={isResending} type="button" onClick={ResendOTP} >
                        <RefreshCwIcon />
                        Resend Code
                    </Button>
                </div>
                <div className="flex items-center justify-center flex-wrap my-2">
                    <Controller control={control} name="otp_code" render={({ field, fieldState }) => (
                            <>
                                <InputOTP maxLength={6}  id="otp-verification"  pattern={REGEXP_ONLY_DIGITS} value={field.value}  onChange={field.onChange} >
                                    <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-15 *:data-[slot=input-otp-slot]:w-15 *:data-[slot=input-otp-slot]:text-xl mx-auto">
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                    <InputOTPSlot index={3} />
                                    <InputOTPSlot index={4} />
                                    <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                </InputOTP>
                                {fieldState.error && (
                                    <span className="text-sm text-red-400 mt-2">{fieldState.error.message}</span>
                                )}
                            </> 
                        )}
                    />
                </div>
                </Field>
            </div>

            <div className="otp_footer p-4 border-t bg-graylighttext/5">
                <Field>
                <Button type="submit" variant={"darkmint"} className="w-full" disabled={isVerifing}>
                    {   isVerifing ?
                            <ButtonLoading/> : 
                        "Verify"
                    }
                </Button>
                <div className="text-muted-foreground text-sm text-center">
                    Having trouble signing in?{" "}
                    <a
                    href="#"
                    className="hover:text-primary underline underline-offset-4 transition-colors"
                    >
                    Contact support
                    </a>
                </div>
                </Field>
            </div>
        </form>
    )
}
