import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';



export function useStudentDashboardOverview() {
    return useQuery({
        queryKey: ['dashboard', 'student', 'overview'],
        queryFn: () => progressAPI.getStudentDashboardOverview(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}




