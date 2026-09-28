import Link from "next/link";
import { AlertTriangle, CalendarRange, DollarSign, PlusCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { periodLabel } from "../types/instructorEarnings.types";
import type { PeriodParam } from "../types/instructorEarnings.types";

/**
 * Loading, failure, and the THREE empty states this page has to tell apart (FR-036 –
 * FR-040, SC-009).
 *
 * The three empties are deliberately different sentences, not one sentence under three
 * headings: "you own no courses", "nobody has bought one yet" and "nothing sold in the
 * period you picked" are three different situations with three different next actions,
 * and a page that blurs them tells an instructor their courses failed when in fact they
 * just chose a quiet month.
 */

function EmptyState({
    icon: Icon,
    title,
    children,
    action,
}: {
    icon: typeof DollarSign;
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                <Icon className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">{title}</h2>
                <p className="text-sm text-graytext2">{children}</p>
            </div>
            {action}
        </div>
    );
}

/**
 * Loading. Mirrors the real layout so the page doesn't jump, and shows no figures: a
 * flashed "$0.00" would be a claim the data hasn't made (FR-039).
 */
export function EarningsSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Loading earnings</span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-xl" />
                ))}
            </div>

            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
        </div>
    );
}

/**
 * Failure. Replaces the figures entirely: the snapshot is all-or-nothing, so there is
 * never a half-loaded page to show beside it, and a zero must never stand in for data
 * that failed to load (FR-040). The period chips stay mounted above this, so the
 * instructor can change period without reloading.
 */
export function EarningsError({ onRetry }: { onRetry: () => void }) {
    return (
        <div role="alert" className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="flex max-w-md flex-col gap-1.5">
                <h2 className="text-xl font-bold text-darktext">We couldn&apos;t load your earnings</h2>
                <p className="text-sm text-graytext2">Check your connection and try again.</p>
            </div>
            <Button onClick={onRetry} className="bg-darkmint text-white hover:bg-darkmint/90">
                <RotateCw className="h-4 w-4" />
                Retry
            </Button>
        </div>
    );
}

/** FR-038 — no courses at all. The next action is creating one, not waiting. */
export function NoCourses() {
    return (
        <EmptyState
            icon={PlusCircle}
            title="No courses yet"
            action={
                <Link
                    href="/instructor/courses/new"
                    className="rounded-lg bg-darkmint px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-darkmint/90"
                >
                    Create your first course
                </Link>
            }
        >
            Earnings appear here once you publish a course and students start enrolling.
        </EmptyState>
    );
}

/** FR-036 — courses exist, nobody has bought one. Nothing to do but keep teaching. */
export function NoEarningsYet() {
    return (
        <EmptyState icon={DollarSign} title="No earnings yet">
            Nobody has bought one of your courses yet. When they do, your revenue, refunds and per-course
            takings show up here. Free enrolments don&apos;t count as sales — you&apos;ll find those under
            Students.
        </EmptyState>
    );
}

/** FR-037 — sold before, just not in this period. The chips above stay usable. */
export function NothingInPeriod({ period }: { period: PeriodParam }) {
    return (
        <EmptyState icon={CalendarRange} title={`Nothing sold in ${periodLabel(period).toLowerCase()}`}>
            You have earnings from other periods — try <strong>All time</strong> to see everything your
            courses have taken in.
        </EmptyState>
    );
}
