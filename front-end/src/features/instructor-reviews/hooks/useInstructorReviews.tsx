import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { instructorReviewsAPI } from "../api/instructorReviews.api";
import type { ReviewsQuery } from "../types/instructorReviews.types";

/**
 * One page of the feed. The same hook serves both views: with `courseId` it is the course
 * workspace's Reviews tab, without it the sidebar Reviews page (contracts §1).
 *
 * Two cache rules this feature cannot get wrong:
 *
 * 1. **No `placeholderData: keepPreviousData`.** It is the obvious choice for a paged
 *    list and it is forbidden here — FR-043 says the view must not present the previous
 *    filter's or page's rows as if they were the new result. The skeleton shows instead.
 *    Do not "fix" this.
 * 2. **`staleTime: 0`, `gcTime: 0`** (the 008/009/010 pattern). Reviews are written by
 *    students and removed by admins — from outside this app — so a feed must never be
 *    served from cache.
 */
export function useInstructorReviews({ courseId, rating, page }: ReviewsQuery) {
    return useQuery({
        queryKey: ["instructor", "reviews", { courseId, rating, page }],
        queryFn: () => instructorReviewsAPI.getReviews({ courseId, rating, page }),
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: "always",
        // A 404 (not this instructor's course) and a 403 (no instructor profile) won't
        // fix themselves on retry.
        retry: (failureCount, error) => {
            const status = isAxiosError(error) ? error.response?.status : undefined;
            if (status === 404 || status === 403) return false;
            return failureCount < 1;
        },
    });
}
