'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';

interface AddInlineRowProps {
    placeholder: string;
    buttonLabel: string;
    pending?: boolean;
    onAdd: (value: string) => void | Promise<unknown>;
}

// A single-field inline "add" row (used for sections). Clears on success and
// blocks submission of an empty value.
export function AddInlineRow({ placeholder, buttonLabel, pending, onAdd }: AddInlineRowProps) {
    const [value, setValue] = useState('');

    const submit = async () => {
        const trimmed = value.trim();
        if (!trimmed) return;
        await onAdd(trimmed);
        setValue('');
    };

    return (
        <div className="flex items-center gap-2">
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        submit();
                    }
                }}
                className="flex-1"
            />
            <Button type="button" variant="darkmint" onClick={submit} disabled={pending || !value.trim()}>
                <Plus className="mr-1 h-4 w-4" />
                {buttonLabel}
            </Button>
        </div>
    );
}
