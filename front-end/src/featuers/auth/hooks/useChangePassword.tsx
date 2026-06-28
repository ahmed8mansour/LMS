import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { toastsuccess, handleAuthError , toasterror } from '@/lib/toast';
import { UserChangePasswordResponse, UserChangePasswordRequest } from '../types/auth.types';
import { UserProfile } from '../types/auth.types';

export function useUserChangePassword() {

    const queryClient = useQueryClient()
    const user = queryClient.getQueryData<UserProfile>(['user', 'profile'])


    return useMutation({
        mutationFn: (data: UserChangePasswordRequest) => {
        
            if (!user?.has_usable_password) {
                return Promise.reject(new Error("You don't have a password set. Please set a password before trying to change it."))
            
            }

            return authAPI.UserChangePassword(data)
        
        },
        onSuccess(data: UserChangePasswordResponse, variables, context) {
            toastsuccess('Password Changed!', data.message || 'Password changed successfully!')
        },
        onError(error: any) {
            if (error?.message == "You don't have a password set. Please set a password before trying to change it.") {
                toasterror('Password Change Failed', error.message)
            }else {
                handleAuthError(error, 'Password Change Failed')
            }
        },
    });
}
