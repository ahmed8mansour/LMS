import { useQuery } from "@tanstack/react-query";
import { isNoInstructorProfileError } from "@/featuers/instructor-dashboard";
import { instructorAnalyticsAPI } from "../api/instructorAnalytics.api";
import type { PeriodParam } from "../types/instructorAnalytics.types";

/** The aggregate snapshot. Same freshness rules as useCourseAnalytics. */
export function useInstructorAnalytics(days: PeriodParam) {
    return useQuery({
        queryKey: ["instructor", "analytics", days],
        queryFn: () => instructorAnalyticsAPI.getInstructorAnalytics(days),
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: "always",
        // A missing instructor profile won't fix itself on retry.
        retry: (failureCount, error) => !isNoInstructorProfileError(error) && failureCount < 1,
    });
}
