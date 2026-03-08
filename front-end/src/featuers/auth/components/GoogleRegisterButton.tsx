"use client"
import { Button } from "@/components/atoms/button"
import { useGoogleLogin } from '@react-oauth/google';
import { useGoogleRegister } from "../hooks/useGoogleRegister";
import { useRouter } from "next/navigation";

interface GoogleAuthButtonProps {
    role?: 'student' | 'instructor';
}

export function GoogleRegisterButton({ role = 'student' }: GoogleAuthButtonProps) {
    const { mutate: authenticateWithGoogle, isPending } = useGoogleRegister();
    const router = useRouter();

    const handleGoogleRegister = useGoogleLogin({
        flow: 'auth-code',
        redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ,
        onSuccess: async (codeResponse) => {
            authenticateWithGoogle({
                code: codeResponse.code,
                role: role,
            } , {onSuccess(data,) {
                router.push("/dashboard")
            },}
        );
        },
        onError: () => {
            console.error('Google OAuth error');
        },
    });

    return (
        <Button
            variant="outline"
            className="w-full h-11 border border-[#D5DEE1] flex items-center justify-center gap-2"
            type="button"
            onClick={() => handleGoogleRegister()}
            disabled={isPending}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="22px" height="22px">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.1 2.38 29.95 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C14.65 13.92 18.88 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.33-4.77 6.81l7.98 6.19c4.64-4.32 7.32-10.11 7.32-17.45z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.55 10.78l7.98-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.98-6.19c-2.07 1.35-4.86 2.15-7.91 2.15-5.22 0-9.64-3.52-11.23-8.5l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            <span className="text-darktext text-sm/5 font-bold">
                {isPending ? 'Loading...' : 'Sign Up With Google'}
            </span>
        </Button>
    );
}
