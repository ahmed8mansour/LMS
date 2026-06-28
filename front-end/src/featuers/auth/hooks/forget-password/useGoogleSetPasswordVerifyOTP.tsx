import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useGoogleSetPasswordVerifyOTP() {
    return useMutation({
        mutationFn: authAPI.GoogleSetPasswordVerifyOTP,
        onSuccess(data: any, variables, onMutateResult, context) {
            toastsuccess('Verification Is Successful', data.message);
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Verification Failed');
        },
    });
}
