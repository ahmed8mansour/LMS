'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleAlert, Lightbulb, RotateCw } from 'lucide-react';
import { Skeleton } from '@/components/atoms/skeleton';
import { ReadinessItem, ReadinessReport, readinessHref } from '../types/instructorCourses.types';

interface ReadinessChecklistProps {
    courseId: number;
    report: ReadinessReport;
}

// Renders the server's readiness verdict verbatim. It never re-derives a
// condition: every line comes from the report, and every link from its `code`
// (switched on, never parsed out of `message`).
export function ReadinessChecklist({ courseId, report }: ReadinessChecklistProps) {
    const { blockers, advisories } = report;

    return (
        <div className="flex flex-col gap-4">
            {blockers.length === 0 ? (
                <p className="flex items-center gap-2 text-sm font-medium text-darkmint">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Everything required to publish is in place.
                </p>
            ) : (
                <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Blocking publish · {blockers.length}
                    </h4>
                    <ul className="flex flex-col gap-2">
                        {blockers.map((item, i) => (
                            <ChecklistRow key={`${item.code}-${item.target?.id ?? i}`} courseId={courseId} item={item} />
                        ))}
                    </ul>
                </div>
            )}

            {/* Visually distinct from blockers, and explicitly optional (FR-012). */}
            {advisories.length > 0 && (
                <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-graytext2">
                        Suggestions · optional
                    </h4>
                    <ul className="flex flex-col gap-2">
                        {advisories.map((item, i) => (
                            <ChecklistRow key={`${item.code}-${i}`} courseId={courseId} item={item} />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function ChecklistRow({ courseId, item }: { courseId: number; item: ReadinessItem }) {
    const blocking = item.severity === 'blocking';
    return (
        <li
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                blocking ? 'border-amber-300 bg-amber-50 text-darktext' : 'border-graytext/20 bg-lightbg text-graytext2'
            }`}
        >
            <span className="flex items-start gap-2">
                {blocking ? (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                ) : (
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-graytext2" aria-hidden />
                )}
                {item.message}
            </span>
            {/* One click to the exact place that fixes it (FR-018). */}
            <Link
                href={readinessHref(courseId, item)}
                className="flex shrink-0 items-center gap-1 font-semibold text-darkmint hover:underline"
            >
                {blocking ? 'Fix' : 'Add'} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
        </li>
    );
}

export function ReadinessChecklistSkeleton() {
    return (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Checking whether this course is ready">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-5/6" />
        </div>
    );
}

// Readiness could not be determined. Never a blank region and never an
// optimistic "ready" — say so and offer a retry (FR-021).
export function ReadinessUnavailable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
    return (
        <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
            <span>We couldn’t check whether this course is ready, so publishing is unavailable for now.</span>
            <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="flex items-center gap-1 font-semibold hover:underline disabled:opacity-60"
            >
                <RotateCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} aria-hidden /> Retry
            </button>
        </div>
    );
}
