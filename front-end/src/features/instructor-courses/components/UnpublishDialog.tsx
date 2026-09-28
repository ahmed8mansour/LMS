'use client';

import { ReactNode, useState } from 'react';
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
import { usePublishCourse } from '../hooks/usePublishCourse';

interface UnpublishDialogProps {
    course: Pick<InstructorCourse, 'id' | 'title' | 'subscribers_count'>;
    /** The element that opens the dialog (e.g. an "Unpublish" button). */
    trigger: ReactNode;
}

// Unpublish confirmation (FR-006). It must say BOTH halves: what stops (catalog
// visibility, new enrollments) and what doesn't (enrolled students keep
// everything) — instructors reasonably fear the second.
export function UnpublishDialog({ course, trigger }: UnpublishDialogProps) {
    const [open, setOpen] = useState(false);
    const { unpublish } = usePublishCourse(course.id);
    const enrolled = course.subscribers_count;

    const handleConfirm = async () => {
        try {
            await unpublish.mutateAsync();
            setOpen(false);
        } catch {
            // The hook already toasts the error; keep the dialog open so the
            // instructor can retry or cancel.
        }
    };

    return (
        <AlertDialog
            open={open}
            // Don't let the dialog be dismissed mid-request.
            onOpenChange={(next) => !unpublish.isPending && setOpen(next)}
        >
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-darktext">Unpublish “{course.title}”?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="flex flex-col gap-2 text-sm text-graytext2">
                            <p>
                                It will be <strong>removed from the catalog</strong> and search, and{' '}
                                <strong>no one new can enroll</strong> until you publish it again.
                            </p>
                            <p>
                                {enrolled > 0 ? (
                                    <>
                                        Your <strong>{enrolled} enrolled student{enrolled === 1 ? '' : 's'}</strong>{' '}
                                        keep{enrolled === 1 ? 's' : ''} full access to the course and their progress.
                                    </>
                                ) : (
                                    <>Students who are already enrolled always keep full access and their progress.</>
                                )}{' '}
                                Nothing is refunded or deleted.
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={unpublish.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleConfirm();
                        }}
                        // Guards against a double-submit while the request is in flight.
                        disabled={unpublish.isPending}
                        className="min-w-32 bg-darktext text-white hover:bg-darktext/90"
                    >
                        {unpublish.isPending ? <ButtonLoading /> : 'Unpublish'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
