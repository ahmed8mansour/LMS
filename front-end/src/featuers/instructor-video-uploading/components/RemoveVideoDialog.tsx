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

interface RemoveVideoDialogProps {
    /** True when the containing course has enrolled students. */
    hasEnrollments: boolean;
    /** Removes the video; the dialog owns the pending state and closes on success. */
    onConfirm: () => Promise<unknown>;
    trigger: ReactNode;
}

// Removing a video destroys the stored asset permanently — there is no undo and
// no soft-delete — so it must never be one click. Mirrors
// DeleteCurriculumItemDialog, with copy specific to video rather than to a
// curriculum item and its contents.
export function RemoveVideoDialog({ hasEnrollments, onConfirm, trigger }: RemoveVideoDialogProps) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);

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
                        Remove this lecture&rsquo;s video?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-graytext2">
                        {hasEnrollments ? (
                            <>
                                The video file will be <strong>permanently deleted</strong>, and your{' '}
                                <strong>enrolled students will immediately lose access</strong> to it. The
                                lecture itself stays, so you can upload a replacement. This cannot be undone.
                            </>
                        ) : (
                            <>
                                The video file will be permanently deleted. The lecture itself stays, so you
                                can upload a replacement. This cannot be undone.
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
                        {pending ? <ButtonLoading /> : 'Remove video'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
