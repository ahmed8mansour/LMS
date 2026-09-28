import { useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadVideoToCloudinary, type UploadPhase } from '@/lib/cloudinary';
import { toastsuccess, toasterror, handleAuthError } from '@/lib/toast';
import { LECTURE_VIDEO_KEY } from './useLectureVideo';

// Uploads one lecture video straight to Cloudinary and tracks real progress.
// The upload only becomes the lecture's video once our API confirms it landed,
// so a failure here leaves whatever the lecture was already serving untouched —
// which is what makes "replace" safe without deleting anything first.
export function useUploadVideo(lectureId: number) {
    const queryClient = useQueryClient();
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState<UploadPhase>('transferring');
    const abortRef = useRef<AbortController | null>(null);

    const mutation = useMutation({
        mutationFn: (file: File) => {
            const controller = new AbortController();
            abortRef.current = controller;
            setProgress(0);
            setPhase('transferring');
            return uploadVideoToCloudinary(file, lectureId, {
                signal: controller.signal,
                onProgress: setProgress,
                onPhase: setPhase,
            });
        },
        onSuccess() {
            // Only the video key. It is a prefix-child of
            // ['instructor','lecture',lectureId], so invalidating that parent
            // would refetch the lecture query and reset the editor form,
            // silently discarding unsaved title/duration edits.
            queryClient.invalidateQueries({ queryKey: LECTURE_VIDEO_KEY(lectureId) });
            // The curriculum tree carries each lecture's video badge.
            queryClient.invalidateQueries({ queryKey: ['instructor', 'course'] });
            toastsuccess('Video uploaded', 'The server is processing it now');
        },
        onError(e: AxiosError | Error) {
            const axiosError = e as AxiosError;
            if (axiosError.code === 'ERR_CANCELED') return; // user cancelled — not a failure
            // A plain Error is our own pre-flight rejection (a file that breaks
            // the signed limits, an empty file). Its message is already the
            // explanation; handleAuthError would misread the missing `response`
            // as the server being unreachable.
            if (!axiosError.isAxiosError) {
                toasterror('Video upload failed', e.message);
                return;
            }
            handleAuthError(axiosError, 'Video upload failed');
        },
    });

    // Abort an in-flight upload. The lecture is untouched either way: nothing is
    // promoted until the upload is confirmed.
    const cancel = () => abortRef.current?.abort();

    return {
        mutate: mutation.mutate, // call as mutate(file)
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        isError: mutation.isError,
        progress,
        phase,
        cancel,
    };
}
