"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { normalizePeriod } from "../types/instructorAnalytics.types";
import type { PeriodParam } from "../types/instructorAnalytics.types";

/**
 * The selected period lives in the page address (clarification: it survives refresh,
 * Back/Forward and a shared link, and travels with a course drop-off bar link).
 *
 * `replace`, not `push`: clicking through three periods shouldn't leave three history
 * entries, while Back still returns to the previous page with its period intact.
 *
 * An unrecognised value falls back to 30 days silently (FR-004a) — the API is the strict
 * one. Consumers must render under <Suspense> (Next 16 requirement for useSearchParams).
 */
export function usePeriodParam(): { period: PeriodParam; setPeriod: (next: PeriodParam) => void } {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const period = normalizePeriod(searchParams.get("days"));

    const setPeriod = useCallback(
        (next: PeriodParam) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("days", next);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [pathname, router, searchParams],
    );

    return { period, setPeriod };
}
