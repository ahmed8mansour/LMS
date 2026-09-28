import { z } from 'zod';

export const UserProfileSchema = z.object({
    first_name: z.string().min(4, 'First name must be at least 3 characters'),
    last_name: z.string().min(4, 'First name must be at least 3 characters'),
});


export type UserProfileFormData = z.infer<typeof UserProfileSchema>;
