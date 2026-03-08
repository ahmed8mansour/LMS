import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import { removeCookies } from '@/lib/cookies'
import { VerifyOTPResponse } from '../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useRegisterVerifyOTP() {
    const setPendingEmail = useAuthStore((store) => store.setPendingEmail)
    
    return useMutation({
        mutationFn: authAPI.normalRegisterVerify,
        onSuccess(data: VerifyOTPResponse, variables, onMutateResult, context) {
            setPendingEmail(null)
            removeCookies('pending_email')
            toastsuccess('Verification Is Successful', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Verification Failed')
        },
    })
}




