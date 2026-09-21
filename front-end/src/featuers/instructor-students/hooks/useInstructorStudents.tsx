import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { instructorStudentsAPI } from "../api/instructorStudents.api";
import type { RosterQuery } from "../types/instructorStudents.types";

/**
 * One page of the roster. The same hook serves both views: with `courseId` it is the
 * course workspace's Students tab, without it the sidebar Students page (contracts §1).
 *
 * Two cache rules this feature cannot get wrong:
 *
 * 1. **No `placeholderData: keepPreviousData`.** It is the obvious choice for a paged
 *    table and it is forbidden here — FR-036 says the view must not present the previous
 *    page's or search term's rows as if they were the new result. The skeleton shows
 *    instead. Do not "fix" this.
 * 2. **`staleTime: 0`, `gcTime: 0`** (the 008/009 pattern). A roster must never be served
 *    from cache after an enrolment or a refund; the data changes from outside this app.
 */
export function useInstructorStudents({ courseId, search, page }: RosterQuery) {
    return useQuery({
        queryKey: ["instructor", "students", { courseId, search, page }],
        queryFn: () => instructorStudentsAPI.getStudents({ courseId, search, page }),
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
