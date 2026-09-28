"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, Lock, RotateCcw } from "lucide-react";
import { FaCircleCheck } from "react-icons/fa6";
import { FaPlayCircle } from "react-icons/fa";
import { MdOutlineQuiz } from "react-icons/md";
import { Skeleton } from "@/components/atoms/skeleton";
import { useUIStore } from "@/store/ui.store";
import { useEnrolledStudentCourseOverview } from "../../hooks/useEnrolledStudentCourseOverView";
import { Section } from "../../types/progress.types";
import { Button } from "@/components/atoms/button";

function getLectureStats(sections: Section[]): {
    completed: number;
    total: number;
} {
    return sections.reduce(
        (stats, section) => {
            stats.total += section.lectures.length;
            
            stats.completed += section.lectures.filter(l => l.is_completed).length;
            
            return stats;
        },
        { completed: 0, total: 0 } 
    );
}

function getInitialExpandedSections(sections: Section[]) {
    const activeSection = sections.find((section) =>
        section.is_unlocked && !section.is_completed
    ) ?? sections.find((section) => section.is_unlocked) ?? sections[0];

    return activeSection ? { [activeSection.id]: true } : {};
}

function SidebarSkeleton() {
    return (
        <div className="flex h-[calc(100vh-4rem)] w-80 flex-col">
            <div className="flex items-center justify-between gap-3 p-6">
                <Skeleton className="h-7 w-52" />
                <Skeleton className="h-8 w-8" />
            </div>
            <div className="border-b border-border/30 px-6 py-4">
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-1.5 w-full" />
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
                {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-20 w-full rounded-lg" />
                ))}
            </div>
        </div>
    );
}

export function LearnSideBar() {
    const params = useParams<{ id?: string; lectureId?: string; quizId?: string }>();
    const courseId = params.id;

    const sidebar = useUIStore((state) => state);
    const isSidebarOpen = sidebar.isLearnSideBarOpen;

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    
    const { data, isLoading, isError, refetch , isForbidden , customErrorMessage } = useEnrolledStudentCourseOverview(courseId ?? "");
    
    const initialExpandedSections = useMemo(
        () => getInitialExpandedSections(data?.sections ?? []),
        [data?.sections]
    );
    
    

    const toggleSidebar = () => {
        sidebar.toggleLearnSideBar(!isSidebarOpen);
    };

    const toggleSection = (sectionId: number) => {
        setExpandedSections((prev) => ({
            ...prev,
            [sectionId]: !(prev[sectionId] ?? initialExpandedSections[sectionId]),
        }));
    };

    if (!courseId || isLoading) return <SidebarSkeleton />;

    if (isForbidden) return
    
    if (isError || !data) {
        return (
            <div className="flex h-[calc(100vh-4rem)] w-80 flex-col">
                <div className="flex items-center justify-between gap-3 p-6">
                    <h2 className="text-lg font-bold text-darktext">Course navigation</h2>
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        className="rounded-md p-1.5 transition-all duration-200 hover:bg-muted/30"
                        aria-label="Close course navigation"
                    >
                        <ChevronLeft className="h-4 w-4 text-darktext" />
                    </button>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-sm text-graytext2">Could not load course navigation.</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="flex items-center gap-2 rounded-md bg-darkmint px-4 py-2 text-sm font-semibold text-white"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const { completed, total } = getLectureStats(data.sections);
    const progress = Number(data.progress) || 0;

    return (
        <div className="flex h-[calc(100vh-4rem)] w-80 flex-col">
            <div className="flex items-center justify-between gap-3 p-6">
                <h2 className="line-clamp-2 text-lg font-bold text-darktext transition-all duration-300">
                    {data.course.title}
                </h2>
                <button
                    type="button"
                    onClick={toggleSidebar}
                    className="rounded-md p-1.5 transition-all duration-200 hover:bg-muted/30"
                    aria-label="Close course navigation"
                >
                    <ChevronLeft className="h-4 w-4 text-darktext" />
                </button>
            </div>

            <div className="border-b border-border/30 px-6 py-4">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-medium text-darktext">
                        <span>{progress}% Complete</span>
                        <span>{completed}/{total}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-darktext/20">
                        <div
                            className="h-full rounded-full bg-darkmint transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
                {data.sections.map((section) => {
                    const isExpanded = expandedSections[section.id] ?? initialExpandedSections[section.id] ?? false;

                    return (
                        <div key={section.id} className={section.is_unlocked ? "group" : "group opacity-60"}>
                            <button
                                type="button"
                                onClick={() => section.is_unlocked && toggleSection(section.id)}
                                className={`mb-1 flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors duration-200 focus:outline-none ${
                                    section.is_unlocked
                                        ? "hover:bg-darkmint/20"
                                        : "cursor-not-allowed"
                                }`}
                                disabled={!section.is_unlocked}
                            >
                                <div className="flex min-w-0 flex-col">
                                    <span className="text-xs font-medium uppercase tracking-wider text-darktext/70">
                                        Section {section.order}
                                    </span>
                                    <span className="truncate text-sm font-semibold text-darktext">{section.title}</span>
                                </div>
                                {!section.is_unlocked ? (
                                    <Lock className="h-4.5 w-4.5 flex-shrink-0 text-darktext/70" />
                                ) : isExpanded ? (
                                    <ChevronUp className="h-5 w-5 text-darktext transition-transform" />
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-darktext transition-transform" />
                                )}
                            </button>

                            {isExpanded && section.is_unlocked && (
                                <div className="ml-3 flex flex-col space-y-1 border-l-2 border-darktext/20 py-1 pl-4">
                                    {section.lectures.map((lecture) => {
                                        const isActive = params.lectureId === String(lecture.id);
                                        const isLocked = !lecture.is_unlocked;
                                        const content = (
                                            <>
                                                {lecture.is_completed ? (
                                                    <FaCircleCheck className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-darkmint" />
                                                ) : isLocked ? (
                                                    <Lock className="mt-0.5 h-4.5 w-4.5 flex-shrink-0" />
                                                ) : (
                                                    <FaPlayCircle className="mt-0.5 h-4.5 w-4.5 flex-shrink-0" />
                                                )}
                                                <div className="flex min-w-0 flex-1 flex-col">
                                                    <span className={`truncate text-sm ${lecture.is_completed ? "line-through opacity-70" : ""}`}>
                                                        {lecture.title}
                                                    </span>
                                                    <span className="text-xs opacity-70">{lecture.duration} min</span>
                                                </div>
                                            </>
                                        );

                                        if (isLocked) {
                                            return (
                                                <div
                                                    key={lecture.id}
                                                    className="flex cursor-not-allowed items-start gap-3 rounded-md p-2 text-darktext/50"
                                                >
                                                    {content}
                                                </div>
                                            );
                                        }

                                        return (
                                            <Link
                                                key={lecture.id}
                                                href={`/dashboard/learn/${courseId}/lecture/${lecture.id}`}
                                                className={`relative flex items-start gap-3 overflow-hidden rounded-md p-2 transition-colors ${
                                                    isActive
                                                        ? "bg-darkmint/90 text-white"
                                                        : "text-darktext/80 hover:bg-darkmint/20"
                                                }`}
                                            >
                                                {content}
                                            </Link>
                                        );
                                    })}

                                    {section.quiz && (
                                        section.quiz.is_unlocked ? (
                                            <Link
                                                href={`/dashboard/learn/${courseId}/quiz/${section.quiz.id}`}
                                                className={`flex items-start gap-3 rounded-md p-2 transition-colors ${
                                                    params.quizId === String(section.quiz.id)
                                                        ? "bg-darkmint/90 text-white"
                                                        : "text-darktext/80 hover:bg-darkmint/20"
                                                }`}
                                            >
                                                {section.quiz.is_passed ? (
                                                    <FaCircleCheck className="mt-0.5 h-4.5 w-4.5 flex-shrink-0 text-darkmint" />
                                                ) : (
                                                    <MdOutlineQuiz className="mt-0.5 h-4.5 w-4.5 flex-shrink-0" />
                                                )}
                                                <span className="truncate text-sm">{section.quiz.title}</span>
                                            </Link>
                                        ) : (
                                            <div className="flex cursor-not-allowed items-start gap-3 rounded-md p-2 text-darktext/50">
                                                <Lock className="mt-0.5 h-4.5 w-4.5 flex-shrink-0" />
                                                <span className="truncate text-sm">{section.quiz.title}</span>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
