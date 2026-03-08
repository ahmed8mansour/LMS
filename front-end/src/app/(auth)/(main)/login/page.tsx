'use client'

import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { PasswordInput } from "@/components/atoms/password-input"
import { FaArrowRight } from "react-icons/fa";
import Link from "next/link";
import { CiLock } from "react-icons/ci";
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BsGithub } from "react-icons/bs"
import { LoginForm, GoogleLoginButton } from "@/featuers/auth"

export default function Login() {
    return (
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
            <div className="login_component flex items-center justify-center h-full">
                <div className="xl:w-85/100 2xl:2/3 w-full flex items-center justify-center ">
                    <div className="form_header mb-8">
                        <h2 className="text-darktext font-extrabold text-3xl/7.5 mb-2">Welcome back</h2>
                        <p className="font-normal text-base/6 text-graylighttext mb-7">Enter your credentials to access your dashboard.</p>
                        <LoginForm />
                        <div className="OAuto_area ">

                            <div className="relative md:my-10 my-5">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-[#eaeff0]"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase tracking-widest">
                                    <span className="bg-white dark:bg-background-dark px-4 text-[#5f7c86]">Or continue with</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 md:mb-10 mb-5">
                                <div className="flex-1">
                                    <GoogleLoginButton />
                                </div>
                            </div>
                            <div className="border-t border-[#EAEFF0] pt-8 md:mb-10  mb-5">
                                <p className="text-sm/5 text-graylighttext text-center ">
                                    Don't have an account?
                                    <Link href={"/register"} className="font-bold md:inline block text-darkmint ms-1">
                                        Create an account
                                    </Link>
                                </p>
                            </div>
                            <div className="text-center text-graylighttext">

                                <p className="text-xs/4 uppercase flex items-center justify-center gap-2"> <CiLock className="h-4 w-4" /> Securely Encrypted Session</p>

                            </div>

                        </div>

                    </div>
                </div>
            </div>
        </GoogleOAuthProvider>
    )
}