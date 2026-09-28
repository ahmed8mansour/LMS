"use client";

import { ReviewsFeed } from "./ReviewsFeed";

/**
 * The course workspace's Reviews tab (FR-001).
 *
 * Always inside a course, so the "you own no courses" state is unreachable here — the
 * workspace could not have rendered without one.
 */
export function CourseReviews({ courseId }: { courseId: number }) {
    return (
        <ReviewsFeed
            courseId={courseId}
            title="Reviews"
            subtitle="What your students said about this course"
        />
    );
}
