"use client";

import { isAxiosError } from "axios";
import { useCourseAnalytics } from "../hooks/useCourseAnalytics";
import { usePeriodParam } from "../hooks/usePeriodParam";
import { AnalyticsError } from "./AnalyticsError";
import { AnalyticsSkeleton } from "./AnalyticsSkeleton";
import { AnalyticsTiles } from "./AnalyticsTiles";
import { ChartCard } from "./ChartCard";
import { EnrollmentsChart } from "./EnrollmentsChart";
import { PeriodSelector } from "./PeriodSelector";
import { SectionDropOffChart } from "./SectionDropOffChart";

/**
 * Per-course analytics (FR-001 – FR-003).
 *
 * Everything on screen comes from one `query.data`, so tiles and charts always describe
 * the same period and the same moment (FR-020). The header keeps its place in every
 * state, so switching period doesn't make the control jump.
 */
export function CourseAnalytics({ courseId }: { courseId: number }) {
    const { period, setPeriod } = usePeriodParam();
    const query = useCourseAnalytics(courseId, period);

    // A course that isn't this instructor's is a 404; the workspace layout already shows
    // "Course not found", so this component adds nothing.
    const notFound = isAxiosError(query.error) && query.error.response?.status === 404;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-xl font-bold text-darktext">Course analytics</h1>
                <PeriodSelector value={period} onChange={setPeriod} />
            </div>

            {query.isPending ? (
                <AnalyticsSkeleton />
            ) : notFound ? null : query.isError || !query.data ? (
                <AnalyticsError onRetry={() => void query.refetch()} />
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
                        <ChartCard title="Section drop-off" footnote="Students who haven't finished, by the section they're stuck on">
                            <SectionDropOffChart
                                sections={query.data.section_drop_off}
                                period={query.data.period}
                            />
                        </ChartCard>
                    </div>
                </>
            )}
        </div>
    );
}
