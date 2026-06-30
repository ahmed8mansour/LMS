'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Lock, RotateCcw, Send } from 'lucide-react';
import { FaCircleCheck } from 'react-icons/fa6';
import { Button } from '@/components/atoms/button';
import { Skeleton } from '@/components/atoms/skeleton';
import { useUIStore } from '@/store/ui.store';
import ButtonLoading from '@/components/atoms/buttonloading';
import { useQuizData } from '../../hooks/useQuizData';
import { useSubmitQuiz } from '../../hooks/useSubmitQuiz';
import { QuizChoice } from '../../types/progress.types';

interface QuizContentProps {
    quizId: string;
    courseId: string;
}

export function QuizContent({ quizId, courseId }: QuizContentProps) {
    const router = useRouter();
    const isSidebarOpen = useUIStore((state) => state.isLearnSideBarOpen);
    const { data: quiz, isLoading, isError, refetch, isForbidden, customErrorMessage } = useQuizData(quizId);
    const { mutate: submitQuiz, isPending } = useSubmitQuiz(quizId);

    // question.id → selected choice.id
    const [answers, setAnswers] = useState<Record<number, number>>({});

    const allAnswered = quiz ? Object.keys(answers).length === quiz.questions_count : false;

    function handleSelect(questionId: number, choiceId: number) {
        setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
    }

    function handleSubmit() {
        if (!quiz || !allAnswered) return;
        const payload = {
            quiz_id: Number(quizId),
            answers: quiz.questions.map((q) => ({
                question_id: q.id,
                choice_id: answers[q.id],
            })),
        };
        submitQuiz(payload, {
            onSuccess: () => {
                router.push(`/dashboard/learn/${courseId}/quiz/${quizId}/result`);
            },
        });
    }

    if (isLoading) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-8 lg:p-10 space-y-8 pb-24">
                <div className="space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                </div>
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full rounded-xl" />
                ))}
            </div>
        );
    }

    if (isError || !quiz) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
                <div className="flex max-w-md flex-col items-center gap-4 text-center">
                    {isForbidden && <Lock className="h-12 w-12 text-graytext" />}
                    <h1 className="text-2xl font-bold text-darktext">
                        {isForbidden ? 'Quiz Locked' : 'Quiz unavailable'}
                    </h1>
                    <p className="text-sm text-graytext2">{customErrorMessage}</p>
                    {!isForbidden && (
                        <Button
                            type="button"
                            variant="darkmint"
                            onClick={() => refetch()}
                            className="flex items-center gap-2"
                        >
                            <RotateCcw className="h-4 w-4" />
                            Retry
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    const isReviewMode = quiz.passed;

    return (
        <>
            <div className="max-w-5xl mx-auto p-4 md:p-8 lg:p-10 space-y-8 pb-24">
                <header className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-3">
                        {quiz.title}
                    </h1>
                    {isReviewMode ? (
                        <div className="flex items-center gap-2 p-3 bg-darkmint/10 text-darkmint rounded-lg border border-darkmint/20">
                            <FaCircleCheck className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">You already passed this quiz. Here are your answers.</p>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 p-3 bg-darkbg text-muted-foreground rounded-lg border border-border/30">
                            <Info className="w-5 h-5 text-darkmint flex-shrink-0" />
                            <p className="text-sm">Answer all questions below, then submit to record your score.</p>
                        </div>
                    )}
                </header>

                <div className="flex flex-col gap-8 pb-24">
                    {quiz.questions.map((question, index) => (
                        <section
                            key={question.id}
                            className="bg-card rounded-xl p-6 shadow-sm border border-border/40"
                        >
                            <h3 className="text-lg font-headline font-semibold text-foreground mb-4 flex items-center gap-3">
                                <span className="bg-primary/10 text-primary h-7 w-7 rounded-full flex items-center justify-center text-sm shrink-0">
                                    {index + 1}
                                </span>
                                {question.text}
                            </h3>
                            <div className="flex flex-col gap-3 ml-10">
                                {question.choices.map((choice) => (
                                    <ChoiceOption
                                        key={choice.id}
                                        choice={choice}
                                        questionId={question.id}
                                        selected={answers[question.id] === choice.id}
                                        isReviewMode={isReviewMode}
                                        onSelect={handleSelect}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            {!isReviewMode && (
                <div
                    className={`fixed bottom-0 left-0 w-full border-t border-border bg-background/80 backdrop-blur-md p-4 z-20 transition-[left,width] duration-300 ease-in-out ${
                        isSidebarOpen ? 'md:left-80 md:w-[calc(100%-20rem)]' : 'md:left-0 md:w-full'
                    }`}
                >
                    <div className="max-w-5xl px-8 w-full mx-auto flex justify-center">
                        <Button
                            variant="darkmint"
                            className="w-full py-4 min-h-12 font-headline font-bold text-lg flex items-center justify-center gap-2 disabled:cursor-not-allowed active:scale-[0.98]"
                            onClick={handleSubmit}
                            disabled={!allAnswered || isPending}
                        >
                            {isPending ? (
                                <ButtonLoading />
                            ) : (
                                <>
                                    Submit Quiz
                                    <Send className="w-5 h-5" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Choice option ─────────────────────────────────────────────────────────

interface ChoiceOptionProps {
    choice: QuizChoice;
    questionId: number;
    selected: boolean;
    isReviewMode: boolean;
    onSelect: (questionId: number, choiceId: number) => void;
}

function ChoiceOption({ choice, questionId, selected, isReviewMode, onSelect }: ChoiceOptionProps) {
    // Review mode: highlight with correct/incorrect
    if (isReviewMode) {
        const wasSelected = choice.selected === true;
        const isCorrect = choice.correct === true;

        let reviewClass = 'border-border bg-transparent';
        if (isCorrect) reviewClass = 'border-darkmint bg-darkmint/10';
        else if (wasSelected && !isCorrect) reviewClass = 'border-destructive bg-destructive/10';

        return (
            <div className={`flex items-center p-4 border rounded-lg ${reviewClass}`}>
                <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center mr-4 shrink-0">
                    {wasSelected && (
                        <div className={`w-2.5 h-2.5 rounded-full ${isCorrect ? 'bg-darkmint' : 'bg-destructive'}`} />
                    )}
                </div>
                <span className="text-sm font-medium text-foreground flex-1">{choice.text}</span>
                {isCorrect && <FaCircleCheck className="h-4 w-4 text-darkmint ml-2 shrink-0" />}
            </div>
        );
    }

    return (
        <label className="radio-card cursor-pointer flex items-center p-4 border border-border rounded-lg hover:bg-muted/20 transition-colors">
            <input
                className="sr-only"
                type="radio"
                name={`q-${questionId}`}
                value={choice.id}
                checked={selected}
                onChange={() => onSelect(questionId, choice.id)}
            />
            <div className="radio-indicator w-5 h-5 rounded-full border-2 border-border flex items-center justify-center mr-4 shrink-0">
                <div
                    className={`w-2.5 h-2.5 rounded-full bg-darkmint transition-all duration-200 ${
                        selected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`}
                />
            </div>
            <span className="text-sm font-medium text-foreground">{choice.text}</span>
        </label>
    );
}
