"use client"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { PasswordInput } from "@/components/atoms/password-input"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgetPassResetFormData, ForgetPassResetSchema } from "../../schemas/auth.schma";
import { useRouter } from "next/navigation";
import ButtonLoading from "@/components/atoms/buttonloading";
import { FaArrowRight } from "react-icons/fa";
import { useResetPassword } from "../../hooks/forget-password/useResetPassword";

export function ResetPasswordForm() {
    const router = useRouter()
    const { register, handleSubmit, formState: { errors } } = useForm<ForgetPassResetFormData>({
        resolver: zodResolver(ForgetPassResetSchema)
    })
    const { isPending, mutate: resetPassword } = useResetPassword()

    const onSubmit: SubmitHandler<ForgetPassResetFormData> = (data) => {
        resetPassword({new_password: data.password}, {
            onSuccess(data){
                router.push('/')
            }
        })    
    
    }

    return (
        <form className="flex flex-col justify-between w-full" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid w-full  items-center gap-2 mb-3">
                <Label htmlFor="password" className="text-sm/5 font-semibold text-darktext ">New Password</Label>
                <PasswordInput id="password" placeholder="Enter your password" {...register("password")} />
                {errors?.password && 
                    <span className="text-sm text-red-400">{errors?.password.message}</span>
                }
            </div>
            <div className="grid w-full  items-center gap-2">
                <Label htmlFor="confirm_password" className="text-sm/5 font-semibold text-darktext ">Confirm Password</Label>
                <PasswordInput id="confirm_password" placeholder="Confirm your password" {...register("confirm_password")} />
                {errors?.confirm_password && 
                    <span className="text-sm text-red-400">{errors?.confirm_password.message}</span>
                }
            </div>
            <Button className="shadow-[0px_10px_15px_-3px_rgba(43,88,105,0.1),0px_4px_6px_-4px_rgba(43,88,105,0.1)] h-12 my-8" variant={"darkmint"} disabled={isPending}>
                {isPending ? 
                    <ButtonLoading />
                    : 
                    <>Reset Password <FaArrowRight /></>
                }
            </Button>
        </form>
    )
}
