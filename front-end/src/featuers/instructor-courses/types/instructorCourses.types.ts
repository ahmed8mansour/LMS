// Derived status used across the UI (badge, filter). The API carries `is_published`;
// status is derived from it — see statusOf() below.
export type CourseStatus = 'draft' | 'published';

// Read shape returned by the instructor course endpoint (InstructorCourseSerializer).
// DRF serializes Decimal fields as strings, hence `price`/`rating` are strings.
export interface InstructorCourse {
    id: number;
    title: string;
    description: string;
    thumbnail: string | null;
    category: string;
    level: string;
    price: string;
    rating: string;
    subscribers_count: number;
    reviews_count: number;
    is_published: boolean;
    language: string;
    last_updated: string;
    goals_list: string[];
    instructor_profile?: unknown;
    sections?: unknown[];
    // Readiness verdict computed server-side on every read (spec 007). The client
    // never derives these — quiz completeness isn't even in this payload.
    is_publishable: boolean;
    needs_attention: boolean;
}

export function statusOf(course: Pick<InstructorCourse, 'is_published'>): CourseStatus {
    return course.is_published ? 'published' : 'draft';
}

// ---------------------------------------------------------------------------
// Publishing & readiness (spec 007) — mirrors backend apps/course/publishing/dto.py
// ---------------------------------------------------------------------------

export type ReadinessSeverity = 'blocking' | 'advisory';

// Stable codes. Switch on these, never on `message` (which is display copy and
// may change). Literal union so readinessHref() below is exhaustiveness-checked.
export type ReadinessCode =
    | 'missing_thumbnail'
    | 'no_sections'
    | 'empty_section'
    | 'lecture_video_missing'
    | 'lecture_video_processing'
    | 'lecture_video_failed'
    | 'quiz_no_questions'
    | 'quiz_incomplete_question'
    | 'no_language'
    | 'no_goals'
    | 'no_quizzes';

export interface ReadinessTarget {
    kind: 'course' | 'section' | 'lecture' | 'quiz';
    id: number;
    section_id?: number;
}

export interface ReadinessItem {
    code: ReadinessCode;
    severity: ReadinessSeverity;
    message: string;
    target: ReadinessTarget | null;
}

export interface ReadinessReport {
    status: CourseStatus;
    is_publishable: boolean;
    needs_attention: boolean;
    blockers: ReadinessItem[];
    advisories: ReadinessItem[];
}

// Shape returned by POST publish/unpublish: the fresh report plus what happened.
export interface PublishTransition extends ReadinessReport {
    changed: boolean;
    detail: string;
}

// Where the instructor goes to fix an item (FR-018). The `never` default turns
// a code added on the backend but not mapped here into a tsc error rather than a
// silently dead link.
export function readinessHref(courseId: number, item: ReadinessItem): string {
    const base = `/instructor/courses/${courseId}`;
    const code = item.code;
    switch (code) {
        case 'missing_thumbnail':
        case 'no_language':
        case 'no_goals':
            return `${base}/edit`;
        case 'no_sections':
        case 'empty_section':
        case 'no_quizzes':
            return `${base}/curriculum`;
        case 'lecture_video_missing':
        case 'lecture_video_processing':
        case 'lecture_video_failed':
            return item.target ? `${base}/curriculum/lectures/${item.target.id}` : `${base}/curriculum`;
        case 'quiz_no_questions':
        case 'quiz_incomplete_question':
            return item.target ? `${base}/quizzes/${item.target.id}` : `${base}/curriculum`;
        default: {
            const unmapped: never = code;
            return unmapped;
        }
    }
}
