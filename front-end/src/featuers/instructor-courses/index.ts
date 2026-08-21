export { instructorCoursesAPI } from './api/instructorCourses.api';
export type { InstructorCourse, CourseStatus } from './types/instructorCourses.types';
export { statusOf } from './types/instructorCourses.types';
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

// Components
export { MyCoursesGrid } from './components/MyCoursesGrid';
export { InstructorCourseCard } from './components/InstructorCourseCard';
export { CourseForm } from './components/CourseForm';
export { GoalsListField } from './components/GoalsListField';
export { CourseWorkspaceTabs } from './components/CourseWorkspaceTabs';
export { CourseOverview } from './components/CourseOverview';
export { DeleteCourseDialog } from './components/DeleteCourseDialog';
