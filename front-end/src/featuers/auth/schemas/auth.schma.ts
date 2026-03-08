import { z } from 'zod';

export const registerSchema = z.object({
    role: z.enum(['student', 'instructor']),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
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
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password : z.string().min(8, 'Password Confirm must be at least 8 characters')
}).refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
});



export type otpFormData = z.infer<typeof OTPSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type LoginFormData = z.infer<typeof LoginSchema>;
export type ForgetPassSendOTPFormData = z.infer<typeof ForgetPassSendOTPSchema>;
export type ForgetPassResetFormData = z.infer<typeof ForgetPassResetSchema>;