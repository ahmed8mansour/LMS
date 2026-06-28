import { useQuery } from '@tanstack/react-query';
import { progressAPI } from '../api/progress.api';



export function useStudentDashboardCourses() {
    return useQuery({
        queryKey: ['dashboard', 'student', 'courses'],
        queryFn: () => progressAPI.getStudentDashboardCourses(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}




