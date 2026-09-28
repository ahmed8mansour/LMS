import type { z } from "zod";
import type {
    RosterCourseSchema,
    RosterPageSchema,
    RosterRowSchema,
} from "../schemas/instructorStudents.schma";

/**
 * Inferred from the Zod schemas, never written in parallel, so the runtime contract and
 * the compile-time types cannot drift (Constitution I).
 */

export type RosterCourse = z.infer<typeof RosterCourseSchema>;
export type RosterRow = z.infer<typeof RosterRowSchema>;
export type RosterPage = z.infer<typeof RosterPageSchema>;

/** What the roster is scoped to: one owned course, or every owned course. */
export interface RosterQuery {
    courseId?: number;
    search: string;
    page: number;
}

/** Rows per page — fixed by the server (FR-021); mirrored here only to label positions. */
export const ROSTER_PAGE_SIZE = 20;

/**
 * Format `enrolled_at` for display.
 *
 * By splitting the string, never by constructing a `Date`. `new Date("2026-07-02")` is
 * parsed as UTC midnight, so `.toLocaleDateString()` renders **1 July** anywhere west of
 * Greenwich — which would break FR-009's promise that every viewer sees the same date for
 * the same row.
 */
export function formatEnrolledAt(value: string): string {
    const [year, month, day] = value.split("-");
    if (!year || !month || !day) return value;

    const monthNames = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const label = monthNames[Number(month) - 1];
    if (!label) return value;

    return `${label} ${Number(day)}, ${year}`;
}

/**
 * The progress label. `null` means the course has no lectures yet, which reads as an em
 * dash — never "0%" (FR-011, SC-007). A number is rounded to a whole percent for the
 * label (FR-010) while the bar keeps the precise value.
 */
export function progressLabel(progress: number | null): string {
    return progress === null ? "—" : `${Math.round(progress)}%`;
}

// The position label ("21–40 of 318") deliberately lives in RosterPagination rather than
// here: that component is feature-agnostic and takes its own `pageSize`, so duplicating
// the calculation against ROSTER_PAGE_SIZE would give the same label two sources.
