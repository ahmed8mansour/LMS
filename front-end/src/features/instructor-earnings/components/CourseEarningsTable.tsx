import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/atoms/table";
import { formatMoney } from "../types/instructorEarnings.types";
import type { CourseEarnings } from "../types/instructorEarnings.types";

interface CourseEarningsTableProps {
    rows: CourseEarnings[];
    currency: string;
}

/**
 * Course · Sales · Revenue (FR-022), highest revenue first, every qualifying course on
 * one page (FR-029).
 *
 * The two columns reconcile with different tiles, on purpose: **Sales** counts the
 * purchases made — including any later refunded — so it adds up to the sales behind
 * Total revenue, while **Revenue** is net and adds up to Net (FR-023, FR-027). A course
 * sold once and refunded therefore reads "1 · $0.00", which is the honest description of
 * what happened and not a rendering bug.
 *
 * Two layouts, one data set — the `StudentsTable` pattern. At `md` and up it is a real
 * `<table>`, which is what this data is. Below that it becomes a list of cards, because
 * three columns at 375px either scroll sideways or truncate the title into uselessness,
 * and FR-005 forbids both.
 */
export function CourseEarningsTable({ rows, currency }: CourseEarningsTableProps) {
    return (
        <div className="overflow-hidden rounded-xl border border-graytext/20 bg-white shadow-sm">
            {/* Desktop and up */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course</TableHead>
                            <TableHead className="text-right">Sales</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell className="max-w-[420px]">
                                    {/* Long and non-Latin titles truncate visibly rather than
                                        pushing the table sideways; the full title stays on hover. */}
                                    <span className="block truncate font-medium text-darktext" title={row.title}>
                                        {row.title}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right text-graytext2 tabular-nums">
                                    {row.sales.toLocaleString("en-US")}
                                </TableCell>
                                <TableCell className="text-right font-medium text-darktext tabular-nums">
                                    {formatMoney(row.revenue, currency)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Below md: one card per course, same three fields, no sideways scroll */}
            <ul className="divide-y divide-graytext/20 md:hidden">
                {rows.map((row) => (
                    <li key={row.id} className="flex flex-col gap-3 p-4">
                        <span className="min-w-0 truncate font-medium text-darktext" title={row.title}>
                            {row.title}
                        </span>
                        <div className="flex items-baseline justify-between gap-4">
                            <span className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold tracking-wide text-graytext2 uppercase">
                                    Sales
                                </span>
                                <span className="text-sm text-graytext2 tabular-nums">
                                    {row.sales.toLocaleString("en-US")}
                                </span>
                            </span>
                            <span className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold tracking-wide text-graytext2 uppercase">
                                    Revenue
                                </span>
                                <span className="text-sm font-medium text-darktext tabular-nums">
                                    {formatMoney(row.revenue, currency)}
                                </span>
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
