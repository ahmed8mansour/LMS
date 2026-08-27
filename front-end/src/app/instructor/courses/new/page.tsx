'use client';

import Link from 'next/link';
import { CourseForm, useCreateCourse, type CourseFormData } from '@/featuers/instructor-courses';

export default function NewCoursePage() {
    const createCourse = useCreateCourse();

    const handleSubmit = (data: CourseFormData) => {
        createCourse.mutate(data);
    };

    return (
        <div className="flex flex-col gap-6">
            <nav className="text-xs text-graytext2">
                <Link href="/instructor/courses" className="transition-colors hover:text-darkmint">
                    Instructor / My Courses
                </Link>{' '}
                / <span className="text-darktext">New course</span>
            </nav>

            <div>
                <h1 className="text-2xl font-bold text-darktext">Create a course</h1>
                <p className="text-sm text-graytext2">Saved as a draft — publish it when it’s ready.</p>
            </div>

            <CourseForm mode="create" onSubmit={handleSubmit} isPending={createCourse.isPending} />
        </div>
    );
}
