import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorCurriculumAPI } from '../api/instructorCurriculum.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';
import { parseMmSs } from '@/lib/duration';

// Lecture create / update / delete / reorder. Duration is converted from mm:ss
// to decimal minutes before hitting the API. All invalidate the course tree.
export function useLectureMutations(courseId: number) {
    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['instructor', 'course', courseId] });

    const create = useMutation({
        mutationFn: ({ sectionId, title, duration }: { sectionId: number; title: string; duration: string }) =>
            instructorCurriculumAPI.createLecture(sectionId, title, parseMmSs(duration) ?? '0'),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not add lecture'),
    });

    const update = useMutation({
        mutationFn: ({ id, title, duration }: { id: number; title?: string; duration?: string }) => {
            const body: { title?: string; duration?: string } = {};
            if (title !== undefined) body.title = title;
            if (duration !== undefined) body.duration = parseMmSs(duration) ?? '0';
            return instructorCurriculumAPI.updateLecture(id, body);
        },
        onSuccess() {
            invalidate();
            toastsuccess('Lecture saved');
        },
        onError: (e: AxiosError) => handleAuthError(e, 'Could not save lecture'),
    });

    const remove = useMutation({
        mutationFn: (id: number) => instructorCurriculumAPI.deleteLecture(id),
        onSuccess() {
            invalidate();
            toastsuccess('Lecture deleted');
        },
        onError: (e: AxiosError) => handleAuthError(e, 'Could not delete lecture'),
    });

    const reorder = useMutation({
        mutationFn: ({ id, newIndex }: { id: number; newIndex: number }) =>
            instructorCurriculumAPI.updateLecture(id, { order: newIndex }),
        onSuccess: invalidate,
        onError(e: AxiosError) {
            handleAuthError(e, 'Could not reorder lectures');
            invalidate();
        },
    });

    return { create, update, remove, reorder };
}
