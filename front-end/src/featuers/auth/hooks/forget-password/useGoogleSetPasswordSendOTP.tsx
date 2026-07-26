import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import { ForgetPasswordSendOTPResponse } from '../../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useGoogleSetPasswordSendOTP() {
    return useMutation({
        mutationFn: authAPI.GoogleSetPasswordSendOTP,
        onSuccess(data: ForgetPasswordSendOTPResponse, variables, onMutateResult, context) {
            toastsuccess('Sending OTP is successful', data.message);
        },
        onError(error: AxiosError, variables, onMutateResult, context) {
            handleAuthError(error, 'Sending OTP Failed');
        },
    });
}
