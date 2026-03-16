import axios from '@/lib/axios';
import { Course , CourseFilterParams , PaginatedResponse } from '../types/course.types';
async function getCourse(id:string) : Promise<Course>{
    const {data} =  await axios.get(`courses/student/courses/${id}`) 
    return data;
}

async function getCourses(params1  : CourseFilterParams) : Promise<PaginatedResponse<Course>>{
    const {data} =  await axios.get(`courses/student/courses/` ,
        {
            params:params1,
            paramsSerializer : (params) => {
                const searchParams = new URLSearchParams()
                
                Object.entries(params).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        value.forEach(v => searchParams.append(key, v)) 
                    } else if (value !== undefined) {
                        searchParams.set(key, String(value))
                    }
                })
                
                return searchParams.toString()
            }
        }
    ) 
    return data;
}

// ============================
// ============================
// ============================
export const coursesAPI ={
    getCourse:getCourse,
    getCourses:getCourses
}