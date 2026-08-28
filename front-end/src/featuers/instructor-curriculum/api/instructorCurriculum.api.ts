import axiosInstance from '@/lib/axios';
import { Choice, Lecture, Question, QuizStub, Section } from '../types/instructorCurriculum.types';

// Namespaced client for the instructor curriculum endpoints. Structure reads
// come from the course retrieve (see useCurriculum); these cover the writes and
// the quiz-content read. All ownership is enforced server-side.

const SECTIONS = '/courses/instructor/sections/';
const LECTURES = '/courses/instructor/lectures/';
const QUIZZES = '/courses/instructor/quizzes/';
const QUESTIONS = '/courses/instructor/questions/';
const CHOICES = '/courses/instructor/choices/';

// --- sections ---
async function createSection(courseId: number, title: string): Promise<Section> {
    const { data } = await axiosInstance.post(SECTIONS, { course: courseId, title });
    return data;
}
async function updateSection(id: number, body: Partial<Pick<Section, 'title' | 'order'>>): Promise<Section> {
    const { data } = await axiosInstance.patch(`${SECTIONS}${id}/`, body);
    return data;
}
async function deleteSection(id: number): Promise<void> {
    await axiosInstance.delete(`${SECTIONS}${id}/`);
}

// --- lectures ---
async function createLecture(sectionId: number, title: string, duration: string): Promise<Lecture> {
    const { data } = await axiosInstance.post(LECTURES, { section: sectionId, title, duration });
    return data;
}
async function updateLecture(
    id: number,
    body: Partial<Pick<Lecture, 'title' | 'duration' | 'order'>>,
): Promise<Lecture> {
    const { data } = await axiosInstance.patch(`${LECTURES}${id}/`, body);
    return data;
}
async function getLecture(id: number): Promise<Lecture> {
    const { data } = await axiosInstance.get(`${LECTURES}${id}/`);
    return data;
}
async function deleteLecture(id: number): Promise<void> {
    await axiosInstance.delete(`${LECTURES}${id}/`);
}

// --- quizzes ---
async function createQuiz(sectionId: number, title: string): Promise<QuizStub> {
    const { data } = await axiosInstance.post(QUIZZES, { section: sectionId, title });
    return data;
}
async function getQuiz(id: number): Promise<QuizStub> {
    const { data } = await axiosInstance.get(`${QUIZZES}${id}/`);
    return data;
}
async function deleteQuiz(id: number): Promise<void> {
    await axiosInstance.delete(`${QUIZZES}${id}/`);
}

// --- questions (with nested choices on read) ---
async function listQuestions(quizId: number): Promise<Question[]> {
    const { data } = await axiosInstance.get(QUESTIONS, { params: { quiz: quizId } });
    return data;
}
async function createQuestion(quizId: number, text: string): Promise<Question> {
    const { data } = await axiosInstance.post(QUESTIONS, { quiz: quizId, text });
    return data;
}
async function updateQuestion(
    id: number,
    body: Partial<Pick<Question, 'text' | 'order'>>,
): Promise<Question> {
    const { data } = await axiosInstance.patch(`${QUESTIONS}${id}/`, body);
    return data;
}
async function deleteQuestion(id: number): Promise<void> {
    await axiosInstance.delete(`${QUESTIONS}${id}/`);
}

// --- choices ---
async function createChoice(questionId: number, text: string, isCorrect = false): Promise<Choice> {
    const { data } = await axiosInstance.post(CHOICES, {
        question: questionId,
        text,
        is_correct: isCorrect,
    });
    return data;
}
async function updateChoice(
    id: number,
    body: Partial<Pick<Choice, 'text' | 'is_correct'>>,
): Promise<Choice> {
    const { data } = await axiosInstance.patch(`${CHOICES}${id}/`, body);
    return data;
}
async function deleteChoice(id: number): Promise<void> {
    await axiosInstance.delete(`${CHOICES}${id}/`);
}

export const instructorCurriculumAPI = {
    createSection,
    updateSection,
    deleteSection,
    createLecture,
    updateLecture,
    getLecture,
    deleteLecture,
    createQuiz,
    getQuiz,
    deleteQuiz,
    listQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    createChoice,
    updateChoice,
    deleteChoice,
};
