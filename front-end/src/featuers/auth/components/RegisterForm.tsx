"use client";
import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { PasswordInput } from "@/components/atoms/password-input"
import { useForm, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema  ,RegisterFormData} from "../schemas/auth.schma";
import { useRegister } from "../hooks/useRegister";
import { useRouter } from "next/navigation";
import ButtonLoading from "@/components/atoms/buttonloading";

export function RegisterForm() {
    const router = useRouter()
    const {register , handleSubmit , formState:{errors}} = useForm<RegisterFormData>({resolver:zodResolver(registerSchema)})
    const {mutate:userRegister , isPending } = useRegister()
    const onSubmit: SubmitHandler<RegisterFormData> = (data) => {
        userRegister(data , {onSuccess(data, variables, onMutateResult, context) {
            router.push("/verifyotp/")
        },})
        
    }

        
    return (
            <form className="flex flex-col justify-between gap-5" onSubmit={handleSubmit(onSubmit)}>
                        <div className="flex h-12 w-full items-center justify-center rounded-xl bg-[#e7f0f3] p-1">
                            <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-checked:bg-white has-checked:shadow-sm has-checked:text-darktext text-darkmint text-sm font-bold transition-all">
                                <span className="truncate">Student</span>
                                <input className="hidden" type="radio" value="student"  defaultChecked {...register('role')}  />
                            </label>
                            <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-checked:bg-white has-checked:shadow-sm has-checked:text-darktext text-darkmint text-sm font-bold transition-all">
                                <span className="truncate">Instructor</span>
                                <input className="hidden" type="radio" value="instructor" {...register('role')} />
                            </label>
                        </div>
                        <div className="grid w-full  items-center gap-2">
                            <Label htmlFor="username" className="text-sm/5 font-semibold text-darktext ">Username</Label>
                            <Input type="username" id="username" placeholder="johndo" {...register('username') } />
                            {errors?.username && 
                                <span className="text-sm text-red-400">{errors?.username.message}</span>
                            }
                        </div>
                        <div className="grid w-full  items-center gap-2">
                            <Label htmlFor="email" className="text-sm/5 font-semibold text-darktext ">Email Address</Label>
                            <Input  id="email" placeholder="name@company.com" {...register('email')} />
                            {errors?.email && 
                            <span className="text-sm text-red-400">{errors?.email.message}</span>
                            } 
                        </div>
                        <div className="grid w-full  items-center gap-2">
                            <Label htmlFor="password" className="text-sm/5 font-semibold text-darktext ">Password</Label>
                            <PasswordInput id="password" placeholder="Enter your passowrd" {...register('password' )} />
                            {errors?.password  && 
                                <span className="text-sm text-red-400">{errors?.password.message}</span>
                            }
                        </div>
                        <Button className="shadow-[0px_10px_15px_-3px_rgba(43,88,105,0.1),0px_4px_6px_-4px_rgba(43,88,105,0.1)] h-12" disabled={isPending} variant={"darkmint"} type="submit">
                            { isPending ?
                                <ButtonLoading/> :
                                "Create Account"
                            }
                        </Button>
        </form>
    )
}
