export { instructorCoursesAPI } from './api/instructorCourses.api';
export type {
    InstructorCourse,
    CourseStatus,
    ReadinessCode,
    ReadinessItem,
    ReadinessReport,
    ReadinessSeverity,
    ReadinessTarget,
    PublishTransition,
} from './types/instructorCourses.types';
export { statusOf, readinessHref } from './types/instructorCourses.types';
export {
    createCourseSchema,
    editCourseSchema,
    type CourseFormData,
} from './schemas/instructorCourses.schma';

// Hooks
export { useInstructorCourses } from './hooks/useInstructorCourses';
export { useInstructorCourse } from './hooks/useInstructorCourse';
export { useCreateCourse } from './hooks/useCreateCourse';
export { useUpdateCourse } from './hooks/useUpdateCourse';
export { useDeleteCourse } from './hooks/useDeleteCourse';
export { usePublishCourse } from './hooks/usePublishCourse';
export { useCourseReadiness, readinessQueryKey } from './hooks/useCourseReadiness';

// Components
export { MyCoursesGrid } from './components/MyCoursesGrid';
export { InstructorCourseCard } from './components/InstructorCourseCard';
export { CourseForm } from './components/CourseForm';
export { GoalsListField } from './components/GoalsListField';
export { CourseWorkspaceTabs } from './components/CourseWorkspaceTabs';
export { CourseOverview } from './components/CourseOverview';
export { DeleteCourseDialog } from './components/DeleteCourseDialog';
export { PublishPanel } from './components/PublishPanel';
export {
    ReadinessChecklist,
    ReadinessChecklistSkeleton,
    ReadinessUnavailable,
} from './components/ReadinessChecklist';
export { UnpublishDialog } from './components/UnpublishDialog';
