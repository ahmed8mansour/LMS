'use client';

import { useState } from 'react';
import { AlertTriangle, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Question, isQuestionComplete } from '../types/instructorCurriculum.types';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import { ChoiceRow } from './ChoiceRow';
import { DeleteCurriculumItemDialog } from './DeleteCurriculumItemDialog';
import { DragHandleProps } from './SortableList';
import { useQuestionMutations } from '../hooks/useQuestionMutations';
import { useChoiceMutations } from '../hooks/useChoiceMutations';

interface QuestionEditorProps {
    question: Question;
    index: number;
    quizId: number;
    hasEnrollments: boolean;
    handleProps: DragHandleProps;
    questionMut: ReturnType<typeof useQuestionMutations>;
    choiceMut: ReturnType<typeof useChoiceMutations>;
}

export function QuestionEditor({
    question,
    index,
    hasEnrollments,
    handleProps,
    questionMut,
    choiceMut,
}: QuestionEditorProps) {
    const [text, setText] = useState(question.text);
    const [newChoice, setNewChoice] = useState('');
    const complete = isQuestionComplete(question);

    const addChoice = () => {
        const trimmed = newChoice.trim();
        if (!trimmed) return;
        choiceMut.create.mutate({ questionId: question.id, text: trimmed });
        setNewChoice('');
    };

    return (
        <div className="rounded-lg border border-graytext/20 bg-white p-4">
            <div className="mb-3 flex items-start gap-2">
                <button
                    type="button"
                    {...handleProps}
                    aria-label="Reorder question"
                    className="mt-2 cursor-grab text-graytext2 hover:text-darktext focus:outline-none focus-visible:ring-2 focus-visible:ring-darkmint"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <div className="flex-1">
                    <label className="mb-1 block text-xs font-mono uppercase tracking-wide text-graytext2">
                        Question {index + 1}
                    </label>
                    <Input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onBlur={() => {
                            const trimmed = text.trim();
                            if (trimmed !== question.text) questionMut.update.mutate({ id: question.id, text: trimmed });
                        }}
                        placeholder="Question text"
                    />
                </div>
                <DeleteCurriculumItemDialog
                    kind="question"
                    hasEnrollments={hasEnrollments}
                    onConfirm={() => questionMut.remove.mutateAsync(question.id)}
                    trigger={
                        <button
                            type="button"
                            aria-label="Delete question"
                            className="mt-6 text-graytext2 transition-colors hover:text-red-500"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    }
                />
            </div>

            <div className="flex flex-col gap-2 pl-6">
                {question.choices.map((choice) => (
                    <ChoiceRow
                        key={choice.id}
                        choice={choice}
                        onSetCorrect={() => choiceMut.setCorrect.mutate(choice.id)}
                        onSaveText={(t) => choiceMut.update.mutate({ id: choice.id, text: t })}
                        onDelete={() => choiceMut.remove.mutate(choice.id)}
                    />
                ))}

                <div className="flex items-center gap-2">
                    <Input
                        value={newChoice}
                        onChange={(e) => setNewChoice(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addChoice();
                            }
                        }}
                        placeholder="Add an answer"
                        className="h-8 flex-1"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addChoice}
                        disabled={!newChoice.trim()}
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Answer
                    </Button>
                </div>

                {!complete && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Needs question text, at least two answers, and exactly one marked correct.
                    </p>
                )}
            </div>
        </div>
    );
}
