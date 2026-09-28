import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { instructorCurriculumAPI } from '../api/instructorCurriculum.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

// Create/delete a section's single quiz. Invalidates the course tree so the
// section's quiz row updates.
export function useQuizMutations(courseId: number) {
    const queryClient = useQueryClient();
    const invalidate = () =>
        queryClient.invalidateQueries({ queryKey: ['instructor', 'course', courseId] });

    const create = useMutation({
        mutationFn: ({ sectionId, title }: { sectionId: number; title: string }) =>
            instructorCurriculumAPI.createQuiz(sectionId, title),
        onSuccess() {
            invalidate();
            toastsuccess('Quiz added');
        },
        onError: (e: AxiosError) => handleAuthError(e, 'Could not add quiz'),
    });

    const remove = useMutation({
        mutationFn: (id: number) => instructorCurriculumAPI.deleteQuiz(id),
        onSuccess() {
            invalidate();
            toastsuccess('Quiz deleted');
        },
        onError: (e: AxiosError) => handleAuthError(e, 'Could not delete quiz'),
    });

    return { create, remove };
}

// Loads the quiz metadata + its questions (with nested choices) for the editor.
export function useQuizContent(quizId: number) {
    const quiz = useQuery({
        queryKey: ['instructor', 'quiz', quizId],
        queryFn: () => instructorCurriculumAPI.getQuiz(quizId),
        enabled: Number.isFinite(quizId),
        retry: false,
    });
    const questions = useQuery({
        queryKey: ['instructor', 'quiz-content', quizId],
        queryFn: () => instructorCurriculumAPI.listQuestions(quizId),
        enabled: Number.isFinite(quizId),
        retry: false,
    });
    return { quiz, questions };
}
