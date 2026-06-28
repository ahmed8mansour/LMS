import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useLogout() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: authAPI.userLogout,
        onSuccess(data: any, variables, onMutateResult, context) {
            queryClient.clear();
            toastsuccess('Logged out successfully', data.message)
        },
        onError(error: any, variables, onMutateResult, context) {
            handleAuthError(error, 'Logging out Failed')
        },
    })
}




