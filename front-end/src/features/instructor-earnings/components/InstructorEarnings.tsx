"use client";

import { ChartCard } from "@/components/molecules/ChartCard";
import { ChipToggle } from "@/components/molecules/ChipToggle";
import { NoInstructorProfileState, isNoInstructorProfileError } from "@/features/instructor-dashboard";
import { useEarningsPeriod } from "../hooks/useEarningsPeriod";
import { useInstructorEarnings } from "../hooks/useInstructorEarnings";
import { CourseEarningsTable } from "./CourseEarningsTable";
import { EarningsTiles } from "./EarningsTiles";
import {
    EarningsError,
    EarningsSkeleton,
    NoCourses,
    NoEarningsYet,
    NothingInPeriod,
} from "./EarningsStates";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { PERIOD_OPTIONS, formatWindow } from "../types/instructorEarnings.types";

/**
 * The instructor's earnings, across every course they own (spec 013).
 *
 * One snapshot drives the tiles, the chart and the table, so they can only ever describe
 * the same period (FR-004) — that is the whole reason this is one endpoint rather than
 * three.
 *
 * The branch order below IS the requirement (data-model §4). In particular, the last
 * guard is `stats.sales === 0` and not `net === "0.00"`: a period in which every sale
 * was refunded has real figures to show — revenue, the same amount in refunds, and a
 * $0.00 net — and collapsing it into "nothing sold" would tell an instructor nothing
 * happened when in fact they sold and lost it (FR-037).
 */
export function InstructorEarnings() {
    const { period, setPeriod } = useEarningsPeriod();
    const query = useInstructorEarnings(period);

    if (isNoInstructorProfileError(query.error)) {
        return <NoInstructorProfileState />;
    }

    const data = query.data;
    // Guards against a response for the period the instructor just left being painted as
    // the new one (FR-039); the server echoes the period it served for exactly this.
    const isCurrent = data?.period === period;

    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-darktext">Earnings</h1>
                    <p className="text-sm text-graytext2">
                        Across all your courses
                        {data && isCurrent ? ` · ${formatWindow(data.window)} · UTC` : ""}
                    </p>
                </div>
                <ChipToggle label="Period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
            </div>

            {query.isPending ? (
                <EarningsSkeleton />
            ) : query.isError || !data ? (
                // Before the skeleton branch below, not after: on a failure `data` is
                // undefined too, and testing for it first would leave the page loading
                // forever instead of offering a retry (FR-040).
                <EarningsError onRetry={() => void query.refetch()} />
            ) : !isCurrent ? (
                <EarningsSkeleton />
            ) : data.courses_count === 0 ? (
                <NoCourses />
            ) : !data.has_sales_ever ? (
                <NoEarningsYet />
            ) : data.stats.sales === 0 ? (
                <NothingInPeriod period={period} />
            ) : (
                <>
                    <EarningsTiles stats={data.stats} currency={data.currency} />
                    <ChartCard title="Revenue trend" footnote="Net revenue per period · dates in UTC">
                        <RevenueTrendChart
                            buckets={data.trend}
                            period={data.period}
                            currency={data.currency}
                        />
                    </ChartCard>
                    <CourseEarningsTable rows={data.courses} currency={data.currency} />
                </>
            )}
        </div>
    );
}
