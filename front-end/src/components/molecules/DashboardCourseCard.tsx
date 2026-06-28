"use client";

import { Button } from "@/components/atoms/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";
import { CheckCircle, Play } from "lucide-react";
import Image from "next/image";

interface DashboardCourseCardProps {
    id: string;
    imageUrl: string;
    title: string;
    instructor: string;
    instructorAvatar?: string;
    progress: number;
    isCompleted?: boolean;
}

export function DashboardCourseCard({
    id,
    imageUrl,
    title,
    instructor,
    instructorAvatar,
    progress,
    isCompleted = false,
}: DashboardCourseCardProps) {
    return (
        <div className="bg-white rounded-xl border border-graytext/20 overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
            <div className="h-40 overflow-hidden relative">
                <Image
                    src={imageUrl}
                    alt={title}
                    width={400}
                    height={160}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {isCompleted && (
                    <div className="absolute top-2 right-2 bg-darkmint text-white px-2 py-1 rounded text-xs font-semibold shadow flex items-center gap-1">
                        <CheckCircle size={12} />
                        Done
                    </div>
                ) }
            </div>
            <div className="p-5">
                <h4 className="font-bold text-darktext mb-1 line-clamp-1 group-hover:text-darkmint transition-colors">{title}</h4>
                <div className="flex items-center gap-2 mb-4">
                    <Avatar className="w-6 h-6">
                        <AvatarImage src={instructorAvatar} alt={instructor} />
                        <AvatarFallback className="bg-darkmint/10 text-darkmint text-xs">
                            {instructor?.split(" ").map(n => n[0]).join("").toUpperCase() || "I"}
                        </AvatarFallback>
                    </Avatar>
                    <p className="text-sm text-graytext2">{instructor}</p>
                </div>
                <div className="mb-5">
                    <div className="flex justify-between text-xs mb-1.5 font-medium text-graytext2">
                        <span>Overall Progress</span>
                        <span>{progress}% Complete</span>
                    </div>
                    <div className="w-full bg-graytext/20 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-darkmint h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
                <Button
                    variant={isCompleted ? "outline" : "darkmint"}
                    size="sm"
                    className="w-full gap-2"
                >
                    {isCompleted ? (
                        <>
                            <CheckCircle size={16} />
                            Review Course
                        </>
                    ) : (
                        <>
                            <Play size={16} />
                            Continue Learning
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
