import { z } from "zod";

// Parsing is load-bearing (FR-022): a body that doesn't match the contract throws in the
// API function and becomes the page's error state, instead of rendering a missing rate as
// 0% or a missing series as an empty chart.

const count = z.number().int().min(0);
const ratio = z.number().min(0).max(1).nullable();

export const PeriodLabelSchema = z.enum(["30d", "90d", "all"]);

export const WindowSchema = z.object({
    start: z.string().nullable(), // null only for "all time" with no enrollments
    end: z.string(),
});

export const BucketSchema = z.object({
    start: z.string(),
    end: z.string(),
    count,
});

export const CompletionSchema = z.object({
    rate: ratio,
    completed: count,
    total: count,
});

export const QuizPassSchema = z.object({
    rate: ratio,
    passed: count,
    attempted: count,
    has_quizzes: z.boolean(),
});

export const SectionDropOffSchema = z.object({
    section_id: z.number().int(),
    title: z.string(),
    order: z.number().int(),
    count,
});

export const CourseDropOffSchema = z.object({
    course_id: z.number().int(),
    title: z.string(),
    drop_off_rate: z.number().min(0).max(1),
    not_completed: count,
    total: z.number().int().min(1),
});

const shared = {
    period: PeriodLabelSchema,
    window: WindowSchema,
    completion: CompletionSchema,
    quiz_pass: QuizPassSchema,
    active_students: count,
    enrollments_over_time: z.array(BucketSchema),
};

// Two separate schemas rather than one with optional fields: each scope always carries
// exactly one drop-off series, and the types should say so.
export const CourseAnalyticsSchema = z.object({
    ...shared,
    scope: z.literal("course"),
    course: z.object({ id: z.number().int(), title: z.string() }),
    section_drop_off: z.array(SectionDropOffSchema),
});

export const InstructorAnalyticsSchema = z.object({
    ...shared,
    scope: z.literal("instructor"),
    courses_count: count,
    course_drop_off: z.array(CourseDropOffSchema),
});
