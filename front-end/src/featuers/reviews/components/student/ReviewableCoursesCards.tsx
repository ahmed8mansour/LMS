"use client";
import { ReviewSubmissionCard } from "@/featuers/reviews/components/student/ReviewSubmissionCard";
import { useReviewableCourses } from "@/featuers/reviews/hooks/useReviewableCourses";
import BounceLoader from "@/components/atoms/bouncing-loader";


export function ReviewableCoursesCards() {

    const { data: reviewableCourses, isLoading, isError } = useReviewableCourses();
    
    return (
        
            <div className="mt-8 max-w-3xl space-y-6">

                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <BounceLoader />
                    </div>
                )}

                {isError && (
                    <div className="bg-white border border-destructive/30 rounded-xl p-8 text-center text-graytext2">
                        Something went wrong loading your reviewable courses.
                    </div>
                )}

                {!isLoading && !isError && reviewableCourses?.length === 0 && (
                    <div className="bg-white border border-dashed border-graylighttext/40 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                        <h3 className="font-semibold text-darktext">You&apos;re all caught up!</h3>
                        <p className="text-sm text-graytext2 mt-1">
                            Complete more courses to leave new reviews.
                        </p>
                    </div>
                )}

                {!isLoading && !isError && reviewableCourses && reviewableCourses.length > 0 && (
                    <div className="space-y-6">
                        {reviewableCourses.map((course) => (
                            <ReviewSubmissionCard key={course.course_id} course={course} />
                        ))}
                    </div>
                )}
            </div>
    )
}
