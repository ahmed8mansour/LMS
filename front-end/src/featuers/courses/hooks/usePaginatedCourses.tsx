import { skipToken, useQuery , useInfiniteQuery } from '@tanstack/react-query';
import { coursesAPI } from '../api/course.api';
import { CourseFilterParams } from '../types/course.types';

export function usePaginatedCourses(urlParams : CourseFilterParams) {
    return useInfiniteQuery({
        queryKey:['courses',urlParams],
        queryFn: ({pageParam}) =>  coursesAPI.getCourses({...urlParams , cursor: pageParam} ) ,
        initialPageParam:'',
        getNextPageParam: (lastPage) => {
            if (!lastPage.next) return null
            const cursor = new URL(lastPage.next).searchParams.get('cursor')
            return cursor
        },
        staleTime : 5 * 60 * 1000
    })
}




