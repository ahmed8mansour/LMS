import { QuizResult } from '@/featuers/progress/components/student/QuizResult';

interface QuizResultPageProps {
    params: Promise<{ id: string; quizId: string }>;
}

export default async function QuizResultPage({ params }: QuizResultPageProps) {
    const { id, quizId } = await params;
    return <QuizResult quizId={quizId} courseId={id} />;
}
