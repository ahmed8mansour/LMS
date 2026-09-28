import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import { ForgetPasswordVerifyOTPResponse } from '../../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useGoogleSetPasswordVerifyOTP() {
    return useMutation({
        mutationFn: authAPI.GoogleSetPasswordVerifyOTP,
        onSuccess(data: ForgetPasswordVerifyOTPResponse, variables, onMutateResult, context) {
            toastsuccess('Verification Is Successful', data.message);
        },
        onError(error: AxiosError, variables, onMutateResult, context) {
            handleAuthError(error, 'Verification Failed');
        },
    });
}
