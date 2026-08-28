import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorCurriculumAPI } from '../api/instructorCurriculum.api';
import { handleAuthError } from '@/lib/toast';

// Choice create / edit / delete + mark-correct. Marking one correct unsets the
// others server-side; we just refetch the quiz content afterwards.
export function useChoiceMutations(quizId: number) {
    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['instructor', 'quiz-content', quizId] });

    const create = useMutation({
        mutationFn: ({ questionId, text }: { questionId: number; text: string }) =>
            instructorCurriculumAPI.createChoice(questionId, text),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not add answer'),
    });

    const update = useMutation({
        mutationFn: ({ id, text }: { id: number; text: string }) =>
            instructorCurriculumAPI.updateChoice(id, { text }),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not save answer'),
    });

    const setCorrect = useMutation({
        mutationFn: (id: number) => instructorCurriculumAPI.updateChoice(id, { is_correct: true }),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not update answer'),
    });

    const remove = useMutation({
        mutationFn: (id: number) => instructorCurriculumAPI.deleteChoice(id),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not delete answer'),
    });

    return { create, update, setCorrect, remove };
}
