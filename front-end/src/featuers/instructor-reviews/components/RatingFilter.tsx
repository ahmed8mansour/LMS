"use client";

import { Star } from "lucide-react";
import { RATING_OPTIONS } from "../types/instructorReviews.types";
import type { RatingFilter as RatingFilterValue } from "../types/instructorReviews.types";

interface RatingFilterProps {
    value: RatingFilterValue;
    onChange: (next: RatingFilterValue) => void;
}

/**
 * The three filter chips: All ratings · 5 · 4 (FR-021 – FR-023).
 *
 * Rendered from RATING_OPTIONS, never a list written out here, so "exactly three options"
 * is structural: adding a fourth chip means editing the shared constant that
 * `useReviewParams` also validates against, which makes it a spec change rather than a UI
 * tweak. Ratings of 3, 2 and 1 are reachable only through "All ratings" in this version.
 *
 * Exactly one chip carries `aria-pressed={true}` at all times, so the selection is legible
 * to assistive technology and not by colour alone.
 */
export function RatingFilter({ value, onChange }: RatingFilterProps) {
    return (
        <div role="group" aria-label="Filter by rating" className="flex flex-wrap gap-1">
            {RATING_OPTIONS.map((option) => {
                const active = option.value === value;
                const isStars = option.value !== "all";

                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                                ? "border-darkmint bg-darkmint text-white"
                                : "border-graytext/25 text-graytext2 hover:text-darktext"
                        }`}
                    >
                        {/* Decorative: the label already carries the meaning, so the
                            glyph must not be announced twice. */}
                        {isStars && (
                            <Star
                                className={`h-3.5 w-3.5 ${active ? "fill-white" : "fill-graytext2/40"}`}
                                aria-hidden="true"
                            />
                        )}
                        {isStars ? `${option.label} stars` : option.label}
                    </button>
                );
            })}
        </div>
    );
}
