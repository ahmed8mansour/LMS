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
    first_name: z.string().min(4, 'First name must be at least 4 characters'),
    last_name: z.string().min(4, 'Last name must be at least 4 characters'),
    email: z.string().email({ message: 'Invalid email address' }).optional(),
    date_joined: z.string().optional(),
    profile_picture: z
    .custom<FileList>()
    .optional()
    .refine(
        (files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE,
        'Max 10MB'
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
export type UserProfileFormData = z.infer<typeof UserProfileSchema>;
export type otpFormData = z.infer<typeof OTPSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof LoginSchema>;
export type ForgetPassSendOTPFormData = z.infer<typeof ForgetPassSendOTPSchema>;
export type ForgetPassResetFormData = z.infer<typeof ForgetPassResetSchema>;