import { skipToken, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { coursesAPI } from '../api/course.api';
import { Course } from '../types/course.types';

export function useCourse(id:string) {
    const queryClient = useQueryClient()

    return useQuery({
        queryKey:['course',id],
        queryFn: id ? () => coursesAPI.getCourse(id) : skipToken,
        initialData : () => { 
            const cachedCourses = queryClient.getQueriesData<any>({
                queryKey : ['courses']
            })
            for (const [, data] of cachedCourses) {
                if (!data?.pages) continue // يعني تجاهل لو ما في pages 
                for (const page of data.pages) {
                    const course = page.results.find((c: Course) => c.id === Number(id))
                    if (course) return course
                }
            }

        },
        staleTime : 5 * 60 * 1000
    })
}




