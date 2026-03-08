import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import { removeCookies } from '@/lib/cookies'
import { ForgetPasswordVerifyOTPResponse } from '../../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';
export function useForgetPasswordVerifyOTP() {
    
    return useMutation({
        mutationFn: authAPI.ForgetPasswordVerifyOTP,
        onSuccess(data: ForgetPasswordVerifyOTPResponse, variables, onMutateResult, context) {
            removeCookies('FG_email')
            toastsuccess('Verification Is Successful', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Verification Failed')
        },
    })
}




