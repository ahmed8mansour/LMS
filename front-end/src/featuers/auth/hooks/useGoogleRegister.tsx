import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useGoogleRegister() {

    return useMutation({
        mutationFn: authAPI.googleRegister,
        onSuccess(data: any, variables, context) {
            toastsuccess('Welcome!', data.message || 'Welcome!')
        },
        onError(error: any) {
            handleAuthError(error, 'Authentication Failed')
        },
    });
}
