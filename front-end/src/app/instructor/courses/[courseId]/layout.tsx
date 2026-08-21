'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CourseWorkspaceTabs, useInstructorCourse } from '@/featuers/instructor-courses';

// Per-course workspace shell: breadcrumb root + persistent tab bar around the child
// route. A non-owned / missing course surfaces a clear not-found state (ownership
// is enforced server-side).
export default function CourseWorkspaceLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const courseId = Number(params.courseId);
    const { data: course, isLoading, isError } = useInstructorCourse(courseId);

    if (isError) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-graytext/20 bg-white py-20 text-center">
                <h1 className="text-lg font-bold text-darktext">Course not found</h1>
                <p className="text-sm text-graytext2">
                    This course doesn’t exist or you don’t have access to it.
                </p>
                <Link href="/instructor/courses" className="font-semibold text-darkmint hover:underline">
                    Back to My Courses
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <nav className="text-xs text-graytext2">
                <Link href="/instructor/courses" className="transition-colors hover:text-darkmint">
                    Instructor / My Courses
                </Link>{' '}
                / <span className="text-darktext">{isLoading ? '…' : course?.title}</span>
            </nav>

            <CourseWorkspaceTabs courseId={courseId} />

            <div className="pt-1">{children}</div>
        </div>
    );
}
