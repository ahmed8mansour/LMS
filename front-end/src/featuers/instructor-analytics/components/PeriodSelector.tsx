"use client";

import { PERIOD_OPTIONS } from "../types/instructorAnalytics.types";
import type { PeriodParam } from "../types/instructorAnalytics.types";

interface PeriodSelectorProps {
    value: PeriodParam;
    onChange: (next: PeriodParam) => void;
}

/** The three periods (FR-004). The selected one is marked visually and for assistive tech. */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
    return (
        <div role="group" aria-label="Period" className="flex flex-wrap gap-1">
            {PERIOD_OPTIONS.map((option) => {
                const active = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                                ? "border-darkmint bg-darkmint text-white"
                                : "border-graytext/25 text-graytext2 hover:text-darktext"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
