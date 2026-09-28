'use client';

import { ReactNode } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/atoms/alert-dialog';
import ButtonLoading from '@/components/atoms/buttonloading';
import { InstructorCourse } from '../types/instructorCourses.types';
import { useDeleteCourse } from '../hooks/useDeleteCourse';

interface DeleteCourseDialogProps {
    course: Pick<InstructorCourse, 'id' | 'title' | 'subscribers_count'>;
    /** The element that opens the dialog (e.g. a "Delete" button). */
    trigger: ReactNode;
    /** Called after a successful delete (e.g. to redirect away from a workspace). */
    onDeleted?: () => void;
}

// Enrollment-aware delete confirmation (FR-014). When the course has enrolled
// students, the copy explicitly names that they will lose access.
export function DeleteCourseDialog({ course, trigger, onDeleted }: DeleteCourseDialogProps) {
    const deleteCourse = useDeleteCourse();
    const hasStudents = course.subscribers_count > 0;

    const handleConfirm = async () => {
        await deleteCourse.mutateAsync(course.id);
        onDeleted?.();
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-darktext">
                        Delete “{course.title}”?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-graytext2">
                        {hasStudents ? (
                            <>
                                This course and all of its content will be{' '}
                                <strong>permanently removed</strong>, and its{' '}
                                <strong>{course.subscribers_count} enrolled student
                                {course.subscribers_count === 1 ? '' : 's'}</strong> will{' '}
                                <strong>immediately lose access</strong>. This cannot be undone.
                            </>
                        ) : (
                            <>
                                This course and all of its content will be permanently removed. This
                                cannot be undone.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteCourse.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleConfirm();
                        }}
                        disabled={deleteCourse.isPending}
                        className="min-w-32 bg-red-500 text-white hover:bg-red-600 focus:ring-red-500"
                    >
                        {deleteCourse.isPending ? <ButtonLoading /> : 'Delete course'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
