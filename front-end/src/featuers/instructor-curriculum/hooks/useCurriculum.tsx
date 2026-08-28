import { useInstructorCourse } from '@/featuers/instructor-courses';
import { Section } from '../types/instructorCurriculum.types';

// The curriculum structure (sections → lectures → quiz stub) is already returned
// nested by the instructor course retrieve, so the builder reuses that query
// rather than a separate structure endpoint (research R7). `hasEnrollments` is
// derived from the course's subscriber count to drive the delete warning (US4).
export function useCurriculum(courseId: number) {
    const query = useInstructorCourse(courseId);
    const sections = ((query.data?.sections ?? []) as Section[])
        .slice()
        .sort((a, b) => a.order - b.order);

    return {
        ...query,
        course: query.data,
        sections,
        hasEnrollments: (query.data?.subscribers_count ?? 0) > 0,
    };
}
