"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatBucketLabel, formatMoney } from "../types/instructorEarnings.types";
import type { PeriodParam, TrendBucket } from "../types/instructorEarnings.types";

interface RevenueTrendChartProps {
    buckets: TrendBucket[];
    period: PeriodParam;
    currency: string;
}

function Empty({ label }: { label: string }) {
    return (
        <div
            role="status"
            className="flex h-64 items-center justify-center rounded-lg border border-dashed border-graytext/25 text-sm text-graytext2"
        >
            {label}
        </div>
    );
}

/**
 * Net revenue per bucket, so the bars add up to the Net tile (FR-016) — one bar per day
 * for This month, one per calendar month otherwise, every bucket in the window included
 * (FR-018).
 *
 * Vertical bars over time, which is neither analytics chart exactly: this takes
 * `EnrollmentsChart`'s time-series machinery (bucket shape, UTC labels, the empty
 * decision made before rendering, token colours, `accessibilityLayer` so values are
 * reachable by keyboard and not by hover alone) and `SectionDropOffChart`'s bar styling.
 *
 * Nothing here can be negative: a refund is attributed to the sale it reverses and never
 * exceeds it, so a fully-refunded bucket is $0.00 — present, and distinguishable from a
 * day nobody bought anything only by the tooltip (FR-021).
 */
export function RevenueTrendChart({ buckets, period, currency }: RevenueTrendChartProps) {
    if (buckets.length === 0) {
        return <Empty label={period === "all" ? "No earnings yet" : "Nothing sold in this period"} />;
    }

    const rows = buckets.map((bucket) => ({
        label: formatBucketLabel(bucket, period),
        // Recharts needs a number to size the bar; the string stays alongside it so the
        // tooltip shows the exact amount rather than a re-formatted float.
        amount: Number(bucket.amount),
        exact: formatMoney(bucket.amount, currency),
    }));

    return (
        <ResponsiveContainer width="100%" height={256}>
            <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
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
                    width={64}
                    tick={{ fontSize: 11, fill: "var(--color-graytext2)" }}
                    tickLine={false}
                    axisLine={false}
                    // A bare number on a money axis is a bug; compact is fine HERE because
                    // an axis tick reconciles with nothing — the tooltip and the tiles
                    // carry the exact figures (FR-012).
                    tickFormatter={(value: number) =>
                        new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency,
                            notation: "compact",
                            maximumFractionDigits: 1,
                        }).format(value)
                    }
                />
                <Tooltip
                    cursor={{ fill: "var(--color-darkmint)", fillOpacity: 0.06 }}
                    // Recharts types these callbacks loosely, so the parameters are widened
                    // here and narrowed inside rather than casting the props.
                    formatter={(_value: unknown, _name: unknown, item: unknown) => {
                        const row = (item as { payload: (typeof rows)[number] }).payload;
                        return [row.exact, "Net revenue"] as [string, string];
                    }}
                    labelFormatter={(label: unknown) => String(label ?? "")}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--color-graytext2)" }}
                />
                <Bar dataKey="amount" name="Net revenue" fill="var(--color-darkmint)" radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}
