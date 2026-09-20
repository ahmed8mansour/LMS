"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmpty } from "./ChartEmpty";
import { emptyLabel, formatBucketLabel } from "../types/instructorAnalytics.types";
import type { Bucket, PeriodLabel } from "../types/instructorAnalytics.types";

/**
 * Enrollments per bucket across the whole window, zero buckets included (FR-011).
 *
 * This is the first Recharts chart in the project; later charts copy its shape:
 * - colours come from the Tailwind CSS tokens via var(--color-*), never a raw hex;
 * - ResponsiveContainer so the chart fits any viewport (FR-003, SC-009);
 * - accessibilityLayer so values are reachable by hover AND keyboard focus (FR-012);
 * - the empty state is decided before the chart renders, never by drawing a flat line.
 */
export function EnrollmentsChart({ buckets, period }: { buckets: Bucket[]; period: PeriodLabel }) {
    if (buckets.length === 0 || buckets.every((bucket) => bucket.count === 0)) {
        return <ChartEmpty label={emptyLabel(period)} />;
    }

    const rows = buckets.map((bucket) => ({
        label: formatBucketLabel(bucket, period),
        count: bucket.count,
    }));

    return (
        <ResponsiveContainer width="100%" height={256}>
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
                <CartesianGrid stroke="var(--color-graytext2)" strokeOpacity={0.15} vertical={false} />
                <XAxis
                    dataKey="label"
                    interval="preserveStartEnd"
                    minTickGap={24}
                    tick={{ fontSize: 11, fill: "var(--color-graytext2)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-graytext2)", strokeOpacity: 0.3 }}
                />
                <YAxis
                    allowDecimals={false}
                    width={32}
                    tick={{ fontSize: 11, fill: "var(--color-graytext2)" }}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip
                    // Recharts types these callbacks loosely, so the parameters are widened
                    // here and narrowed inside rather than casting the props.
                    formatter={(value: unknown) => {
                        const count = Number(value);
                        return [`${count} enrollment${count === 1 ? "" : "s"}`, ""] as [string, string];
                    }}
                    labelFormatter={(label: unknown) => String(label ?? "")}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--color-graytext2)" }}
                />
                <Line
                    type="monotone"
                    dataKey="count"
                    name="Enrollments"
                    stroke="var(--color-darkmint)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}
