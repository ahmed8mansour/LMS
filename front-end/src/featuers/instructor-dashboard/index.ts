// Public surface of the instructor dashboard feature (spec 008).

export { instructorDashboardAPI } from './api/instructorDashboard.api';
export type {
    DashboardSnapshot,
    AttentionType,
    AttentionItem,
    RecentEnrollment,
    RecentReview,
    PersonRef,
    CourseRef,
} from './types/instructorDashboard.types';
export { attentionHref } from './types/instructorDashboard.types';

// Hooks
export { useInstructorDashboard } from './hooks/useInstructorDashboard';

// Components
export { InstructorDashboard } from './components/InstructorDashboard';

// Reused by the instructor-analytics module (spec 009): the same handled state and the
// same 403 code check apply to every instructor-scoped read.
export { NoInstructorProfileState } from './components/NoInstructorProfileState';
export { isNoInstructorProfileError } from './types/instructorDashboard.types';
