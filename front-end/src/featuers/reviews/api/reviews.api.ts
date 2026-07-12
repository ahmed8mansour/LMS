import axiosInstance from "@/lib/axios";
import { ReviewableCourse, Review, SubmitReviewInput, UpdateReviewInput, CourseReviewsPage } from "../types/reviews.types";

async function getReviewableCourses(): Promise<ReviewableCourse[]> {
    const { data } = await axiosInstance.get("reviews/student/reviewable-courses/");
    return data;
}

async function submitReview(input: SubmitReviewInput): Promise<Review> {
    const { data } = await axiosInstance.post("reviews/student/reviews/", input);
    return data;
}

async function getCourseReviews(course_id: number , page : number): Promise<CourseReviewsPage> {
    const { data } = await axiosInstance.get(`reviews/course/${course_id}/?page=${page}`);
    return data;
}

async function getMyReviews(): Promise<Review[]> {
    const { data } = await axiosInstance.get("reviews/student/reviews/");
    return data;
}

async function updateReview(id: number, input: UpdateReviewInput): Promise<Review> {
    const { data } = await axiosInstance.patch(`reviews/student/reviews/${id}/`, input);
    return data;
}

async function deleteReview(id: number): Promise<void> {
    await axiosInstance.delete(`reviews/student/reviews/${id}/`);
}

export const reviewsAPI = {
    getReviewableCourses,
    submitReview,
    getCourseReviews,
    getMyReviews,
    updateReview,
    deleteReview,
};
