'use client';

import { Control, useController } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { CourseFormData } from '../schemas/instructorCourses.schma';

// Repeatable add/remove rows bound to the form's `goals: string[]` value (FR-005).
export function GoalsListField({ control }: { control: Control<CourseFormData> }) {
    const {
        field: { value, onChange },
        fieldState: { error },
    } = useController({ control, name: 'goals' });

    const goals: string[] = value?.length ? value : [''];

    const setAt = (index: number, next: string) => {
        const copy = [...goals];
        copy[index] = next;
        onChange(copy);
    };
    const add = () => onChange([...goals, '']);
    const removeAt = (index: number) =>
        onChange(goals.length === 1 ? [''] : goals.filter((_, i) => i !== index));

    return (
        <div className="flex flex-col gap-2">
            {goals.map((goal, index) => (
                <div key={index} className="flex items-center gap-2">
                    <Input
                        value={goal}
                        placeholder={`Learning goal ${index + 1}`}
                        onChange={(e) => setAt(index, e.target.value)}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAt(index)}
                        aria-label={`Remove goal ${index + 1}`}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ))}

            <div>
                <Button type="button" variant="outline" size="sm" onClick={add}>
                    <Plus className="mr-1 h-4 w-4" /> Add goal
                </Button>
            </div>

            {error?.message && <span className="text-sm text-red-400">{error.message}</span>}
        </div>
    );
}
