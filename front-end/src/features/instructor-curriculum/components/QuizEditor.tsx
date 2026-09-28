'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/atoms/skeleton';
import { AddInlineRow } from './AddInlineRow';
import { QuestionEditor } from './QuestionEditor';
import { SortableList } from './SortableList';
import { useQuizContent } from '../hooks/useQuizMutations';
import { useQuestionMutations } from '../hooks/useQuestionMutations';
import { useChoiceMutations } from '../hooks/useChoiceMutations';
import { useCurriculum } from '../hooks/useCurriculum';

interface QuizEditorProps {
    courseId: number;
    quizId: number;
}

export function QuizEditor({ courseId, quizId }: QuizEditorProps) {
    const { questions } = useQuizContent(quizId);
    const questionMut = useQuestionMutations(quizId);
    const choiceMut = useChoiceMutations(quizId);
    const { hasEnrollments } = useCurriculum(courseId);

    const items = (questions.data ?? []).slice().sort((a, b) => a.order - b.order);

    return (
        <div className="flex flex-col gap-5">
            <Link
                href={`/instructor/courses/${courseId}/curriculum`}
                className="flex items-center gap-1.5 text-sm text-graytext2 hover:text-darkmint"
            >
                <ArrowLeft className="h-4 w-4" /> Back to curriculum
            </Link>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-darktext">Quiz editor</h1>
                    <p className="text-sm text-graytext2">
                        Questions and multiple-choice answers · pass ≥ 50%
                    </p>
                </div>
            </div>

            <div className="max-w-lg">
                <AddInlineRow
                    placeholder="New question text"
                    buttonLabel="Add question"
                    pending={questionMut.create.isPending}
                    onAdd={(text) => questionMut.create.mutateAsync(text)}
                />
            </div>

            {questions.isLoading ? (
                <div className="flex flex-col gap-3">
                    {[0, 1].map((i) => (
                        <Skeleton key={i} className="h-32 w-full rounded-lg" />
                    ))}
                </div>
            ) : questions.isError ? (
                <p className="text-sm text-red-500">Couldn&rsquo;t load this quiz.</p>
            ) : items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-graytext/30 bg-white py-12 text-center text-sm text-graytext2">
                    No questions yet. Add your first question above.
                </div>
            ) : (
                <SortableList
                    items={items}
                    onReorder={(_ids, moved) => questionMut.reorder.mutate(moved)}
                    renderItem={(question, handleProps) => (
                        <div className="mb-3">
                            <QuestionEditor
                                question={question}
                                index={items.indexOf(question)}
                                quizId={quizId}
                                hasEnrollments={hasEnrollments}
                                handleProps={handleProps}
                                questionMut={questionMut}
                                choiceMut={choiceMut}
                            />
                        </div>
                    )}
                />
            )}
        </div>
    );
}
