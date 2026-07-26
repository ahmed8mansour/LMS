import type { AxiosError } from 'axios';
import { useMutation  , useQueryClient} from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { UserProfile } from '../types/auth.types';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useUpdateProfile() {

    const queryClient = useQueryClient();


    return useMutation({
        mutationFn: authAPI.updateUserProfile,
        onSuccess(data: UserProfile, variables, context) {
            queryClient.setQueryData(['user', 'profile'], data)
            toastsuccess('Profile updated!', 'Profile updated successfully!')
        },
        onError(error: AxiosError) {
            handleAuthError(error, 'Update Failed')
        },
    });
}

