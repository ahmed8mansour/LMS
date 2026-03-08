import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import Cookies from 'js-cookie';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useForgetPasswordSendOTP() {
    return useMutation({
        
        mutationFn: authAPI.ForgetPasswordSendOTP,
        onSuccess(data: any, variables, onMutateResult, context) {
            Cookies.set('FG_email', variables.email, { expires: 1/96 }); // 15 min
            toastsuccess('Sending OTP is successful', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Sending OTP Failed')
        },
    })
}




