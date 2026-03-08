"use client";
import { useForm, SubmitHandler } from "react-hook-form"

import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { PasswordInput } from "@/components/atoms/password-input"
import { FaArrowRight } from "react-icons/fa";
import { LoginSchema  ,LoginFormData} from "../schemas/auth.schma";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useLogin } from "../hooks/useLogin";
import ButtonLoading from "@/components/atoms/buttonloading";
import Link from "next/link";


export function LoginForm() {
    const router = useRouter()
    const {register , handleSubmit, control , formState:{errors}} = useForm<LoginFormData>({resolver:zodResolver(LoginSchema)})
    const {mutate:userLogin ,error , isSuccess , isPending , isError} = useLogin()
    

    
    const onSubmit: SubmitHandler<LoginFormData> = (data) => {
        console.log(data)
        userLogin(data , {
            onSuccess(data) {
                router.push("/")
            },
            onError(error) {
                const message = error.response?.data?.error?.join('\n');
                if (message === "Account is disabled. Please verify your email.") {
                    router.push('/verifyotp/')
                }
            },
        })
        
    }
    
    return (
            <form className="flex flex-col justify-between gap-5" onSubmit={handleSubmit(onSubmit)}>
                <div className="grid w-full  items-center gap-2">
                    <Label htmlFor="email" className="text-sm/5 font-semibold text-darktext ">Email Address</Label>
                    <Input id="email" placeholder="name@company.com" {...register('email')} />
                    {errors?.email && 
                        <span className="text-sm text-red-400">{errors?.email.message}</span>
                    } 
                </div>
                <div className="grid w-full  items-center gap-2">
                    <Label htmlFor="password" className="text-sm/5 font-semibold text-darktext ">Password</Label>
                    <PasswordInput id="password" placeholder="Enter your passowrd" {...register('password')} />
                    {errors?.password && 
                        <span className="text-sm text-red-400">{errors?.password.message}</span>
                    } 
                </div>
                <Link href={'/forget-password'} className="text-darkmint font-normal text-sm">
                    Forget your password ? 
                </Link>
                <Button className="shadow-[0px_10px_15px_-3px_rgba(43,88,105,0.1),0px_4px_6px_-4px_rgba(43,88,105,0.1)] h-12" variant={"darkmint"} disabled={isPending}>
                    { isPending ? (
                        <ButtonLoading />
                    ) : (
                        <>Sign In to Dashboard <FaArrowRight /></>
                    )}
                </Button>
            </form>
    )
}
