"use client"
import { Button } from "@/components/atoms/button"
import { Field, FieldLabel } from "@/components//atoms/field"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/atoms/input-otp"
import { RefreshCwIcon } from "lucide-react"
import { otpFormData  , OTPSchema} from "../../schemas/auth.schma"
import { zodResolver } from "@hookform/resolvers/zod"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { Controller } from 'react-hook-form';

import { useForm, SubmitHandler } from "react-hook-form"

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import ButtonLoading from "@/components/atoms/buttonloading";
import { useForgetPasswordVerifyOTP } from "../../hooks/forget-password/useVerifyOTP"

export function FPverifyOTPForm() {
    const router = useRouter()
    const pendingEmail = Cookies.get('FG_email')
    const { handleSubmit, control , formState:{errors}} = useForm<otpFormData>({resolver:zodResolver(OTPSchema)})
    const {mutate:useVerify , isSuccess:isVerified , isPending:isVerifing } = useForgetPasswordVerifyOTP()
    // const {mutate:useResend , isSuccess:isResent, isPending:isResending } = useRegisterResendOTP()
    
    const verifyOTP: SubmitHandler<otpFormData> = (data) => {
        if (!!pendingEmail) useVerify({ ...data, email:pendingEmail} , {
            onSuccess(data) {
                router.push('/forget-password/reset/')
            },
        })
        if(!pendingEmail) router.push("/login/")
    }
    
    return (
            <form className="otp_component w-full" onSubmit={handleSubmit(verifyOTP)}>
                    <div className="otp_body">
                        <Field>
                        <div className="flex items-center justify-between">
                            <FieldLabel htmlFor="otp-verification" className="text-darktext ">
                                Verification code
                            </FieldLabel>
                            <Button variant="outline" size="sm" className="text-darktext"  type="button"  >
                                <RefreshCwIcon />
                                Resend Code
                            </Button>
                                
                        </div>
                        <div className="flex items-center justify-center flex-wrap my-2 w-full">
                            <Controller control={control} name="otp_code" render={({ field, fieldState }) => (
                                <>
                                    <InputOTP maxLength={6}  id="otp-verification"  pattern={REGEXP_ONLY_DIGITS} value={field.value}  onChange={field.onChange} >
                                        <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-17 *:data-[slot=input-otp-slot]:w-full *:data-[slot=input-otp-slot]:text-xl grid grid-cols-6 w-full ">
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
                    <div className="otp_footer my-4">
                        <Field>
                        <Button type="submit" variant={"darkmint"} className="w-full h-12" disabled={isVerifing}>
                            {isVerifing ? 
                                <ButtonLoading/> 
                            : 
                            (" Verify & Continue")
                            }
                        </Button>
                        </Field>
                    </div>
            </form>
    )
}
