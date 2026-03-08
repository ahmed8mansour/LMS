import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { ResendOTPResponse } from '../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useRegisterResendOTP() {
    
    return useMutation({
        mutationFn: authAPI.normalRegisterResend,
        onSuccess(data: ResendOTPResponse, variables, onMutateResult, context) {
            toastsuccess('Resending OTP Is Successful', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Resending OTP Failed')
        },
    })
}




