'use client';

import { useParams } from 'next/navigation';
import { QuizEditor } from '@/featuers/instructor-curriculum';

export default function QuizEditorPage() {
    const params = useParams();
    const courseId = Number(params.courseId);
    const quizId = Number(params.quizId);
    return <QuizEditor courseId={courseId} quizId={quizId} />;
}
