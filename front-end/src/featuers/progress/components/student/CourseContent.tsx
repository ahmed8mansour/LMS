"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, PlayCircle, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/atoms/skeleton";
import { Button } from "@/components/atoms/button";
import { useUIStore } from "@/store/ui.store";
import { useEnrolledStudentCourseOverview } from "../../hooks/useEnrolledStudentCourseOverView";
import { Lecture, Section } from "../../types/progress.types";
import { useRouter } from 'next/navigation'

interface CourseContentProps {
    courseId: string | number;
}

function getTotalDuration(sections: Section[]) {
    const totalMinutes = sections.reduce((sum, section) => {
        const sectionMinutes = section.lectures.reduce((lectureSum, lecture) => {
            const duration = Number.parseFloat(lecture.duration);
            return lectureSum + (Number.isNaN(duration) ? 0 : duration);
        }, 0);

        return sum + sectionMinutes;
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function getFirstPlayableLecture(sections: Section[]): Lecture | null {
    for (const section of sections) {
        const incomplete = section.lectures.find((lecture) => lecture.is_unlocked && !lecture.is_completed);
        if (incomplete) return incomplete;

        const unlocked = section.lectures.find((lecture) => lecture.is_unlocked);
        if (unlocked) return unlocked;
    }

    return null;
}

function CourseContentSkeleton() {
    return (
        <div className="mx-auto flex flex-col gap-8 px-6 py-8 md:px-10 md:py-12">
            <Skeleton className="aspect-video w-full max-h-100 rounded-xl" />
            <div className="flex flex-col gap-4">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-11 w-full max-w-2xl" />
                <Skeleton className="h-24 w-full max-w-3xl" />
            </div>
            <Skeleton className="h-20 w-72 rounded-xl" />
        </div>
    );
}

export function CourseContent({ courseId }: CourseContentProps) {
    const isSidebarOpen = useUIStore((state) => state.isLearnSideBarOpen);
    const { data, isLoading, isError, refetch , isForbidden , customErrorMessage } = useEnrolledStudentCourseOverview(courseId);
    const router = useRouter();
    if (isLoading) return <CourseContentSkeleton />;

    if (isForbidden){
        return(
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
                <h1 className="text-2xl font-bold text-darktext">You aren't allowed to access this course</h1>
                <p className="text-sm text-graytext2">{customErrorMessage}</p>
                <Button variant="darkmint" onClick={() => router.replace(`/courses/${courseId}`)} className="gap-2">
                    please enroll first
                </Button>
            </div>
        )
    }
    if (isError || !data) {
        return (
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
                <h1 className="text-2xl font-bold text-darktext">Course content is unavailable</h1>
                <p className="text-sm text-graytext2">We could not load this enrolled course. Try again or return to your dashboard.</p>
                <Button variant="darkmint" onClick={() => refetch()} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    const { course, sections } = data;
    const firstLecture = getFirstPlayableLecture(sections);
    const progress = Number(data.progress) || 0;
    const instructor = course.instructor_profile;
    const instructorName = `${instructor?.first_name ?? ""} ${instructor?.last_name ?? ""}`.trim() || "Instructor";
    const startHref = firstLecture
        ? `/dashboard/learn/${courseId}/lecture/${firstLecture.id}`
        : `/dashboard/learn/${courseId}/complete`;

    return (
        <>
            <div className="mx-auto flex flex-col gap-8 px-6 py-8 pb-40 md:px-10 md:py-12">
                <div className="relative aspect-video w-full max-h-100 overflow-hidden rounded-xl bg-card shadow-sm">
                    {course.thumbnail ? (
                        <Image
                            alt={course.title}
                            className="h-full w-full object-cover"
                            src={course.thumbnail}
                            width={1280}
                            height={720}
                            priority
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center bg-darkbg text-darkmint">
                            <BookOpen className="h-16 w-16" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-darkmint/60 via-transparent to-transparent opacity-80" />
                </div>

                <div className="flex flex-col gap-6">
                    <div>
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-darkmint/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-darkmint">
                                {course.category}
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-graytext/10 px-2.5 py-1 text-xs font-medium text-graytext">
                                <Clock className="h-3.5 w-3.5" /> {getTotalDuration(sections)}
                            </span>
                            <span className="flex items-center gap-1 rounded-full bg-graytext/10 px-2.5 py-1 text-xs font-medium text-graytext">
                                <BookOpen className="h-3.5 w-3.5" /> {sections.length} Sections
                            </span>
                        </div>

                        <h1 className="mb-4 text-3xl font-extrabold leading-tight text-darktext md:text-4xl">
                            {course.title}
                        </h1>
                        <p className="max-w-3xl text-base leading-relaxed text-muted-foreground md:text-lg">
                            {course.description}
                        </p>
                    </div>

                    <div className="w-full max-w-3xl">
                        <div className="mb-2 flex items-center justify-between text-sm font-medium text-darktext">
                            <span>{progress}% Complete</span>
                            <span>{sections.filter((section) => section.is_completed).length}/{sections.length} sections</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-darktext/15">
                            <div
                                className="h-full rounded-full bg-darkmint transition-all duration-500"
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex w-fit items-center gap-4 rounded-xl border border-border bg-background p-4">
                        {instructor?.profile_picture ? (
                            <Image
                                alt={instructorName}
                                className="h-12 w-12 rounded-full object-cover"
                                src={instructor.profile_picture}
                                width={48}
                                height={48}
                            />
                        ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-darkmint/10 text-sm font-bold text-darkmint">
                                {instructorName.slice(0, 1)}
                            </div>
                        )}
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-darktext">{instructorName}</span>
                            <span className="text-xs text-graytext">{instructor?.specific_data?.title ?? "Course instructor"}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className={`fixed bottom-0 left-0 z-20 w-full border-t border-border bg-background/80 p-4 backdrop-blur-md transition-[left,width] duration-300 ease-in-out ${
                    isSidebarOpen ? "md:left-80 md:w-[calc(100%-20rem)]" : "md:left-0 md:w-full"
                }`}
            >
                <Link
                    href={startHref}
                    className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-lg bg-darkmint px-8 py-3.5 text-base font-bold text-primary-foreground shadow-sm transition-colors duration-300 hover:bg-darkmint/90"
                >
                    <PlayCircle className="h-5 w-5" />
                    {progress >= 100 ? "Review Course" : "Start Learning"}
                </Link>
            </div>
        </>
    );
}
