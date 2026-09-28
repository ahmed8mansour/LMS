'use client';

import { CheckCircle2, CircleDashed, EyeOff, Rocket, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import ButtonLoading from '@/components/atoms/buttonloading';
import { InstructorCourse, statusOf } from '../types/instructorCourses.types';
import { usePublishCourse } from '../hooks/usePublishCourse';
import { useCourseReadiness } from '../hooks/useCourseReadiness';
import {
    ReadinessChecklist,
    ReadinessChecklistSkeleton,
    ReadinessUnavailable,
} from './ReadinessChecklist';
import { UnpublishDialog } from './UnpublishDialog';

interface PublishPanelProps {
    course: InstructorCourse;
}

// The one place on the workspace where a course's publish state is shown and
// changed (spec 007). Status comes from `is_published`; whether Publish is offered
// comes from the same readiness query the checklist renders, so the button and
// the list can never disagree. Nothing here decides readiness — the server does,
// and it re-checks at the moment of publish regardless (FR-014).
export function PublishPanel({ course }: PublishPanelProps) {
    const { publish } = usePublishCourse(course.id);
    const readiness = useCourseReadiness(course.id);
    const isLive = statusOf(course) === 'published';
    const report = readiness.data;

    // Unknown is not ready: while the verdict is loading or failed, Publish is
    // unavailable (FR-021). isError is checked explicitly because a failed REFETCH
    // keeps the previous `data` — an old "ready" must not survive a failed check.
    const canPublish = !readiness.isError && report?.is_publishable === true;
    const blockerCount = report?.blockers.length ?? 0;
    // A live course that no longer meets the bar. It is never unpublished for the
    // instructor — they are told, and the decision stays theirs (FR-023, FR-024).
    const needsAttention = isLive && !readiness.isError && report?.needs_attention === true;
    const statusTextId = `publish-status-${course.id}`;

    let statusText: string;
    if (needsAttention) {
        statusText = 'Live in the catalog, but it needs attention — see below.';
    } else if (isLive) {
        statusText = 'Live in the catalog — students can find and enroll in this course.';
    } else if (readiness.isPending) {
        statusText = 'Checking whether this course is ready…';
    } else if (readiness.isError) {
        statusText = 'Readiness couldn’t be checked, so publishing is unavailable.';
    } else if (canPublish) {
        statusText = 'Ready to publish. Publishing puts this course in the student catalog.';
    } else {
        statusText = `Not ready to publish yet — ${blockerCount} blocking ${
            blockerCount === 1 ? 'item' : 'items'
        } to resolve below.`;
    }

    return (
        <section
            aria-labelledby={`publish-heading-${course.id}`}
            className="flex flex-col gap-4 rounded-xl border border-graytext/20 bg-white p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    {needsAttention ? (
                        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                    ) : isLive ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-darkmint" aria-hidden />
                    ) : (
                        <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-graytext2" aria-hidden />
                    )}
                    <div>
                        <h3 id={`publish-heading-${course.id}`} className="text-sm font-bold text-darktext">
                            {isLive ? 'Published' : 'Draft'}
                        </h3>
                        <p id={statusTextId} className="text-sm text-graytext2" aria-live="polite">
                            {statusText}
                        </p>
                    </div>
                </div>

                {isLive ? (
                    // Ungated: a live course can always be pulled (FR-016). The dialog
                    // owns the confirmation and the in-flight guard.
                    <UnpublishDialog
                        course={course}
                        trigger={
                            <Button variant="outline" className="min-w-32">
                                <EyeOff className="mr-1 h-4 w-4" aria-hidden /> Unpublish
                            </Button>
                        }
                    />
                ) : (
                    <Button
                        onClick={() => publish.mutate()}
                        // Unavailable while blocked or unknown — and the reason is the
                        // visible status text, also wired to assistive tech (FR-019).
                        disabled={!canPublish || publish.isPending}
                        aria-describedby={statusTextId}
                        className="min-w-32 bg-darkmint text-white hover:bg-darkmint/90"
                    >
                        {publish.isPending ? (
                            <ButtonLoading />
                        ) : (
                            <>
                                <Rocket className="mr-1 h-4 w-4" aria-hidden /> Publish
                            </>
                        )}
                    </Button>
                )}
            </div>

            {needsAttention && report && (
                <div role="status" className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="flex items-start gap-2 text-sm text-amber-900">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                        <span>
                            <strong>This live course has {blockerCount === 1 ? 'a problem' : 'problems'} students
                            may run into.</strong>{' '}
                            It stays published — fix {blockerCount === 1 ? 'it' : 'them'} below, or unpublish it.
                        </span>
                    </p>
                    {/* Blockers only: suggestions are noise next to a live-course problem. */}
                    <ReadinessChecklist courseId={course.id} report={{ ...report, advisories: [] }} />
                </div>
            )}

            {!isLive && (
                <>
                    {readiness.isPending && <ReadinessChecklistSkeleton />}
                    {readiness.isError && (
                        <ReadinessUnavailable
                            onRetry={() => readiness.refetch()}
                            retrying={readiness.isFetching}
                        />
                    )}
                    {report && !readiness.isError && (
                        <ReadinessChecklist courseId={course.id} report={report} />
                    )}
                </>
            )}
        </section>
    );
}
