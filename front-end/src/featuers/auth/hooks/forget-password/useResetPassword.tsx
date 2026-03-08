import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import { removeCookies } from '@/lib/cookies'
import { ForgetPasswordVerifyOTPResponse , ForgetPasswordResetResponse } from '../../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';
import { useQueryClient } from '@tanstack/react-query';
export function useResetPassword() {
    const queryClient = useQueryClient();
    // u'll get tokens in cookies , 
    // the reset token will be cleaned
    return useMutation({
        mutationFn: authAPI.ForgetPasswordReset,
        onSuccess(data: ForgetPasswordResetResponse, variables, onMutateResult, context) {
            queryClient.setQueryData( ['user' , 'profile'], data.user_data )
            toastsuccess('Reset Is Successful', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Reset Failed')
        },
    })
}




