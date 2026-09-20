import type { ReactNode } from "react";

interface ChartCardProps {
    title: string;
    /** Optional note under the chart, e.g. the UTC caption (FR-011a). */
    footnote?: string;
    children: ReactNode;
}

export function ChartCard({ title, footnote, children }: ChartCardProps) {
    return (
        <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-graytext/20 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-darktext">{title}</h2>
            <div className="min-w-0">{children}</div>
            {footnote && <p className="text-xs text-graytext2">{footnote}</p>}
        </section>
    );
}
