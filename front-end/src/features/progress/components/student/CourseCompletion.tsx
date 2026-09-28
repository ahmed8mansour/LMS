"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Award,
    BookOpenCheck,
    CalendarCheck,
    Clock,
    LayoutDashboard,
    MessageSquare,
    RotateCcw,
    Trophy,
} from "lucide-react";

import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { useCourseCompletion } from "../../hooks/useCourseCompletion";

interface CourseCompletionProps {
    courseId: string;
}

function formatMinutes(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function formatCompletedAt(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function CourseCompletionSkeleton() {
    return (
        <div className="relative min-h-[calc(100vh-4rem)] px-4 py-8 md:px-8 md:py-12">
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 rounded-xl border border-border bg-background p-6 md:p-10">
                <Skeleton className="h-28 w-28 rounded-full md:h-32 md:w-32" />
                <Skeleton className="h-7 w-40 rounded-full" />
                <Skeleton className="h-10 w-full max-w-lg" />
                <Skeleton className="h-16 w-full max-w-lg" />
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
                    <Skeleton className="h-28 rounded-lg" />
                    <Skeleton className="h-28 rounded-lg" />
                    <Skeleton className="h-28 rounded-lg" />
                </div>
            </div>
        </div>
    );
}

export function CourseCompletion({ courseId }: CourseCompletionProps) {
    const router = useRouter();
    const { data, isLoading, isError, refetch, isForbidden, customErrorMessage } =
        useCourseCompletion(courseId);

    // This screen only exists for a finished course. A student who has not got
    // there yet belongs on the curriculum, not on a congratulations page.
    const shouldRedirect = Boolean(data && !data.is_completed);
    useEffect(() => {
        if (shouldRedirect) router.replace(`/dashboard/learn/${courseId}`);
    }, [shouldRedirect, router, courseId]);

    if (isLoading) return <CourseCompletionSkeleton />;

    if (isForbidden) {
        return (
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
                <h1 className="text-2xl font-bold text-darktext">
                    You aren&apos;t allowed to access this course
                </h1>
                <p className="text-sm text-graytext2">{customErrorMessage}</p>
                <Button
                    variant="darkmint"
                    onClick={() => router.replace(`/courses/${courseId}`)}
                    className="gap-2"
                >
                    Please enroll first
                </Button>
            </div>
        );
    }

    if (isError || !data) {
        return (
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
                <h1 className="text-2xl font-bold text-darktext">
                    Completion summary is unavailable
                </h1>
                <p className="text-sm text-graytext2">{customErrorMessage}</p>
                <Button variant="darkmint" onClick={() => refetch()} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    // The redirect above is already in flight; render nothing over it.
    if (!data.is_completed) return null;

    const lectureProgress = `${data.lectures_completed}/${data.total_lectures}`;
    const hasQuizAverage = data.quiz_average !== null;

    return (
        <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-8 md:px-8 md:py-12">
            <div className="absolute inset-x-0 top-0 h-72 bg-darkmint/[0.06]" />

            <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center rounded-xl border border-border bg-background p-6 text-center shadow-sm md:p-10">
                <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-darkmint/10 text-darkmint shadow-[0_0_40px_rgba(43,88,105,0.18)] md:h-32 md:w-32">
                    <Trophy className="h-16 w-16 md:h-20 md:w-20" />
                </div>

                <span className="mb-6 rounded-full bg-darkmint px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                    Course Completed
                </span>

                <p className="mb-2 text-sm font-medium text-graytext">Final milestone</p>
                <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-darktext md:text-5xl">
                    {data.course.title}
                </h1>
                <p className="mb-8 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
                    {data.total_quizzes > 0
                        ? "You have completed every lecture and passed the required quizzes for this course."
                        : "You have completed every lecture in this course."}
                </p>

                <div
                    className={`grid w-full grid-cols-1 gap-3 ${
                        hasQuizAverage ? "sm:grid-cols-3" : "sm:grid-cols-2"
                    }`}
                >
                    <CompletionMetric
                        icon={BookOpenCheck}
                        label="Lectures"
                        value={lectureProgress}
                    />
                    <CompletionMetric
                        icon={Clock}
                        label="Time Spent"
                        value={formatMinutes(data.total_minutes)}
                    />
                    {hasQuizAverage && (
                        <CompletionMetric
                            icon={Award}
                            label="Quiz Average"
                            value={`${data.quiz_average}%`}
                        />
                    )}
                </div>

                <div className="mt-8 flex w-full flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-center">
                    <Button
                        asChild
                        variant="darkmint"
                        className="min-h-12 rounded-lg px-8 font-headline font-bold"
                    >
                        <Link href="/dashboard/reviews">
                            <MessageSquare className="h-4 w-4" />
                            {data.has_reviewed ? "Edit Your Review" : "Leave a Review"}
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="min-h-12 rounded-lg border-darkmint/20 px-8 font-headline font-bold text-darktext"
                    >
                        <Link href="/dashboard">
                            <LayoutDashboard className="h-4 w-4" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>

                {data.completed_at && (
                    <div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-darkbg px-4 py-2 text-xs font-medium text-graytext">
                        <CalendarCheck className="h-4 w-4 text-darkmint" />
                        <span>Completed on {formatCompletedAt(data.completed_at)}</span>
                    </div>
                )}

                <Button asChild variant="link" className="mt-3 h-auto p-0 text-darkmint">
                    <Link href={`/dashboard/learn/${courseId}`}>View course curriculum</Link>
                </Button>
            </section>
        </div>
    );
}

function CompletionMetric({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-border bg-darkbg p-4">
            <Icon className="mb-2 h-5 w-5 text-darkmint" />
            <span className="font-headline text-lg font-bold text-darktext">{value}</span>
            <span className="mt-1 text-xs font-bold uppercase tracking-wide text-graytext">
                {label}
            </span>
        </div>
    );
}
