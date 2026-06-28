import { useMutation  , useQueryClient} from '@tanstack/react-query';
import { authAPI } from '../api/auth.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useUpdateProfile() {

    const queryClient = useQueryClient();


    return useMutation({
        mutationFn: authAPI.updateUserProfile,
        onSuccess(data: any, variables, context) {
            queryClient.setQueryData(['user', 'profile'], data)
            toastsuccess('Profile updated!', data.message || 'Profile updated successfully!')
        },
        onError(error: any) {
            handleAuthError(error, 'Update Failed')
        },
    });
}

