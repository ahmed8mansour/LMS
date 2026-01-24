import Image from "next/image";
import { FaRegCirclePlay } from "react-icons/fa6";
import { IoMdTrendingUp } from "react-icons/io";
import { Button } from "../atoms/button";
import { Avatar, AvatarFallback, AvatarImage } from "../atoms/avatar";
export default function Hero() {
    return (
        <div className="Hero_section min-h-[calc(100vh-65px)] py-16 md:py-24 font-manrope" id="hero_section"
        >
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-0 md:gap-x-12">
                    <div className="left_side flex flex-col justify-center">
                        <div className="py-1 px-3 h-7 w-fit rounded-xl bg-lightmint text-darkmint flex items-center justify-between gap-2">
                            <Image
                                alt="star icon"
                                src={"/images/home/threestars.svg"}
                                width={16}
                                height={16}
                                className="w-auto h-auto shrink-0"
                            />
                            <p className="font-bold text-xs md:text-sm leading-4">
                                NEW: ADVANCED AI SYSTEMS COURSE
                            </p>
                        </div>

                        <h1 className="font-extrabold text-[2.4rem] sm:text-4xl md:text-5xl lg:text-6xl xl:text-[60px] text-darktext mt-6 md:mt-8 leading-tight">
                            Master Your Craft with <span className="text-darkmint">Expert-Led</span> Courses
                        </h1>
                        <p className="text-base sm:text-lg md:text-xl leading-6 md:leading-7 text-graytext mt-4 max-w-2xl">
                            Join 50,000+ learners scaling their skills with industry-vetted curriculums and hands-on projects designed for professional growth.
                        </p>
                        <div className="pt-6 md:pt-8 flex flex-col sm:flex-row gap-4 sm:gap-0">
                            <Button className="bg-darkmint shadow-lg w-full sm:w-40 lg:w-54 h-12 md:h-14.5 hover:opacity-90 hover:bg-darkmint font-bold text-[14px]  lg:text-[16px]">
                                Get Started for Free
                            </Button>
                            <Button
                                className="text-darktext border-lightmint sm:w-40 w-full lg:w-54 h-12 md:h-14.5 font-bold text-[14px]  lg:text-[16px] sm:ms-4.5 flex items-center justify-center"
                                variant={"outline"}
                            >
                                <FaRegCirclePlay className="mr-1 w-5 h-5" />
                                How it works
                            </Button>
                        </div>
                        <div className="pt-4 md:pt-8 pb-1">
                            <div className="flex flex-wrap items-center pt-3 md:pt-4">
                                <Avatar className="w-8 h-8 md:w-10 md:h-10">
                                    <AvatarImage src="" alt="@shadcn" />
                                    <AvatarFallback className="bg-amber-200"></AvatarFallback>
                                </Avatar>
                                <Avatar className="-ms-2 w-8 h-8 md:w-10 md:h-10">
                                    <AvatarImage src="" alt="@maxleiter" />
                                    <AvatarFallback className="bg-red-200"></AvatarFallback>
                                </Avatar>
                                <Avatar className="-ms-2 w-8 h-8 md:w-10 md:h-10">
                                    <AvatarImage
                                        src=""
                                        alt="@evilrabbit"
                                    />
                                    <AvatarFallback className="bg-blue-200"></AvatarFallback>
                                </Avatar>
                                <p className="ms-4 text-xs md:text-sm font-semibold text-graytext mt-2 md:mt-0">
                                    Trusted by over <span className="text-darktext">50k+ students</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="right_side hero_right mt-10 md:mt-0 flex md:block justify-center">
                        <div className="image_parent w-full h-[320px] sm:h-[400px] md:h-full relative border border-lightmint rounded-[24px] md:rounded-[32px] max-w-full md:max-w-[590px] min-h-[320px] sm:min-h-[400px] md:min-h-[590px] ms-auto flex items-end md:items-stretch">
                            <Image
                                src="/images/home/hero.png"
                                alt="hero section image"
                                fill
                                sizes="100%"
                                className="opacity-80 mix-blend-overlay rounded-[24px] md:rounded-[32px] object-cover"
                            />

                            <div className="w-[92%] md:w-4/5 absolute left-1/2 -translate-x-1/2 p-3 md:p-6 rounded-lg md:rounded-xl bottom-4 md:bottom-8 h-18 md:h-24 shadow-lg bg-white z-10 flex justify-start items-center gap-x-2 md:gap-x-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-darkmint/20 rounded-full flex items-center justify-center">
                                    <IoMdTrendingUp className="text-darkmint w-5 h-5 md:w-6 md:h-6" />
                                </div>
                                <div className="truncate">
                                    <p className="font-bold text-[10px] md:text-xs text-darkmint uppercase truncate">
                                        Most Popular This Month
                                    </p>
                                    <p className="font-bold text-xs md:text-sm text-darktext truncate">
                                        Fullstack Development with Next.js 14
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
