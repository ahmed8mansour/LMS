// Read/write shapes for the curriculum builder. The structure tree (sections →
// lectures → quiz stub) is read from the existing instructor course endpoint;
// quiz content (questions + choices) comes from the new questions endpoint.
// DRF serializes Decimal fields as strings, hence `duration` is a string.

export type VideoStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Choice {
    id: number;
    question: number;
    text: string;
    is_correct: boolean;
}

export interface Question {
    id: number;
    quiz: number;
    text: string;
    order: number;
    choices: Choice[];
}

// The quiz stub carried inside the section tree (from QuizSerializer).
export interface QuizStub {
    id: number;
    section: number;
    title: string;
    questions_count: number;
}

export interface Lecture {
    id: number;
    section: number;
    title: string;
    duration: string; // decimal minutes as a string
    order: number;
    video_status: VideoStatus;
    video_url: string | null;
}

export interface Section {
    id: number;
    course: number;
    title: string;
    order: number;
    lectures: Lecture[];
    quiz: QuizStub | null;
}

// A question is "complete" when it has text, at least two choices, and exactly
// one correct choice (FR-010). Incomplete questions persist mid-edit but are
// flagged in the UI.
export function isQuestionComplete(q: Question): boolean {
    const correctCount = q.choices.filter((c) => c.is_correct).length;
    return q.text.trim().length > 0 && q.choices.length >= 2 && correctCount === 1;
}
