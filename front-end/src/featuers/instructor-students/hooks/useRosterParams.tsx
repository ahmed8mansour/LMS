"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * The search term and page number live in the page address, so refreshing, navigating
 * Back/Forward, and opening a shared link all restore the same view (FR-020, FR-023).
 *
 * `replace`, not `push`: typing three letters must not leave three history entries, while
 * Back still returns to the previous page with its roster intact.
 *
 * Reads fall back silently — an unrecognised page is 1, a missing search is empty. The
 * API is the strict one; the address never errors (FR-024).
 *
 * Consumers must render under <Suspense> (Next 16's requirement for useSearchParams).
 */

const PAGE_PARAM = "page";
const SEARCH_PARAM = "search";

export interface RosterParams {
    search: string;
    page: number;
    setSearch: (next: string) => void;
    setPage: (next: number) => void;
}

function readPage(raw: string | null): number {
    if (raw === null) return 1;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) return 1;
    return parsed;
}

export function useRosterParams(): RosterParams {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const search = searchParams.get(SEARCH_PARAM) ?? "";
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

    const setSearch = useCallback(
        (next: string) => {
            write((params) => {
                // A parameter at its default is dropped entirely rather than written
                // empty, so a cleared search leaves a clean URL.
                if (next.trim() === "") params.delete(SEARCH_PARAM);
                else params.set(SEARCH_PARAM, next);

                // The page reset happens in THIS write, not a follow-up effect. Two
                // writes would fire a request for page 5 of a result set that may now
                // have one page — which the server bounces back to page 1, producing a
                // visible flicker for no reason (FR-018).
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

    return { search, page, setSearch, setPage };
}
