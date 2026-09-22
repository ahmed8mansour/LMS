// Public surface of the instructor reviews feature (spec 012).
//
// Nothing outside this module may import a deep path.

export { instructorReviewsAPI } from './api/instructorReviews.api';

export type {
    ReviewRow,
    ReviewStats,
    ReviewsPage,
    ReviewsQuery,
    ReviewerRef,
    ReviewCourseRef,
    RatingFilter as RatingFilterValue,
} from './types/instructorReviews.types';
export {
    RATING_OPTIONS,
    REVIEWS_PAGE_SIZE,
    avgRatingLabel,
    fiveStarRate,
    formatReviewDate,
    hasReviews,
    parseRatingFilter,
    ratingFilterLabel,
} from './types/instructorReviews.types';

// Hooks
export { useInstructorReviews } from './hooks/useInstructorReviews';
export { useReviewParams } from './hooks/useReviewParams';

// Components — the two orchestrators are the only entry points a page needs.
export { CourseReviews } from './components/CourseReviews';
export { InstructorReviews } from './components/InstructorReviews';
export { ReviewsSkeleton } from './components/ReviewsStates';
