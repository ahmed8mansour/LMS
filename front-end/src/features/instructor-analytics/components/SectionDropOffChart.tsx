"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty } from "./ChartEmpty";
import { emptyLabel, percent, truncate } from "../types/instructorAnalytics.types";
import type { PeriodLabel, SectionDropOff } from "../types/instructorAnalytics.types";

interface SectionDropOffChartProps {
    sections: SectionDropOff[];
    period: PeriodLabel;
}

/**
 * Where students are stuck: one bar per section, in curriculum order (FR-013, FR-016).
 *
 * Horizontal bars (layout="vertical"), not the wireframe's columns: section titles are
 * long, and a row per section keeps them readable while the chart grows downward instead
 * of squeezing widths (research R8). Same token/accessibility rules as EnrollmentsChart.
 */
export function SectionDropOffChart({ sections, period }: SectionDropOffChartProps) {
    const stuck = sections.reduce((sum, section) => sum + section.count, 0);

    if (sections.length === 0 || stuck === 0) {
        return <ChartEmpty label={sections.length === 0 ? "No sections yet" : emptyLabel(period)} />;
    }

    const rows = sections.map((section) => ({
        label: truncate(`S${section.order} · ${section.title}`),
        title: section.title,
        count: section.count,
        share: percent(section.count, stuck),
    }));

    return (
        <ResponsiveContainer width="100%" height={Math.max(160, sections.length * 32)}>
            <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
                accessibilityLayer
            >
                <CartesianGrid stroke="var(--color-graytext2)" strokeOpacity={0.15} horizontal={false} />
                <XAxis
                    type="number"
                    allowDecimals={false}
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
                        const count = Number(value);
                        const row = (item as { payload: (typeof rows)[number] }).payload;
                        return [
                            `${count} student${count === 1 ? "" : "s"} stuck here · ${row.share}% of students still in progress`,
                            row.title,
                        ] as [string, string];
                    }}
                    labelFormatter={() => ""}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--color-graytext2)" }}
                />
                <Bar dataKey="count" name="Students" fill="var(--color-darkmint)" radius={[0, 4, 4, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
