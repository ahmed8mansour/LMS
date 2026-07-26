'use client';

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { useEnrolledLectureDetail } from "../../hooks/useEnrolledLectureDetail";
import { HlsVideoPlayer } from "@/components/molecules/HlsVideoPlayer";
import Link from "next/link";
import { useStudentDashboardCourses } from "../../hooks/useStudentDashboardCourses";
import { useEnrolledStudentCourseOverview } from "../../hooks/useEnrolledStudentCourseOverView";
import { MarkLectureComplete } from "./MarkLectureComplete";

import { getNextPreviousLecture } from "../../utils";
interface LectureContentProps {
  lectureId: string;
  id: string 
}

export function LectureContent({ lectureId , id }: LectureContentProps) {
  const { data: lecture, isLoading, isError, refetch, customErrorMessage } = useEnrolledLectureDetail(lectureId);
  const [activeTab, setActiveTab] = useState<'overview' | 'resources' | 'notes'>('overview');

  const { data: course_data } = useEnrolledStudentCourseOverview(parseInt(id));  
  const { previous , next} = getNextPreviousLecture(course_data, parseInt(lectureId))



  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8 lg:p-10 space-y-8 pb-24">
        <Skeleton className="w-full aspect-video rounded-xl" />
        <div>
          <Skeleton className="mb-3 h-10 w-3/4" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex flex-col gap-4 border-y border-border py-6 md:flex-row">
          <Skeleton className="h-12 flex-1" />
          <Skeleton className="h-12 flex-1" />
        </div>
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (isError || !lecture) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-bold text-darktext">Lecture unavailable</h1>
          <p className="text-sm text-graytext2">{customErrorMessage}</p>
          <Button
            type="button"
            variant="darkmint"
            onClick={() => refetch()}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 lg:p-10 space-y-8 pb-24">
      <div className="w-full aspect-video bg-darkbg rounded-xl overflow-hidden relative shadow-md group">
        <HlsVideoPlayer
          src={lecture.video_url}
          status={lecture.video_status}
          title={lecture.title}
          className="h-full w-full bg-darktext object-contain"
        />
      </div>

      <div>
        <h1 className="text-3xl md:text-4xl font-headline font-bold text-darktext mb-2 tracking-tight">
          {lecture.title}
        </h1>
        <p className="text-graytext font-medium">Lecture {lecture.order} - {lecture.duration} min</p>
      </div>

      <div className="flex flex-col gap-4 border-y border-border py-6 md:flex-row md:items-center md:justify-between">
          <Button 
            variant={"outline"} 
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 min-h-12 text-sm md:text-base border-darkmint/20"
            disabled={!previous}
            asChild={!!previous}
          >
            {previous ? (
              <Link href={previous} className="flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" />
                Previous Lecture
              </Link>
            ) : (
              <span className="flex items-center gap-2">
                <ChevronLeft className="w-5 h-5" />
                Previous Lecture
              </span>
            )}
          </Button>

          <Button 
            variant={"outline"} 
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 min-h-12 text-sm md:text-base border-darkmint/20"
            disabled={!next}
            asChild={!!next}
          >
            {next ? (
              <Link href={next} className="flex items-center gap-2">
                Next Lecture
                <ChevronRight className="w-5 h-5" />
              </Link>
            ) : (
              <span className="flex items-center gap-2">
                Next Lecture
                <ChevronRight className="w-5 h-5" />
              </span>
            )}
          </Button>
      </div>

      <MarkLectureComplete lecture={lecture} />

      <div className="mt-8 bg-background rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto hide-scrollbar bg-muted/10">
          <button className={`px-6 py-4 text-sm font-bold ${activeTab === 'overview' ? 'text-darkmint border-b-2 border-darkmint' : 'text-darktext hover:text-darkmint hover:bg-bg-muted/20'} transition-colors whitespace-nowrap`} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          <button className={`px-6 py-4 text-sm font-bold ${activeTab === 'resources' ? 'text-darkmint border-b-2 border-darkmint' : 'text-darktext hover:text-darkmint hover:bg-bg-muted/20'} transition-colors whitespace-nowrap`} onClick={() => setActiveTab('resources')}>
            Resources
          </button>
          <button className={`px-6 py-4 text-sm font-bold ${activeTab === 'notes' ? 'text-darkmint border-b-2 border-darkmint' : 'text-darktext hover:text-darkmint hover:bg-bg-muted/20'} transition-colors whitespace-nowrap`} onClick={() => setActiveTab('notes')}>
            Notes
          </button>
        </div>
        <div className="p-6 md:p-8">
          {activeTab === 'overview' && (
            <div>
              <h3 className="text-xl font-headline font-bold text-darktext mb-4">Lecture Overview</h3>
              <p className="text-muted-foreground leading-relaxed text-base max-w-3xl">
                {lecture.title}
              </p>
            </div>
          )}

          {activeTab === 'resources' && (
            <div>
              <h3 className="text-xl font-headline font-bold text-darktext mb-4">Lecture Resources</h3>
              <p className="text-muted-foreground leading-relaxed text-base max-w-3xl">
                Here are the resources for this lecture:
              </p>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <h3 className="text-xl font-headline font-bold text-darktext mb-4">Lecture Notes</h3>
              <p className="text-muted-foreground leading-relaxed text-base max-w-3xl">
                Take notes during the lecture to help reinforce your learning.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
