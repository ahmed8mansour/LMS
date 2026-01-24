import Link from "next/link";
import LogoWithText from "../molecules/LogoWithText"
import { FaThreads } from "react-icons/fa6";
import { BsGlobeAsiaAustralia } from "react-icons/bs";

export default function Footer() {
    return (
        <footer className="footer_section font-manrope border-t border-darkbg py-12 md:py-16">
            <div className="container mx-auto px-4" >

                <div className="footer_top grid justify-between grid-cols-1 gap-4 md:grid-cols-2 mb-12 md:mb-16">

                    <div className=" footer_left flex flex-col items-start justify-between gap-6">
                        <LogoWithText />
                        <p className="font-normal text-sm/6 text-graytext2 md:pe-[30%]">The modern standard for online learning. Build skills, launch careers, and join a global community of experts.</p>
                        <div className="flex">
                            <Link href={"/"}>
                                <div className="w-10 h-10 ">
                                    <FaThreads className="w-6 h-7 text-graylighttext" />
                                </div>
                            </Link>

                            <Link href={"/"}>
                                <div className="w-10 h-10 ">
                                    <BsGlobeAsiaAustralia className="w-6 h-7 text-graylighttext" />
                                </div>
                            </Link>

                        </div>
                    </div>


                    <div className=" footer_right grid justify-between grid-cols-3 gap-4">
                        <ul>
                            <p className="mb-4 text-base font-bold  text-darktext">
                                Platform
                            </p>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Explore
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Pricing
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Enterprise
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Courses
                                </Link>
                            </li>


                        </ul>
                        <ul>
                            <p className="mb-4 text-base font-bold  text-darktext">
                                Company
                            </p>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    About Us
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Careers
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Partners
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Blog
                                </Link>
                            </li>


                        </ul>
                        <ul>
                            <p className="mb-4 text-base font-bold  text-darktext">
                                Legal
                            </p>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Terms of Service
                                </Link>
                            </li>
                            <li className="pb-3">
                                <Link href="#" className="text-graytext2  hover:text-graytext2/80 text-sm">
                                    Cookie Policy
                                </Link>
                            </li>
                        </ul>
                    </div>

                </div>


                <div className="footer_bottom flex items-center justify-center pt-8 border-t border-darkbg">
                    <p className="text-sm/4 text-center text-graylighttext">
                        © 2024 LMS Platform Inc. All rights reserved. Built for professional growth.
                    </p>

                </div>
            </div>
        </footer>
    )
}

