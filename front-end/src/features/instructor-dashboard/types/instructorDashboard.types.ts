import { isAxiosError } from 'axios';
import type { z } from 'zod';
import {
    AttentionItemSchema,
    AttentionTypeSchema,
    CourseRefSchema,
    DashboardSnapshotSchema,
    PersonRefSchema,
    RecentEnrollmentSchema,
    RecentReviewSchema,
} from '../schemas/instructorDashboard.schma';

// Inferred from the Zod schema so the runtime check and the static type cannot drift
// (spec 008 research R11).
export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;
export type AttentionType = z.infer<typeof AttentionTypeSchema>;
export type AttentionItem = z.infer<typeof AttentionItemSchema>;
export type RecentEnrollment = z.infer<typeof RecentEnrollmentSchema>;
export type RecentReview = z.infer<typeof RecentReviewSchema>;
export type PersonRef = z.infer<typeof PersonRefSchema>;
export type CourseRef = z.infer<typeof CourseRefSchema>;

export const ATTENTION_LABEL: Record<AttentionType, string> = {
    live_needs_attention: 'Live course needs attention',
    video_failed: 'Video failed',
    ready_to_publish: 'Ready to publish',
    draft_in_progress: 'Draft in progress',
};

// Where the instructor goes to act on an item (data-model §6). The switch's `never`
// default turns an attention type added on the backend but not handled here into a
// tsc error rather than a silently wrong link.
export function attentionHref(item: AttentionItem): string {
    const { target } = item;
    const courseHref = `/instructor/courses/${target.course_id}`;
    const type = item.type;
    switch (type) {
        case 'video_failed':
            return target.kind === 'lecture' && target.lecture_id !== null
                ? `${courseHref}/curriculum/lectures/${target.lecture_id}`
                : courseHref;
        case 'live_needs_attention':
        case 'ready_to_publish':
        case 'draft_in_progress':
            return courseHref;
        default: {
            const unmapped: never = type;
            return unmapped;
        }
    }
}

// Money on a tile is shown exactly ($8,940.00), never compact ($8.9k) — research R7.
export function formatMoney(amount: string, currency: 'USD'): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount));
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return parts
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
}

// A staff account without an InstructorProfile gets 403 { error, code } (research R8).
// It is a handled state, not a failure to retry.
export function isNoInstructorProfileError(error: unknown): boolean {
    if (!isAxiosError(error)) return false;
    const data: unknown = error.response?.data;
    return (
        error.response?.status === 403 &&
        typeof data === 'object' &&
        data !== null &&
        'code' in data &&
        data.code === 'no_instructor_profile'
    );
}
