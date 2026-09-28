"use client"
import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { useEnrolledLectureDetail } from "../../hooks/useEnrolledLectureDetail";
import Link from "next/link";
import { useStudentDashboardCourses } from "../../hooks/useStudentDashboardCourses";
import { useEnrolledStudentCourseOverview } from "../../hooks/useEnrolledStudentCourseOverView";
import { Lecture } from "../../types/progress.types";
import { useMakeLectureCompleted } from "../../hooks/useMakeLectureComplete";
import ButtonLoading from "@/components/atoms/buttonloading";

export function MarkLectureComplete({ lecture }: { lecture: Lecture }) {
    const {mutate: makeLectureCompleted , isPending} = useMakeLectureCompleted(lecture.id)


    return (
        <Button
            type="button"
            variant="darkmint"
            onClick={() => makeLectureCompleted()}
            className="w-full py-4 font-bold text-lg flex items-center justify-center gap-2 min-h-12"
            disabled={lecture.is_completed || isPending}
        >
            {isPending ? <ButtonLoading /> : 
                <>
                    <Check className="w-5 h-5" />
                    {lecture.is_completed ? "Completed" : "Mark as Complete"}
                </>
            }
        </Button>
    )
}
