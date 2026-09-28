import type { AxiosError } from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';
import { toastsuccess, handleAuthError } from '@/lib/toast';

export function useMakeLectureCompleted(lectureId: string | number) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => progressAPI.makeLectureCompleted(lectureId),
        onSuccess(data, variables, onMutateResult, context) {
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            if (data.already_completed){
                toastsuccess('Lecture already marked as completed')
            }else{
                toastsuccess('Lecture marked as completed')
            }
        },
        onError(error: AxiosError, variables, onMutateResult, context) {
            handleAuthError(error, 'Failed to mark lecture as completed')
        },
    })
}
