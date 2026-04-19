"use client";

import Link from "next/link";
import { Button } from "../atoms/button";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "../atoms/avatar";
import { IoMdStarOutline } from "react-icons/io";
import { BookOpen, Play } from "lucide-react";
import { CourseSummary } from "@/featuers/courses/types/course.types";

interface CourseCardProps {
    course: CourseSummary;
}

export default function CourseCard({ course }: CourseCardProps) {
    const {
        id,
        thumbnail,
        title,
        description,
        price,
        rating,
        subscribers_count,
        instructor_profile,
        category,
        enrolled_status,
    } = course;

    const buttonConfig = enrolled_status
        ? {
              href: `/dashboard/my-courses`,
              text: "Continue Learning",
              icon: <Play size={16} />,
              variant: "darkmint" as const,
          }
        : {
              href: `/courses/${id}`,
              text: "Enroll Now",
              icon: <BookOpen size={16} />,
              variant: "outline" as const,
          };

    return (
        <div className="group overflow-hidden rounded-xl p-4 border border-graytext/20 shadow-lg transition-all duration-300 hover:-translate-y-2 bg-white cursor-pointer">
            <Link href={`/courses/${id}`}>
                {/* Preview Area */}
                <div className="relative h-56 bg-gradient-to-br from-darkmint/80 via-darkmint to-darkmint/60 p-6 rounded-2xl overflow-hidden">
                    <Image
                        src={thumbnail}
                        alt={title}
                        fill
                        className="object-cover w-full h-full transform transition-transform duration-300 group-hover:scale-105 rounded-2xl"
                    />
                    {category && (
                        <div className="absolute z-10 w-fit h-6 py-1 px-2 bg-white rounded-[4px] text-darkmint left-3 top-3 uppercase font-extrabold text-[10px]">
                            {category}
                        </div>
                    )}
                    {enrolled_status && (
                        <div className="absolute z-10 w-fit h-6 py-1 px-2 bg-darkmint rounded-[4px] text-white right-3 top-3 uppercase font-extrabold text-[10px] flex items-center gap-1">
                            <Play size={10} />
                            Enrolled
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="space-y-4 py-5">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-darktext group-hover:text-darkmint">
                                {title}
                            </h3>
                            <p className="text-base font-bold text-darkmint">${price}</p>
                        </div>
                        <p className="line-clamp-2 text-sm text-graytext2">{description}</p>
                        <div className="flex items-center justify-between pt-4">
                            <div className="flex items-center">
                                <Avatar className="w-6 h-6">
                                    <AvatarImage
                                        src={instructor_profile?.profile_picture}
                                        alt={instructor_profile?.first_name}
                                    />
                                    <AvatarFallback className="bg-darkmint/10 text-darkmint text-xs">
                                        {instructor_profile?.first_name?.charAt(0)}
                                    </AvatarFallback>
                                </Avatar>
                                <p className="text-xs font-semibold text-darktext ms-2">
                                    {instructor_profile?.first_name}
                                </p>
                            </div>
                            <div className="flex items-center gap-x-2">
                                <div className="text-[#F59E0B] flex items-center gap-x-1">
                                    <IoMdStarOutline />
                                    {rating}
                                </div>
                                <div className="text-graytext2">({subscribers_count})</div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2">
                        <Button
                            asChild
                            variant={buttonConfig.variant}
                            size="default"
                            className="w-full"
                        >
                            <Link href={buttonConfig.href}>
                                {buttonConfig.icon}
                                {buttonConfig.text}
                            </Link>
                        </Button>
                    </div>
                </div>
            </Link>
        </div>
    );
}

