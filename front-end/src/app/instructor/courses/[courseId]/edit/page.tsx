'use client';

import { useParams } from 'next/navigation';
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
