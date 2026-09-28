"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import useDebounce from "@/hooks/useDebounce";

interface StudentSearchProps {
    /** The term currently in the address. */
    value: string;
    /** Writes the term to the address (and resets the page in the same write). */
    onChange: (next: string) => void;
}

/**
 * The name search box (T025).
 *
 * The input is driven by LOCAL state, not directly by the address. Reading the value back
 * from `useSearchParams` on every render would round-trip each keystroke through the
 * router and make typing feel laggy. The flow out is:
 *
 *   local state -> useDebounce(300ms) -> address -> query key
 *
 * The flow back matters too, and is easy to miss: the address can change from *outside*
 * this component — the "Clear search" action in the no-matches state, or Back/Forward.
 * When that happens the box has to follow, or it keeps showing a term that is no longer
 * being applied. `pushed` distinguishes "the address changed because we wrote it" from
 * "the address changed underneath us".
 */
export function StudentSearch({ value, onChange }: StudentSearchProps) {
    const [term, setTerm] = useState(value);
    const debounced = useDebounce(term, 300);

    // The last term this component wrote to the address.
    const pushed = useRef(value);

    // Out: push the debounced term once it settles.
    useEffect(() => {
        if (debounced === pushed.current) return;
        pushed.current = debounced;
        onChange(debounced);
        // Reacting to the debounced term only. `onChange` is a fresh closure on every
        // render of the parent, so including it would re-fire this on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debounced]);

    // In: adopt an address change we did not cause (cleared elsewhere, or Back/Forward).
    useEffect(() => {
        if (value === pushed.current) return;
        pushed.current = value;
        setTerm(value);
    }, [value]);

    const clear = () => {
        setTerm("");
        // Written immediately rather than waiting out the debounce: the intent is
        // unambiguous, so there is nothing to wait for.
        pushed.current = "";
        onChange("");
    };

    return (
        <div className="relative w-full sm:w-72">
            <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-graytext2"
                aria-hidden="true"
            />
            <input
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search by name"
                aria-label="Search students by name"
                className="h-11 w-full rounded-lg border border-graylighttext/40 bg-lightbg pr-9 pl-9 text-sm text-darktext outline-none transition-colors placeholder:text-graytext2 focus:border-darkmint"
            />
            {term !== "" && (
                <button
                    type="button"
                    onClick={clear}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-graytext2 transition-colors hover:bg-darkbg hover:text-darktext"
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
