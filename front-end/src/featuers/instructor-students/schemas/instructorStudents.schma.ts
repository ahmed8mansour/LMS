import { z } from "zod";

/**
 * The roster response contract (specs/010-instructor-students/contracts §2).
 *
 * Parsed, not cast: a payload that doesn't match throws on purpose, so the page shows its
 * error state instead of rendering missing values as blanks or zeros.
 */

export const RosterCourseSchema = z.object({
    id: z.number(),
    title: z.string(),
});

export const RosterRowSchema = z.object({
    /**
     * The ENROLMENT id, not the student's. In the all-courses scope a student enrolled in
     * two courses produces two rows, so keying a list on a student id would give
     * duplicate React keys and silently drop a row.
     */
    id: z.number(),
    name: z.string(),
    avatar: z.string().nullable(),
    /** "YYYY-MM-DD". A date, NOT a timestamp — never pass it to `new Date()`. */
    enrolled_at: z.string(),
    /**
     * Percent to one decimal, or null when the course has no lectures yet.
     *
     * `.nullable()`, deliberately not `.optional()` with a default: the "—" case has to
     * be unavoidable at every call site. Defaulting it to 0 would print "0%" for a course
     * nobody can progress through yet, which SC-007 forbids.
     */
    progress: z.number().nullable(),
    /** Always present, in both scopes. The view decides whether to render the column. */
    course: RosterCourseSchema,
});

export const RosterPageSchema = z.object({
    /** Students matching scope + search — not the length of `results`. */
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(RosterRowSchema),
});
