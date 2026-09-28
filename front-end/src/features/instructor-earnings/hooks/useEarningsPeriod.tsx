"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { normalizePeriod } from "../types/instructorEarnings.types";
import type { PeriodParam } from "../types/instructorEarnings.types";

/**
 * The selected period lives in the page address (FR-015c): it survives a refresh,
 * Back/Forward, and a shared link.
 *
 * `replace`, not `push`: clicking through three chips shouldn't leave three history
 * entries, while Back still returns to the previous page with its period intact.
 *
 * An unrecognised value falls back to This month silently — the API is the strict one
 * (research R8). Consumers must render under <Suspense> (Next 16 requires it for
 * useSearchParams).
 */
export function useEarningsPeriod(): { period: PeriodParam; setPeriod: (next: PeriodParam) => void } {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const period = normalizePeriod(searchParams.get("period"));

    const setPeriod = useCallback(
        (next: PeriodParam) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("period", next);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [pathname, router, searchParams],
    );

    return { period, setPeriod };
}
