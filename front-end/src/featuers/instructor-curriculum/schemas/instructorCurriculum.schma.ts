import { z } from 'zod';
import { isValidDuration } from '@/lib/duration';

// Section: a non-empty title (≤255).
export const sectionSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title is too long'),
});
export type SectionFormData = z.infer<typeof sectionSchema>;

// Lecture: title + duration entered as mm:ss (resolved to a positive minutes value).
export const lectureSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title is too long'),
    duration: z
        .string()
        .trim()
        .min(1, 'Duration is required')
        .refine(isValidDuration, 'Enter a valid time like 4:20'),
});
export type LectureFormData = z.infer<typeof lectureSchema>;

// Quiz: a title for the section's single quiz.
export const quizSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(255, 'Title is too long'),
});
export type QuizFormData = z.infer<typeof quizSchema>;

// Question / choice text (blank allowed mid-edit for questions, but the add
// form asks for text; choices require text).
export const questionSchema = z.object({
    text: z.string().trim().min(1, 'Question text is required'),
});
export type QuestionFormData = z.infer<typeof questionSchema>;

export const choiceSchema = z.object({
    text: z.string().trim().min(1, 'Answer text is required'),
});
export type ChoiceFormData = z.infer<typeof choiceSchema>;
