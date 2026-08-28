// Public surface of the instructor-curriculum feature module.

export { CurriculumBuilder } from './components/CurriculumBuilder';
export { LectureEditor } from './components/LectureEditor';
export { QuizEditor } from './components/QuizEditor';

export { useCurriculum } from './hooks/useCurriculum';
export { useSectionMutations } from './hooks/useSectionMutations';
export { useLectureMutations } from './hooks/useLectureMutations';
export { useQuizMutations, useQuizContent } from './hooks/useQuizMutations';
export { useQuestionMutations } from './hooks/useQuestionMutations';
export { useChoiceMutations } from './hooks/useChoiceMutations';

export { instructorCurriculumAPI } from './api/instructorCurriculum.api';

export type {
    Section,
    Lecture,
    QuizStub,
    Question,
    Choice,
    VideoStatus,
} from './types/instructorCurriculum.types';
