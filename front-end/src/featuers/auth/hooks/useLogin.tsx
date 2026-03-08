import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';

import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useLogin() {

    return useMutation({
        mutationFn: authAPI.normalLogin,
        onSuccess(data: any, variables, onMutateResult, context) {
            toastsuccess('Login is successful', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Login Failed')
        },
    })
}




