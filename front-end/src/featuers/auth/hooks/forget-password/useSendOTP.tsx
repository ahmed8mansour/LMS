import type { AxiosError } from 'axios';
import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../../api/auth.api';
import Cookies from 'js-cookie';
import { ForgetPasswordSendOTPResponse } from '../../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useForgetPasswordSendOTP() {
    return useMutation({
        
        mutationFn: authAPI.ForgetPasswordSendOTP,
        onSuccess(data: ForgetPasswordSendOTPResponse, variables, onMutateResult, context) {
            Cookies.set('FG_email', variables.email, { expires: 1/96 }); // 15 min
            toastsuccess('Sending OTP is successful', data.message)
        },
        onError(error: AxiosError, variables, onMutateResult, context) {
            handleAuthError(error, 'Sending OTP Failed')
        },
    })
}




