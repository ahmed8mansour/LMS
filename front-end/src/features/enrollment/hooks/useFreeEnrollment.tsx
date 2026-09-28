import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { enrollmentAPI } from '../api/enrollment.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useFreeEnrollment() {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: enrollmentAPI.enrollFree,
        onSuccess(data) {
            toastsuccess('Successfully enrolled in this course!');
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            router.replace(`/dashboard/learn/${data.course_id}/`);
        },
        onError(error: AxiosError) {
            handleAuthError(error, 'Enrollment Failed');
        },
    });
}
