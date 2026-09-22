"use client";

import { useQuery } from "@tanstack/react-query";
import { instructorCoursesAPI } from "@/featuers/instructor-courses";
import { useInstructorReviews } from "../hooks/useInstructorReviews";
import { useReviewParams } from "../hooks/useReviewParams";
import { ReviewsFeed } from "./ReviewsFeed";

/**
 * The sidebar Reviews page: every review on every owned course (FR-002, FR-033 – FR-035).
 *
 * Mirrors CourseReviews with two differences: no `courseId`, and the extra empty state.
 */
export function InstructorReviews() {
    const { rating, page } = useReviewParams();
    // Reads the same cache entry ReviewsFeed populates, so this adds no request — it only
    // needs to know whether the scope came back empty.
    const query = useInstructorReviews({ rating, page });

    // FR-035 needs "you own no courses" told apart from "your courses have no reviews
    // yet", and an empty feed cannot distinguish them — both are total_reviews: 0. The
    // course list answers it, but only in that one case, so the query is gated rather
    // than run on every visit. The key matches useInstructorCourses (spec 004), so a
    // visit to My Courses makes this free.
    const coursesQuery = useQuery({
        queryKey: ["instructor", "courses"],
        queryFn: instructorCoursesAPI.list,
        enabled: !!query.data && query.data.stats.total_reviews === 0,
    });

    return (
        <div className="mx-auto flex max-w-5xl flex-col">
            <ReviewsFeed
                title="Reviews"
                subtitle="Read-only · across all your courses"
                ownsNoCourses={coursesQuery.data?.length === 0}
                headingClassName="text-2xl"
            />
        </div>
    );
}
