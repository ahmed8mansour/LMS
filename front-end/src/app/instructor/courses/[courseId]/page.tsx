'use client';

import { useParams } from 'next/navigation';
import BounceLoader from '@/components/atoms/bouncing-loader';
import { CourseOverview, useInstructorCourse } from '@/featuers/instructor-courses';

export default function CourseOverviewPage() {
    const params = useParams();
    const courseId = Number(params.courseId);
    const { data: course, isLoading, isError } = useInstructorCourse(courseId);

    // The workspace layout already renders the not-found state; here we just guard render.
    if (isLoading) {
        return (
            <div className="flex min-h-[30vh] items-center justify-center">
                <BounceLoader />
            </div>
        );
    }
    if (isError || !course) {
        return null;
    }

    return <CourseOverview course={course} />;
}
