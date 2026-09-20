"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty } from "./ChartEmpty";
import { emptyLabel, truncate } from "../types/instructorAnalytics.types";
import type { CourseDropOff, PeriodLabel, PeriodParam } from "../types/instructorAnalytics.types";

interface CourseDropOffChartProps {
    courses: CourseDropOff[];
    /** The current period, carried into the course link (FR-019b). */
    period: PeriodParam;
    periodLabel: PeriodLabel;
}

/**
 * Which courses students fail to finish: one bar per course, lowest completion first
 * (FR-019 – FR-019c). Copies SectionDropOffChart's horizontal-bar pattern.
 *
 * Bars are drop-off *rates*, so a 10-student course and a 1,000-student one compare
 * fairly; the counts sit in the tooltip so a small course still reads as small. The
 * backend order is authoritative and is never re-sorted here. All-zero bars are real
 * data (every student finished) and still render.
 */
export function CourseDropOffChart({ courses, period, periodLabel }: CourseDropOffChartProps) {
    const router = useRouter();

    if (courses.length === 0) {
        return <ChartEmpty label={emptyLabel(periodLabel)} />;
    }

    const rows = courses.map((course) => ({
        label: truncate(course.title),
        title: course.title,
        courseId: course.course_id,
        value: Math.round(course.drop_off_rate * 100),
        notCompleted: course.not_completed,
        total: course.total,
    }));

    const open = (courseId: number) => {
        router.push(`/instructor/courses/${courseId}/analytics?days=${period}`);
    };

    return (
        <div className="flex flex-col gap-3">
        <ResponsiveContainer width="100%" height={Math.max(160, courses.length * 32)}>
            <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
                accessibilityLayer
            >
                <CartesianGrid stroke="var(--color-graytext2)" strokeOpacity={0.15} horizontal={false} />
                <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(value: number) => `${value}%`}
                    tick={{ fontSize: 11, fill: "var(--color-graytext2)" }}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    type="category"
                    dataKey="label"
                    width={140}
                    tick={{ fontSize: 11, fill: "var(--color-graytext2)" }}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip
                    cursor={{ fill: "var(--color-darkmint)", fillOpacity: 0.06 }}
                    formatter={(value: unknown, _name: unknown, item: unknown) => {
                        const row = (item as { payload: (typeof rows)[number] }).payload;
                        return [
                            `${Number(value)}% drop-off · ${row.notCompleted} of ${row.total} students haven't finished`,
                            row.title,
                        ] as [string, string];
                    }}
                    labelFormatter={() => ""}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--color-graytext2)" }}
                />
                <Bar
                    dataKey="value"
                    name="Drop-off"
                    fill="var(--color-darkmint)"
                    radius={[0, 4, 4, 0]}
                    cursor="pointer"
                    onClick={(data: unknown) => open((data as (typeof rows)[number]).courseId)}
                />
            </BarChart>
        </ResponsiveContainer>

        {/* A bar is clickable, but a click isn't reachable from the keyboard; these links
            are the same destinations, in the same order, for keyboard and screen readers. */}
        <ul className="flex flex-wrap gap-2">
            {rows.map((row) => (
                <li key={row.courseId}>
                    <Link
                        href={`/instructor/courses/${row.courseId}/analytics?days=${period}`}
                        title={row.title}
                        className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-graytext/25 px-2.5 py-1 text-xs text-graytext2 transition-colors hover:border-darkmint hover:text-darkmint"
                    >
                        <span className="truncate">{row.title}</span>
                        <span className="font-semibold">{row.value}%</span>
                    </Link>
                </li>
            ))}
        </ul>
        </div>
    );
}
