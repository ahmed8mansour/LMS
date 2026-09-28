import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { GoogleAuthResponse } from '../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useGoogleLogin2() {

    return useMutation({
        mutationFn: authAPI.googleLogin,
        onSuccess(data: GoogleAuthResponse, variables, context) {
            toastsuccess('Welcome!', data.message || 'Welcome!')
        },
        onError(error: AxiosError) {
            handleAuthError(error, 'Authentication Failed')
        },
    });
}
