import { z } from 'zod';


const strongPasswordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(32, "Password is too long")
    .refine((password) => /[A-Z]/.test(password), "Must contain an uppercase letter")
    .refine((password) => /[a-z]/.test(password), "Must contain a lowercase letter")
    .refine((password) => /[0-9]/.test(password), "Must contain a number")
    .refine((password) => /[^A-Za-z0-9]/.test(password), "Must contain a special character");


export const registerSchema = z.object({
    role: z.enum(['student', 'instructor']),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    password: strongPasswordSchema,
});

export const LoginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const OTPSchema = z.object({
    otp_code: z.string().min(6, 'OTP code must be at 6 digits'),
});




export const ForgetPassSendOTPSchema = z.object({
    email: z.string().email('Invalid email address'),
});


export const ForgetPassResetSchema = z.object({
    password: strongPasswordSchema,
    confirm_password : z.string()
}).refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
});

const MAX_FILE_SIZE = 2_000_000
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'] as const

export const UserProfileSchema = z.object({
    first_name: z.string().trim().min(2, 'First name must be at least 2 characters').max(255),
    last_name: z.string().trim().min(2, 'Last name must be at least 2 characters').max(255),
    email: z.string().email({ message: 'Invalid email address' }).optional(),
    date_joined: z.string().optional(),
    profile_picture: z
    .custom<FileList>()
    .optional()
    .refine(
        (files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE,
        'Max 2MB'
    )
    .refine(
        (files) => !files || files.length === 0 || ACCEPTED_TYPES.includes(files[0].type as typeof ACCEPTED_TYPES[number]),
        'Only JPEG or PNG'
    ),

});


export const UserChangePasswordSchema = z.object({
    old_password: z.string().min(8, 'Old password must be at least 8 characters'),
    new_password: strongPasswordSchema,
    new_password_confirm: z.string(),
}).refine((data) => data.new_password === data.new_password_confirm, {
    message: "Passwords don't match",
    path: ["new_password_confirm"],
}).refine((data) => data.old_password !== data.new_password, {
    message: "New password must be different from old password",
    path: ["new_password"],
});



export type UserChangePasswordSchema = z.infer<typeof UserChangePasswordSchema>;
// Instructors additionally maintain the public bio shown on their course pages.
// Both fields are optional so an instructor can fix their name without being forced
// to write a bio first; the backend mirrors this (blank=True, about capped at 1000).
export const InstructorProfileSchema = UserProfileSchema.extend({
    title: z.string().trim().max(255, 'Headline must be 255 characters or fewer').optional(),
    about: z.string().trim().max(1000, 'Bio must be 1000 characters or fewer').optional(),
});

export type UserProfileFormData = z.infer<typeof UserProfileSchema>;
export type InstructorProfileFormData = z.infer<typeof InstructorProfileSchema>;
// The one shape the profile form and its mutation speak, whatever the caller's role.
export type ProfileFormData = UserProfileFormData & Partial<Pick<InstructorProfileFormData, 'title' | 'about'>>;
export type otpFormData = z.infer<typeof OTPSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof LoginSchema>;
export type ForgetPassSendOTPFormData = z.infer<typeof ForgetPassSendOTPSchema>;
export type ForgetPassResetFormData = z.infer<typeof ForgetPassResetSchema>;