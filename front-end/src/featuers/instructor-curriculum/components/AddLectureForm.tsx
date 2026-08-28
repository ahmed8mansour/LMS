'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import { isValidDuration } from '@/lib/duration';

interface AddLectureFormProps {
    pending?: boolean;
    onAdd: (title: string, duration: string) => void | Promise<unknown>;
}

// Inline add-lecture row: title + mm:ss duration, validated before submit.
export function AddLectureForm({ pending, onAdd }: AddLectureFormProps) {
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState('');
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!title.trim()) return;
        if (!isValidDuration(duration)) {
            setError('Enter a valid time like 4:20');
            return;
        }
        setError(null);
        await onAdd(title.trim(), duration.trim());
        setTitle('');
        setDuration('');
    };

    return (
        <div className="flex flex-col gap-1 pt-2">
            <div className="flex items-center gap-2">
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Lecture title"
                    className="flex-1"
                />
                <Input
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="mm:ss"
                    className="w-24"
                    aria-label="Duration (mm:ss)"
                />
                <Button type="button" variant="darkmint" onClick={submit} disabled={pending || !title.trim()}>
                    <Plus className="mr-1 h-4 w-4" />
                    Lecture
                </Button>
            </div>
            {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
    );
}
