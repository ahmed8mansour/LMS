import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InstructorVideoUploadingAPI } from '../api/InstructorVideoUploading.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

// Removes a lecture's video (destroys the Cloudinary asset + resets the row).
// Kept separate from the read/poll hook — one concern each.
export function useDeleteVideo(lectureId: number) {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: () => InstructorVideoUploadingAPI.deleteVideo(lectureId),
        onSuccess() {
            // Delete returns 204, so re-read rather than seeding from a payload.
            // Only the video key: it's a prefix-child of
            // ['instructor','lecture',lectureId], and invalidating that parent
            // would refetch the lecture query and reset the editor form,
            // discarding any unsaved title/duration edits.
            queryClient.invalidateQueries({ queryKey: ['instructor', 'lecture', lectureId, 'video'] });
            queryClient.invalidateQueries({ queryKey: ['instructor', 'course'] });
            toastsuccess('Video removed');
        },
        onError: (e: AxiosError) => handleAuthError(e, 'Could not remove video'),
    });

    return {
        remove: mutation.mutate,
        removeAsync: mutation.mutateAsync,
        isRemoving: mutation.isPending,
    };
}
