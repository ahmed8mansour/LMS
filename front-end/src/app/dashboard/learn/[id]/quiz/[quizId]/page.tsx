import { QuizContent } from '@/featuers/progress/components/student/QuizContent';

interface QuizPageProps {
    params: Promise<{ id: string; quizId: string }>;
}

export default async function QuizPage({ params }: QuizPageProps) {
    const { id, quizId } = await params;
    return <QuizContent quizId={quizId} courseId={id} />;
}
