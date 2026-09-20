import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { instructorAnalyticsAPI } from "../api/instructorAnalytics.api";
import type { PeriodParam } from "../types/instructorAnalytics.types";

/**
 * One snapshot per (course, period). Always fresh, never invalidated (the 008 pattern):
 * the page depends on curriculum and enrollment changes made elsewhere, and dropping the
 * cache on unmount is cheaper than wiring this key into every mutation hook from 004–008.
 *
 * No `placeholderData` on purpose: a period change must show the skeleton rather than the
 * previous period's numbers next to the new selection (FR-020, SC-004).
 */
export function useCourseAnalytics(courseId: number, days: PeriodParam) {
    return useQuery({
        queryKey: ["instructor", "course", courseId, "analytics", days],
        queryFn: () => instructorAnalyticsAPI.getCourseAnalytics(courseId, days),
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: "always",
        // A 404 (not this instructor's course) won't fix itself on retry.
        retry: (failureCount, error) =>
            !(isAxiosError(error) && error.response?.status === 404) && failureCount < 1,
    });
}
