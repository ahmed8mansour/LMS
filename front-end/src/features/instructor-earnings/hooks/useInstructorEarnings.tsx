import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { instructorEarningsAPI } from "../api/instructorEarnings.api";
import type { PeriodParam } from "../types/instructorEarnings.types";

/**
 * The earnings snapshot for one period.
 *
 * Two cache rules this feature cannot get wrong:
 *
 * 1. **No `placeholderData: keepPreviousData`.** It is the obvious choice for a filter
 *    switch and it is forbidden here — FR-039 says the page must not show the previous
 *    period's figures as if they were the new result. Money that silently describes
 *    last month while the chip says this month is worse than a spinner. The skeleton
 *    shows instead. Do not "fix" this.
 * 2. **`staleTime: 0`, `gcTime: 0`** (the 008/009/010/012 pattern). Orders and refunds
 *    are written by Stripe webhooks from outside this app, so these figures must never
 *    be served from a cache.
 */
export function useInstructorEarnings(period: PeriodParam) {
    return useQuery({
        queryKey: ["instructor", "earnings", { period }],
        queryFn: () => instructorEarningsAPI.getEarnings(period),
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: "always",
        // A 403 (no instructor profile) and a 400 (a period the server rejects) will not
        // fix themselves on retry.
        retry: (failureCount, error) => {
            const status = isAxiosError(error) ? error.response?.status : undefined;
            if (status === 403 || status === 400) return false;
            return failureCount < 1;
        },
    });
}
