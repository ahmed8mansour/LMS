import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorCurriculumAPI } from '../api/instructorCurriculum.api';
import { handleAuthError } from '@/lib/toast';

// Question create / edit / delete / reorder within a quiz. Invalidates the quiz
// content query so the editor reflects the change (and question count).
export function useQuestionMutations(quizId: number) {
    const queryClient = useQueryClient();
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['instructor', 'quiz-content', quizId] });
        // Question completeness is a publish blocker (spec 007), so readiness must
        // refresh too. The ['instructor', 'course'] prefix covers every course's
        // readiness query without this hook needing a courseId (research R9).
        queryClient.invalidateQueries({ queryKey: ['instructor', 'course'] });
    };

    const create = useMutation({
        mutationFn: (text: string) => instructorCurriculumAPI.createQuestion(quizId, text),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not add question'),
    });

    const update = useMutation({
        mutationFn: ({ id, text }: { id: number; text: string }) =>
            instructorCurriculumAPI.updateQuestion(id, { text }),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not save question'),
    });

    const remove = useMutation({
        mutationFn: (id: number) => instructorCurriculumAPI.deleteQuestion(id),
        onSuccess: invalidate,
        onError: (e: AxiosError) => handleAuthError(e, 'Could not delete question'),
    });

    const reorder = useMutation({
        mutationFn: ({ id, newIndex }: { id: number; newIndex: number }) =>
            instructorCurriculumAPI.updateQuestion(id, { order: newIndex }),
        onSuccess: invalidate,
        onError(e: AxiosError) {
            handleAuthError(e, 'Could not reorder questions');
            invalidate();
        },
    });

    return { create, update, remove, reorder };
}
