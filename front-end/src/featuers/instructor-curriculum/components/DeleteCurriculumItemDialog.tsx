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

export type CurriculumItemKind = 'section' | 'lecture' | 'quiz' | 'question' | 'choice';

interface DeleteCurriculumItemDialogProps {
    kind: CurriculumItemKind;
    /** e.g. the section/lecture title; shown in the confirmation heading. */
    label?: string;
    /** True when the containing course has enrolled students (US4). */
    hasEnrollments: boolean;
    /** Deletes the item; the dialog handles the pending state and closes on success. */
    onConfirm: () => Promise<unknown>;
    trigger: ReactNode;
}

// Only structural items whose removal revokes student access escalate the copy.
const ACCESS_AFFECTING: CurriculumItemKind[] = ['section', 'lecture', 'quiz'];

// Enrollment-aware delete confirmation for any curriculum item (FR-013). When
// the course has enrolled students, deleting a section/lecture/quiz warns that
// students immediately lose access; other cases use a lighter confirmation.
export function DeleteCurriculumItemDialog({
    kind,
    label,
    hasEnrollments,
    onConfirm,
    trigger,
}: DeleteCurriculumItemDialogProps) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);

    const escalate = hasEnrollments && ACCESS_AFFECTING.includes(kind);

    const handleConfirm = async () => {
        setPending(true);
        try {
            await onConfirm();
            setOpen(false);
        } finally {
            setPending(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-darktext">
                        Delete this {kind}
                        {label ? ` “${label}”` : ''}?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-graytext2">
                        {escalate ? (
                            <>
                                This {kind} and everything inside it will be{' '}
                                <strong>permanently removed</strong>, and your{' '}
                                <strong>enrolled students will immediately lose access</strong> to it.
                                This cannot be undone.
                            </>
                        ) : (
                            <>
                                This {kind} and everything inside it will be permanently removed. This
                                cannot be undone.
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleConfirm();
                        }}
                        disabled={pending}
                        className="min-w-28 bg-red-500 text-white hover:bg-red-600 focus:ring-red-500"
                    >
                        {pending ? <ButtonLoading /> : `Delete ${kind}`}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
