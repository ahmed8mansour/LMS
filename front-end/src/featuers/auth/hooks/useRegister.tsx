import { useMutation } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { useAuthStore } from '@/store/auth.store';
import Cookies from 'js-cookie';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useRegister() {
    const setPendingEmail = useAuthStore((store) => store.setPendingEmail)

    return useMutation({
        mutationFn: authAPI.normalRegister,
        onSuccess(data: any, variables, onMutateResult, context) {
            const pending_email = data.user_data.email

            Cookies.set('pending_email', pending_email, { expires: 1 });
            setPendingEmail(pending_email)
            toastsuccess('Register is successful', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Register Failed')
        },
    })
}




