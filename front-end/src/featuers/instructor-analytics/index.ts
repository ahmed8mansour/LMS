// Public surface of the instructor analytics feature (spec 009).

export { instructorAnalyticsAPI } from './api/instructorAnalytics.api';
export type {
    CourseAnalytics as CourseAnalyticsSnapshot,
    InstructorAnalytics as InstructorAnalyticsSnapshot,
    Bucket,
    CompletionStat,
    QuizPassStat,
    SectionDropOff,
    CourseDropOff,
    PeriodLabel,
    PeriodParam,
} from './types/instructorAnalytics.types';
export { normalizePeriod, percent, emptyLabel, PERIOD_OPTIONS } from './types/instructorAnalytics.types';

// Hooks
export { useCourseAnalytics } from './hooks/useCourseAnalytics';
export { useInstructorAnalytics } from './hooks/useInstructorAnalytics';
export { usePeriodParam } from './hooks/usePeriodParam';

// Components
export { CourseAnalytics } from './components/CourseAnalytics';
export { InstructorAnalytics } from './components/InstructorAnalytics';
export { PeriodSelector } from './components/PeriodSelector';
export { AnalyticsSkeleton } from './components/AnalyticsSkeleton';
