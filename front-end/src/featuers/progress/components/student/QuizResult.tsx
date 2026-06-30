'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, RefreshCw, RotateCcw, Target, XCircle } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { QuizResult as QuizResultType } from '../../types/progress.types';

interface QuizResultProps {
    quizId: string;
    courseId: string;
}

export function QuizResult({ quizId, courseId }: QuizResultProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const result = queryClient.getQueryData<QuizResultType>(['quiz-result', quizId]);

    useEffect(() => {
        if (!result) {
            router.replace(`/dashboard/learn/${courseId}/quiz/${quizId}`);
        }
    }, [result, router, courseId, quizId]);

    if (!result) return null;

    return <QuizResultView result={result} courseId={courseId} quizId={quizId} />;
}

function ResultMetric({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-border bg-darkbg p-4">
            <Icon className="mb-2 h-5 w-5 text-darkmint" />
            <span className="font-headline text-lg font-bold text-darktext">{value}</span>
            <span className="mt-1 text-xs font-bold uppercase tracking-wide text-graytext">{label}</span>
        </div>
    );
}

function QuizResultView({
    result,
    courseId,
    quizId,
}: {
    result: QuizResultType;
    courseId: string;
    quizId: string;
}) {
    const isPassed = result.passed;
    const scoreLabel = `${result.score}%`;
    const answeredLabel = `${result.correct_answers}/${result.total_questions}`;

    const statusConfig = isPassed
        ? {
              icon: CheckCircle2,
              eyebrow: 'Passed',
              title: 'Quiz Completed',
              description: 'Great job. You passed this quiz and unlocked the next section.',
              iconClassName: 'bg-darkmint/10 text-darkmint shadow-[0_0_40px_rgba(43,88,105,0.18)]',
              badgeClassName: 'bg-darkmint text-white',
              scoreClassName: 'text-darkmint',
              primaryLabel: 'Continue',
              primaryHref: `/dashboard/learn/${courseId}`,
              primaryIcon: ArrowRight,
              showReview: true,
          }
        : {
              icon: XCircle,
              eyebrow: 'Failed',
              title: 'Quiz Needs Another Try',
              description: 'You need at least 50% to pass. Review the material, then retry the quiz.',
              iconClassName: 'bg-destructive/10 text-destructive shadow-[0_0_40px_rgba(220,38,38,0.14)]',
              badgeClassName: 'bg-destructive text-white',
              scoreClassName: 'text-destructive',
              primaryLabel: 'Retry Quiz',
              primaryHref: `/dashboard/learn/${courseId}/quiz/${quizId}`,
              primaryIcon: RotateCcw,
              showReview: false,
          };

    const StatusIcon = statusConfig.icon;
    const PrimaryIcon = statusConfig.primaryIcon;

    return (
        <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-8 md:px-8 md:py-12">
            <div className="absolute inset-x-0 top-0 h-72 bg-darkmint/[0.06]" />

            <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center rounded-xl border border-border bg-background p-6 text-center shadow-sm md:p-10">
                <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ${statusConfig.iconClassName}`}>
                    <StatusIcon className="h-16 w-16" />
                </div>

                <span className={`mb-6 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${statusConfig.badgeClassName}`}>
                    {statusConfig.eyebrow}
                </span>

                <div className={`mb-3 font-headline text-6xl font-black tracking-tight md:text-7xl ${statusConfig.scoreClassName}`}>
                    {scoreLabel}
                </div>

                <h1 className="mb-3 font-headline text-2xl font-bold text-darktext md:text-3xl">
                    {statusConfig.title}
                </h1>
                <p className="mb-8 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
                    {statusConfig.description}
                </p>

                <div className="w-full max-w-xs">
                    <ResultMetric icon={Target} label="Correct Answers" value={answeredLabel} />
                </div>

                <div className="mt-8 flex w-full flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-center">
                    {statusConfig.showReview && (
                        <Button
                            variant="outline"
                            className="min-h-12 rounded-lg border-darkmint/20 px-6 font-headline font-bold text-darktext"
                            asChild
                        >
                            <Link href={`/dashboard/learn/${courseId}/quiz/${quizId}`}>
                                <RefreshCw className="h-4 w-4" />
                                Review Answers
                            </Link>
                        </Button>
                    )}

                    <Button asChild variant="darkmint" className="min-h-12 rounded-lg px-8 font-headline font-bold">
                        <Link href={statusConfig.primaryHref}>
                            {statusConfig.primaryLabel}
                            <PrimaryIcon className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    );
}
