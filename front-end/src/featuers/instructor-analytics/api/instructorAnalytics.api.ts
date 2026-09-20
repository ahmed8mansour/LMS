import axiosInstance from "@/lib/axios";
import {
    CourseAnalyticsSchema,
    InstructorAnalyticsSchema,
} from "../schemas/instructorAnalytics.schma";
import type { CourseAnalytics, InstructorAnalytics, PeriodParam } from "../types/instructorAnalytics.types";

// Each view is one snapshot for one period (contracts §1, §2). The body is parsed, not
// cast: a payload that doesn't match the contract throws here on purpose, so the page
// shows its error state instead of rendering missing values as zeros (FR-022).

async function getCourseAnalytics(courseId: number, days: PeriodParam): Promise<CourseAnalytics> {
    const { data } = await axiosInstance.get(`/courses/instructor/courses/${courseId}/analytics/`, {
        params: { days },
    });
    return CourseAnalyticsSchema.parse(data);
}

async function getInstructorAnalytics(days: PeriodParam): Promise<InstructorAnalytics> {
    const { data } = await axiosInstance.get("/courses/instructor/analytics/", { params: { days } });
    return InstructorAnalyticsSchema.parse(data);
}

export const instructorAnalyticsAPI = {
    getCourseAnalytics,
    getInstructorAnalytics,
};
