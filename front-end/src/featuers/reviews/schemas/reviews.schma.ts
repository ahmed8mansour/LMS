import { z } from 'zod';

export const reviewSchema = z.object({
    rating: z
        .number()
        .int()
        .min(1, 'Please select a rating')
        .max(5, 'Rating must be at most 5 stars'),
    comment: z
        .string()
        .max(2000, 'Comment must be 2000 characters or fewer')
        .optional(),
});

export type ReviewFormData = z.infer<typeof reviewSchema>;
