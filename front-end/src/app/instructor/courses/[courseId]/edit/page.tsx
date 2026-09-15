'use client';

import { useParams } from 'next/navigation';
import { Info } from 'lucide-react';
import BounceLoader from '@/components/atoms/bouncing-loader';
import {
    CourseForm,
    useInstructorCourse,
    useUpdateCourse,
    type CourseFormData,
} from '@/featuers/instructor-courses';

export default function EditCoursePage() {
    const params = useParams();
    const courseId = Number(params.courseId);
    const { data: course, isLoading, isError } = useInstructorCourse(courseId);
    const updateCourse = useUpdateCourse();

    if (isLoading) {
        return (
            <div className="flex min-h-[30vh] items-center justify-center">
                <BounceLoader />
            </div>
        );
    }
    if (isError || !course) {
        // The workspace layout renders the not-found state.
        return null;
    }

    const defaults: Partial<CourseFormData> = {
        title: course.title,
        description: course.description,
        price: String(course.price),
        category: course.category as CourseFormData['category'],
        level: course.level as CourseFormData['level'],
        language: course.language ?? '',
        goals: course.goals_list?.length ? course.goals_list : [''],
    };

    const handleSubmit = (data: CourseFormData) => {
        updateCourse.mutate({ id: courseId, form: data });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-darktext">Edit course</h1>
                <p className="text-sm text-graytext2">Update the details or replace the thumbnail.</p>
            </div>

            {/* No versioning exists, so this notice is the whole mitigation (FR-027). */}
            {course.is_published && (
                <p
                    role="note"
                    className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                >
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    This course is live. Changes you save are visible to enrolled students immediately.
                </p>
            )}

            <CourseForm
                mode="edit"
                defaultValues={defaults}
                currentThumbnailUrl={course.thumbnail}
                onSubmit={handleSubmit}
                isPending={updateCourse.isPending}
            />
        </div>
    );
}
