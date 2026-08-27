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
}

export function statusOf(course: Pick<InstructorCourse, 'is_published'>): CourseStatus {
    return course.is_published ? 'published' : 'draft';
}
