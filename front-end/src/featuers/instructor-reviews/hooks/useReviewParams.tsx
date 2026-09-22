"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { parseRatingFilter } from "../types/instructorReviews.types";
import type { RatingFilter } from "../types/instructorReviews.types";

/**
 * The star filter and page number live in the page address, so refreshing, navigating
 * Back/Forward, and opening a shared link all restore the same view (FR-027, FR-030).
 *
 * `replace`, not `push`: clicking through three chips must not leave three history
 * entries, while Back still returns to the previous page with its feed intact.
 *
 * Reads fall back silently — an unrecognised page is 1, an unrecognised rating is "all".
 * The API is the strict one; the address never errors (FR-027, FR-031).
 *
 * Consumers must render under <Suspense> (Next 16's requirement for useSearchParams).
 */

const PAGE_PARAM = "page";
const RATING_PARAM = "rating";

export interface ReviewParams {
    rating: RatingFilter;
    page: number;
    setRating: (next: RatingFilter) => void;
    setPage: (next: number) => void;
}

function readPage(raw: string | null): number {
    if (raw === null) return 1;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) return 1;
    return parsed;
}

export function useReviewParams(): ReviewParams {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    // Validated against RATING_OPTIONS rather than a second hand-written list, so the
    // address and the chips can never disagree about what the three options are.
    const rating = parseRatingFilter(searchParams.get(RATING_PARAM));
    const page = readPage(searchParams.get(PAGE_PARAM));

    const write = useCallback(
        (mutate: (params: URLSearchParams) => void) => {
            const params = new URLSearchParams(searchParams.toString());
            mutate(params);
            const query = params.toString();
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        },
        [pathname, router, searchParams],
    );

    const setRating = useCallback(
        (next: RatingFilter) => {
            write((params) => {
                // A parameter at its default is dropped entirely rather than written
                // explicitly, so clearing the filter leaves a clean URL.
                if (next === "all") params.delete(RATING_PARAM);
                else params.set(RATING_PARAM, next);

                // The page reset happens in THIS write, not a follow-up effect. Two
                // writes would fire a request for page 5 of a result set that may now
                // have one page — which the server bounces back to page 1, producing a
                // visible flicker for no reason (FR-025).
                params.delete(PAGE_PARAM);
            });
        },
        [write],
    );

    const setPage = useCallback(
        (next: number) => {
            write((params) => {
                if (next <= 1) params.delete(PAGE_PARAM);
                else params.set(PAGE_PARAM, String(next));
            });
        },
        [write],
    );

    return { rating, page, setRating, setPage };
}
