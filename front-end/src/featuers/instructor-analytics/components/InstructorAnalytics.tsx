"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { NoInstructorProfileState, isNoInstructorProfileError } from "@/featuers/instructor-dashboard";
import { useInstructorAnalytics } from "../hooks/useInstructorAnalytics";
import { usePeriodParam } from "../hooks/usePeriodParam";
import { AnalyticsError } from "./AnalyticsError";
import { AnalyticsSkeleton } from "./AnalyticsSkeleton";
import { AnalyticsTiles } from "./AnalyticsTiles";
import { ChartCard } from "./ChartCard";
import { CourseDropOffChart } from "./CourseDropOffChart";
import { EnrollmentsChart } from "./EnrollmentsChart";
import { PeriodSelector } from "./PeriodSelector";

function NoCourses() {
    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                <BarChart3 className="h-7 w-7" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">No analytics yet</h2>
                <p className="text-sm text-graytext2">
                    Once you create a course and students enrol, their progress shows up here.
                </p>
            </div>
            <Link
                href="/instructor/courses/new"
                className="rounded-lg bg-darkmint px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-darkmint/90"
            >
                Create your first course
            </Link>
        </div>
    );
}

/** Aggregate analytics across every owned course. Mirrors CourseAnalytics (FR-002, FR-017). */
export function InstructorAnalytics() {
    const { period, setPeriod } = usePeriodParam();
    const query = useInstructorAnalytics(period);

    if (isNoInstructorProfileError(query.error)) {
        return <NoInstructorProfileState />;
    }

    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-darktext">Analytics</h1>
                    <p className="text-sm text-graytext2">Across all your courses</p>
                </div>
                <PeriodSelector value={period} onChange={setPeriod} />
            </div>

            {query.isPending ? (
                <AnalyticsSkeleton />
            ) : query.isError || !query.data ? (
                <AnalyticsError onRetry={() => void query.refetch()} />
            ) : query.data.courses_count === 0 ? (
                <NoCourses />
            ) : (
                <>
                    <AnalyticsTiles
                        completion={query.data.completion}
                        quizPass={query.data.quiz_pass}
                        activeStudents={query.data.active_students}
                        period={query.data.period}
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartCard title="Enrollments over time" footnote="Dates in UTC">
                            <EnrollmentsChart
                                buckets={query.data.enrollments_over_time}
                                period={query.data.period}
                            />
                        </ChartCard>
                        <ChartCard title="Course drop-off" footnote="Share of students who haven't finished — lowest completion first">
                            <CourseDropOffChart
                                courses={query.data.course_drop_off}
                                period={period}
                                periodLabel={query.data.period}
                            />
                        </ChartCard>
                    </div>
                </>
            )}
        </div>
    );
}
