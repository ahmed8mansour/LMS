import axiosInstance from '@/lib/axios';
import { StudentOverview , StudentCourses , EnrolledCourseOveview , EnrolledLectureDetail  , LectureCompletionResponse } from '../types/progress.types';

async function getStudentDashboardOverview(): Promise<StudentOverview> {
    const { data } = await axiosInstance.get('progress/student/overview/');
    
    return data;

}

async function getStudentDashboardCourses(): Promise<StudentCourses> {
    const { data } = await axiosInstance.get('progress/student/courses/');
    
    return data;

}


async function getEnrolledCourseOverview(CourseID:string|number): Promise<EnrolledCourseOveview> {
    const { data } = await axiosInstance.get(`progress/student/learn/course/${CourseID}/`);
    
    return data;

}

async function getEnrolledLectureDetail(LectureID:string|number): Promise<EnrolledLectureDetail> {
    const { data } = await axiosInstance.get(`progress/student/learn/lecture/${LectureID}/`);
    
    return data;

}

async function makeLectureCompleted(LectureID:string|number): Promise<LectureCompletionResponse> {
    const { data } = await axiosInstance.post(`progress/student/learn/lecture/markcomplete/`, { lecture_id: LectureID });
    
    return data;

}

// async function getOrderDetail(orderId: string): Promise<OrderDetails> {
//     const { data } = await axios.post('enrollment/get-order-details/', { order_id: orderId });
//     return data;
// }

export const progressAPI = {
    getStudentDashboardOverview,
    getStudentDashboardCourses,
    getEnrolledCourseOverview,
    getEnrolledLectureDetail,
    makeLectureCompleted
};
