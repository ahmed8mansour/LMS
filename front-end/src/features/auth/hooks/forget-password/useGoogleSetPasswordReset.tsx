import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import { ForgetPasswordResetResponse } from '../../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';
import { useQueryClient } from '@tanstack/react-query';

export function useGoogleSetPasswordReset() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: authAPI.GoogleSetPasswordReset,
        onSuccess(data: ForgetPasswordResetResponse, variables, onMutateResult, context) {
            queryClient.setQueryData(['user', 'profile'], data.user_data);
            toastsuccess('Password is set successfully', data.message);
        },
        onError(error: AxiosError, variables, onMutateResult, context) {
            handleAuthError(error, 'Reset Failed');
        },
    });
}
