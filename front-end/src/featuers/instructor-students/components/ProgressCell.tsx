import { progressLabel } from "../types/instructorStudents.types";

/**
 * One progress value: a bar and a label (T020).
 *
 * Small, but its own component because it carries two display invariants that must not be
 * re-decided per call site.
 */
export function ProgressCell({ progress }: { progress: number | null }) {
    // FR-011 / SC-007: a course with no lectures has no denominator, so there is nothing
    // to be 0% of. It reads as an em dash with an empty bar — never "0%", which would
    // claim the student has made no progress through a course that has no content.
    if (progress === null) {
        return (
            <div className="flex items-center gap-3" title="This course has no lectures yet">
                <div className="h-2 w-24 shrink-0 rounded-full bg-darkbg" aria-hidden="true" />
                <span className="text-sm text-graytext2">{progressLabel(null)}</span>
                <span className="sr-only">No lectures in this course yet</span>
            </div>
        );
    }

    const clamped = Math.max(0, Math.min(100, progress));

    return (
        <div
            className="flex items-center gap-3"
            role="meter"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Course progress"
        >
            <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-darkbg">
                {/*
                  The bar uses the precise value while the label is rounded to a whole
                  percent (FR-010). They differ on purpose: 37.5% should look different
                  from 38%, but read as "38%".
                */}
                <div
                    className="h-full rounded-full bg-darkmint transition-[width] duration-300"
                    style={{ width: `${clamped}%` }}
                />
            </div>
            <span className="text-sm font-medium text-darktext tabular-nums">
                {progressLabel(progress)}
            </span>
        </div>
    );
}
