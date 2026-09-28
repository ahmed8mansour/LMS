import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';

import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useLogin() {

    return useMutation({
        mutationFn: authAPI.normalLogin,
        onSuccess(data: any, variables, onMutateResult, context) {
            toastsuccess('Login is successful', data.message)
        },
        // DRF wraps serializer ValidationError messages in a list, so the login
        // error arrives as { error: ["..."] }. Typing it here types `error` for
        // every caller's onError too (LoginForm reads error.response.data.error).
        onError(error: AxiosError<{ error?: string[] }>, variables, onMutateResult, context) {
            handleAuthError(error, 'Login Failed')
        },
    })
}




