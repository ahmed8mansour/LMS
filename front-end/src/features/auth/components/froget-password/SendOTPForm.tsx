"use client";
import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgetPassSendOTPFormData , ForgetPassSendOTPSchema } from "../../schemas/auth.schma";
import { useRouter } from "next/navigation";
import ButtonLoading from "@/components/atoms/buttonloading";
import { FaArrowRight } from "react-icons/fa";
import { useForgetPasswordSendOTP } from "../../hooks/forget-password/useSendOTP";
import { useGoogleSetPasswordSendOTP } from "../../hooks/forget-password/useGoogleSetPasswordSendOTP";
import Cookies from "js-cookie";

interface FPsendOTPFormProps {
    mode?: 'forget_password' | 'google_set_password';
    onSuccessPath?: string;
}

export function FPsendOTPForm({ mode = 'forget_password', onSuccessPath }: FPsendOTPFormProps) {
    const router = useRouter()
    const pendingEmail = Cookies.get('FG_email')
    const isGoogleMode = mode === 'google_set_password'
    const { register , handleSubmit, formState:{errors} } = useForm<ForgetPassSendOTPFormData>({
        resolver: isGoogleMode ? undefined : zodResolver(ForgetPassSendOTPSchema)
    })

    const { isPending: isForgetPending , mutate: sendForgetOTP } = useForgetPasswordSendOTP()
    const { isPending: isGooglePending , mutate: sendGoogleOTP } = useGoogleSetPasswordSendOTP()
    const isPending = isForgetPending || isGooglePending

    const SubmitOTP: SubmitHandler<ForgetPassSendOTPFormData> = (data) => {
        if (isGoogleMode) {
            sendGoogleOTP(undefined, {
                onSuccess() {
                    router.replace(onSuccessPath ?? '/google-set-password/verify/')
                },
            })
            return
        }

        sendForgetOTP(data , {
            onSuccess() {
                router.replace(onSuccessPath ?? '/forget-password/verify/')
            },
        })
    }

    return (
        <form className="flex flex-col justify-between w-full" onSubmit={handleSubmit(SubmitOTP)}>
            {!isGoogleMode && (
                <div className="grid w-full  items-center gap-2">
                    <Label htmlFor="email" className="text-sm/5 font-semibold text-darktext ">Email Address</Label>
                    <Input id="email"  placeholder="name@company.com" {...register("email")} />
                    {errors?.email && 
                        <span className="text-sm text-red-400">{errors?.email.message}</span>
                    }
                </div>
            )}
            <Button className="shadow-[0px_10px_15px_-3px_rgba(43,88,105,0.1),0px_4px_6px_-4px_rgba(43,88,105,0.1)] h-12 my-8" variant={"darkmint"} disabled={isPending}>
                    {isPending ? 
                    <ButtonLoading/>
                    : 
                    <>Send OTP <FaArrowRight /></>
                    }
            </Button>
        </form>
    )
}
