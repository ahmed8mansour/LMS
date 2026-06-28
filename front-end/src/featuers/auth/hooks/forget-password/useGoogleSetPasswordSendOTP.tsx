import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useGoogleSetPasswordSendOTP() {
    return useMutation({
        mutationFn: authAPI.GoogleSetPasswordSendOTP,
        onSuccess(data: any, variables, onMutateResult, context) {
            toastsuccess('Sending OTP is successful', data.message);
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Sending OTP Failed');
        },
    });
}
