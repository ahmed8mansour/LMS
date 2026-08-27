import { z } from 'zod';

const MAX_FILE_SIZE = 2_000_000; // 2MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const thumbnailField = z
    .custom<FileList>()
    .optional()
    .refine(
        (files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE,
        'Image must be 2MB or smaller',
    )
    .refine(
        (files) =>
            !files ||
            files.length === 0 ||
            ACCEPTED_TYPES.includes(files[0].type as (typeof ACCEPTED_TYPES)[number]),
        'Only JPEG, PNG, or WebP images',
    );

// Shared field set for create/edit. Kept as one object so the two schemas can't drift.
const courseFields = {
    title: z.string().min(1, 'Title is required').max(255, "Title can't exceed 255 characters"),
    description: z
        .string()
        .min(1, 'Description is required')
        .max(255, "Description can't exceed 255 characters"),
    // Kept as a string so the form's input and output types match (no z.coerce),
    // validated as a non-negative money value; the DecimalField accepts a numeric string.
    price: z
        .string()
        .min(1, 'Price is required')
        .refine((v) => {
            const n = Number(v);
            return Number.isFinite(n) && n >= 0 && n <= 9999.99;
        }, 'Enter a valid price between 0 and 9999.99'),
    category: z.enum(['development', 'business', 'design & UI/UX', 'marketing']),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    language: z.string().optional(),
    // Allow empty rows in the array (the UI keeps a trailing blank row); only require
    // that at least ONE goal has text. Empty rows are stripped before submit (see API).
    goals: z
        .array(z.string())
        .refine((arr) => arr.some((g) => g.trim() !== ''), 'Add at least one learning goal'),
    thumbnail: thumbnailField,
};

export const createCourseSchema = z.object(courseFields);
export const editCourseSchema = z.object(courseFields);

// One form-data shape drives both the create and edit forms.
export type CourseFormData = z.infer<typeof createCourseSchema>;
