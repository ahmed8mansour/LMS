import { z } from 'zod';

// Runtime shape of GET /courses/instructor/dashboard/ (spec 008 contract).
//
// This validation is load-bearing, not decoration (FR-027): a malformed or partial
// payload must fail the parse and surface as the page-level error state. Without it,
// a missing field would render as `0`, and a missing needs-attention list as
// "All caught up" — a false "no problems" is worse than an error.

export const AttentionTypeSchema = z.enum([
    'live_needs_attention',
    'video_failed',
    'ready_to_publish',
    'draft_in_progress',
]);

export const PersonRefSchema = z.object({
    name: z.string(),
    avatar: z.string().nullable(),
});

export const CourseRefSchema = z.object({
    id: z.number().int(),
    title: z.string(),
});

export const RecentEnrollmentSchema = z.object({
    id: z.number().int(),
    enrolled_at: z.string(),
    student: PersonRefSchema,
    course: CourseRefSchema,
});

export const RecentReviewSchema = z.object({
    id: z.number().int(),
    rating: z.number().int().min(1).max(5),
    comment: z.string(),
    created_at: z.string(),
    reviewer: PersonRefSchema,
    course: CourseRefSchema,
});

export const AttentionTargetSchema = z.object({
    kind: z.enum(['course', 'lecture']),
    course_id: z.number().int(),
    lecture_id: z.number().int().nullable(),
});

export const AttentionItemSchema = z.object({
    type: AttentionTypeSchema,
    course: CourseRefSchema,
    is_published: z.boolean(),
    blocker_count: z.number().int(),
    active_students: z.number().int(),
    failed_lecture_ids: z.array(z.number().int()),
    target: AttentionTargetSchema,
});

export const DashboardSnapshotSchema = z.object({
    mode: z.enum(['onboarding', 'full']),
    instructor_name: z.string(),
    courses: z.object({
        total: z.number().int(),
        published: z.number().int(),
    }),
    students: z.object({
        distinct: z.number().int(),
        enrollments: z.number().int(),
    }),
    rating: z.object({
        avg_rating: z.number().nullable(),
        reviews_count: z.number().int(),
    }),
    earnings: z.object({
        amount: z.string(),
        currency: z.literal('USD'),
    }),
    recent_enrollments: z.array(RecentEnrollmentSchema),
    recent_reviews: z.array(RecentReviewSchema),
    needs_attention: z.object({
        total: z.number().int(),
        items: z.array(AttentionItemSchema),
    }),
    onboarding: z.object({
        profile_complete: z.boolean(),
        has_course: z.boolean(),
        has_curriculum: z.boolean(),
        has_ready_video: z.boolean(),
        has_published_course: z.boolean(),
    }),
});
