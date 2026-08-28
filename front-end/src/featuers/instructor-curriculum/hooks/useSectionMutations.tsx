import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorCurriculumAPI } from '../api/instructorCurriculum.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

// Section create / rename / delete / reorder. All invalidate the course query
// (the structure tree lives there — research R7). Reorder PATCHes the moved
// section's new index; the backend renumbers the whole course atomically.
export function useSectionMutations(courseId: number) {
    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['instructor', 'course', courseId] });

    const create = useMutation({
        mutationFn: (title: string) => instructorCurriculumAPI.createSection(courseId, title),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not add section'),
    });

    const rename = useMutation({
        mutationFn: ({ id, title }: { id: number; title: string }) =>
            instructorCurriculumAPI.updateSection(id, { title }),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not rename section'),
    });

    const remove = useMutation({
        mutationFn: (id: number) => instructorCurriculumAPI.deleteSection(id),
        onSuccess() {
            invalidate();
            toastsuccess('Section deleted');
        },
        onError: (e: AxiosError) => handleAuthError(e, 'Could not delete section'),
    });

    const reorder = useMutation({
        mutationFn: ({ id, newIndex }: { id: number; newIndex: number }) =>
            instructorCurriculumAPI.updateSection(id, { order: newIndex }),
        onSuccess: invalidate,
        onError(e: AxiosError) {
            handleAuthError(e, 'Could not reorder sections');
            invalidate(); // roll back optimistic order to the server truth
        },
    });

    return { create, rename, remove, reorder };
}
