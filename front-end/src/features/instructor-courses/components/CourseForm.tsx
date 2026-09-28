'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { ImageIcon } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import ButtonLoading from '@/components/atoms/buttonloading';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/atoms/select';
import { createCourseSchema, CourseFormData } from '../schemas/instructorCourses.schma';
import { GoalsListField } from './GoalsListField';

const CATEGORIES = ['development', 'business', 'design & UI/UX', 'marketing'] as const;
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

const SELECT_TRIGGER = 'h-12 w-full bg-lightbg border border-graylighttext/40 text-darktext';

interface CourseFormProps {
    mode: 'create' | 'edit';
    defaultValues?: Partial<CourseFormData>;
    /** Existing thumbnail URL (edit mode) shown as a preview when no new file is picked. */
    currentThumbnailUrl?: string | null;
    onSubmit: (data: CourseFormData) => void;
    isPending?: boolean;
}

// Shared create/edit form (React Hook Form + Zod). Follows the house form styling:
// darkmint primary action, tokenised fields, red-400 inline errors.
export function CourseForm({
    mode,
    defaultValues,
    currentThumbnailUrl,
    onSubmit,
    isPending,
}: CourseFormProps) {
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<CourseFormData>({
        resolver: zodResolver(createCourseSchema),
        defaultValues: {
            title: '',
            description: '',
            language: '',
            goals: [''],
            ...defaultValues,
        },
    });

    // Live preview of a newly picked thumbnail, falling back to the existing one (edit).
    // Driven from the file input's onChange; the effect only revokes on cleanup.
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    useEffect(() => () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }, [objectUrl]);
    const previewUrl = objectUrl ?? currentThumbnailUrl ?? null;

    const thumbnailReg = register('thumbnail');
    const onThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        thumbnailReg.onChange(e);
        const file = e.target.files?.[0];
        setObjectUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return file ? URL.createObjectURL(file) : null;
        });
    };

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex w-full max-w-3xl flex-col gap-6 rounded-xl border border-graytext/20 bg-white p-6 md:p-8"
        >
            {/* Title + Category */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" placeholder="e.g. Django for Beginners" {...register('title')} />
                    {errors.title && (
                        <span className="text-sm text-red-400">{errors.title.message}</span>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Controller
                        control={control}
                        name="category"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="category" className={SELECT_TRIGGER}>
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((c) => (
                                        <SelectItem key={c} value={c} className="capitalize">
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.category && (
                        <span className="text-sm text-red-400">{errors.category.message}</span>
                    )}
                </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                    id="description"
                    rows={4}
                    placeholder="What is this course about?"
                    className="w-full resize-none rounded-md border border-graylighttext/40 bg-lightbg px-3 py-2.5 text-sm text-darktext outline-none transition-all placeholder:text-[#94A3B8] focus:border-graylighttext"
                    {...register('description')}
                />
                {errors.description && (
                    <span className="text-sm text-red-400">{errors.description.message}</span>
                )}
            </div>

            {/* Price + Level + Language */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
                <div className="space-y-2">
                    <Label htmlFor="price">Price (USD)</Label>
                    <Input id="price" type="number" step="0.01" min="0" placeholder="0.00" {...register('price')} />
                    {errors.price && (
                        <span className="text-sm text-red-400">{errors.price.message}</span>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="level">Level</Label>
                    <Controller
                        control={control}
                        name="level"
                        render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger id="level" className={SELECT_TRIGGER}>
                                    <SelectValue placeholder="Select a level" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LEVELS.map((l) => (
                                        <SelectItem key={l} value={l} className="capitalize">
                                            {l}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.level && (
                        <span className="text-sm text-red-400">{errors.level.message}</span>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Input id="language" placeholder="e.g. English" {...register('language')} />
                </div>
            </div>

            {/* Learning goals */}
            <div className="space-y-2">
                <Label>Learning goals</Label>
                <GoalsListField control={control} />
            </div>

            {/* Thumbnail */}
            <div className="space-y-2">
                <Label htmlFor="thumbnail">Thumbnail</Label>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex h-28 w-48 items-center justify-center overflow-hidden rounded-lg border border-graylighttext/40 bg-lightbg">
                        {previewUrl ? (
                            <Image src={previewUrl} alt="Thumbnail preview" fill className="object-cover" />
                        ) : (
                            <ImageIcon className="h-6 w-6 text-graylighttext" />
                        )}
                    </div>
                    <div className="flex flex-col gap-1">
                        <Input
                            id="thumbnail"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="h-auto cursor-pointer py-2 file:mr-3 file:rounded file:border-0 file:bg-darkmint file:px-3 file:py-1 file:text-white"
                            {...thumbnailReg}
                            onChange={onThumbnailChange}
                        />
                        {mode === 'edit' && (
                            <p className="text-xs text-graytext2">Leave empty to keep the current thumbnail.</p>
                        )}
                    </div>
                </div>
                {errors.thumbnail && (
                    <span className="text-sm text-red-400">{errors.thumbnail.message as string}</span>
                )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-graytext/20 pt-5">
                <Button variant="darkmint" type="submit" disabled={isPending} className="min-w-32">
                    {isPending ? <ButtonLoading /> : mode === 'create' ? 'Save draft' : 'Save changes'}
                </Button>
            </div>
        </form>
    );
}
