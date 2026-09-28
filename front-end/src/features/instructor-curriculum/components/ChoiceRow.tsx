'use client';

import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { Choice } from '../types/instructorCurriculum.types';
import { Input } from '@/components/atoms/input';

interface ChoiceRowProps {
    choice: Choice;
    onSetCorrect: () => void;
    onSaveText: (text: string) => void;
    onDelete: () => void;
}

// A single answer: mark-correct control, editable text, delete.
export function ChoiceRow({ choice, onSetCorrect, onSaveText, onDelete }: ChoiceRowProps) {
    const [text, setText] = useState(choice.text);

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onSetCorrect}
                aria-label={choice.is_correct ? 'Correct answer' : 'Mark correct'}
                aria-pressed={choice.is_correct}
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${
                    choice.is_correct
                        ? 'border-darkmint bg-darkmint text-white'
                        : 'border-graytext/40 text-transparent hover:border-darkmint'
                }`}
            >
                <Check className="h-3.5 w-3.5" />
            </button>
            <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => {
                    const trimmed = text.trim();
                    if (trimmed && trimmed !== choice.text) onSaveText(trimmed);
                }}
                placeholder="Answer text"
                className="h-8 flex-1"
            />
            {choice.is_correct && (
                <span className="rounded-full border border-darkmint/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-darkmint">
                    Correct
                </span>
            )}
            <button
                type="button"
                onClick={onDelete}
                aria-label="Delete answer"
                className="text-graytext2 transition-colors hover:text-red-500"
            >
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );
}
