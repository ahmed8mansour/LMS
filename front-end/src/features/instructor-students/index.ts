// Public surface of the instructor student roster feature (spec 010).

export { instructorStudentsAPI } from './api/instructorStudents.api';

export type {
    RosterRow,
    RosterPage,
    RosterCourse,
    RosterQuery,
} from './types/instructorStudents.types';
export {
    ROSTER_PAGE_SIZE,
    formatEnrolledAt,
    progressLabel,
} from './types/instructorStudents.types';

// Hooks
export { useInstructorStudents } from './hooks/useInstructorStudents';
export { useRosterParams } from './hooks/useRosterParams';

// Components — the two orchestrators are the only entry points a page needs.
export { CourseStudents } from './components/CourseStudents';
export { InstructorStudents } from './components/InstructorStudents';
export { RosterSkeleton } from './components/RosterStates';
