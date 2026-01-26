import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Button } from "@/components/atoms/button"
import { PasswordInput } from "@/components/atoms/password-input"
import { FaArrowRight } from "react-icons/fa";
import { BsGithub } from "react-icons/bs";
import Link from "next/link";
import { CiLock } from "react-icons/ci";
export default function Register() {
    return (
        <div className="register_component flex items-center justify-center h-full">
            <div className="xl:w-85/100 2xl:2/3  w-full flex items-center justify-center ">
                <div className="form_header mb-8">

                    <h2 className="text-darktext font-extrabold text-3xl/7.5 mb-2">Create your account</h2>
                    <p className="font-normal text-base/6 text-graylighttext mb-7 2xl:min-w-[360px]">Join our learning community today</p>
                    <form className="flex flex-col justify-between gap-5">
                        {/* User role radio group: Student checked by default, user can change */}
                        <div className="flex h-12 w-full items-center justify-center rounded-xl bg-[#e7f0f3] p-1">
                            <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-checked:bg-white has-checked:shadow-sm has-checked:text-darktext text-darkmint text-sm font-bold transition-all">
                                <span className="truncate">Student</span>
                                <input className="hidden" name="user-role" type="radio" value="Student" defaultChecked />
                            </label>
                            <label className="flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 has-checked:bg-white has-checked:shadow-sm has-checked:text-darktext text-darkmint text-sm font-bold transition-all">
                                <span className="truncate">Instructor</span>
                                <input className="hidden" name="user-role" type="radio" value="Instructor" />
                            </label>
                        </div>
                        <div className="grid w-full  items-center gap-2">
                            <Label htmlFor="username" className="text-sm/5 font-semibold text-darktext ">Username</Label>
                            <Input type="username" id="username" name="username" placeholder="johndo" required />
                        </div>
                        <div className="grid w-full  items-center gap-2">
                            <Label htmlFor="email" className="text-sm/5 font-semibold text-darktext ">Email Address</Label>
                            <Input type="email" id="email" name="email" placeholder="name@company.com" required />
                        </div>
                        <div className="grid w-full  items-center gap-2">
                            <Label htmlFor="password" className="text-sm/5 font-semibold text-darktext ">Password</Label>
                            <PasswordInput id="password" name="password" placeholder="Enter your passowrd" required />
                        </div>
                        <Button className="shadow-[0px_10px_15px_-3px_rgba(43,88,105,0.1),0px_4px_6px_-4px_rgba(43,88,105,0.1)] h-12" variant={"darkmint"}>
                            Create Account
                        </Button>
                    </form>
                    <div className="OAuto_area ">

                        <div className="relative  md:my-10 my-5 ">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-[#eaeff0]"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase tracking-widest">
                                <span className="bg-white dark:bg-background-dark px-4 text-[#5f7c86]">Or sign up with</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4  md:mb-10 mb-5">
                            <div className="flex-1">
                                <Button
                                    variant="outline"
                                    className="w-full h-11 border border-[#D5DEE1] flex items-center justify-center gap-2"
                                    type="button"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22px" height="22px">
                                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.1 2.38 29.95 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C14.65 13.92 18.88 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.33-4.77 6.81l7.98 6.19c4.64-4.32 7.32-10.11 7.32-17.45z" />
                                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.55 10.78l7.98-6.19z" />
                                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.98-6.19c-2.07 1.35-4.86 2.15-7.91 2.15-5.22 0-9.64-3.52-11.23-8.5l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                                    </svg>
                                    <span className="text-darktext text-sm/5 font-bold">Google</span>
                                </Button>
                            </div>
                            <div className="flex-1">
                                <Button
                                    variant="outline"
                                    className="w-full h-11 border border-[#D5DEE1] flex items-center justify-center gap-2"
                                    type="button"
                                >
                                    <BsGithub />
                                    <span className="text-darktext text-sm/5 font-bold">GitHub</span>
                                </Button>
                            </div>
                        </div>
                        <div className="border-t border-[#EAEFF0] pt-8  md:mb-10  mb-5">
                            <p className="text-sm/5 text-graylighttext text-center ">
                                Already have an account?
                                <Link href={"/login"} className="font-bold md:inline block text-darkmint ms-1">
                                    Sign in
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
    )
}
