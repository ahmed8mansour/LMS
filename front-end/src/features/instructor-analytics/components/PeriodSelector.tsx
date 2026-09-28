"use client";

import { ChipToggle } from "@/components/molecules/ChipToggle";
import { PERIOD_OPTIONS } from "../types/instructorAnalytics.types";
import type { PeriodParam } from "../types/instructorAnalytics.types";

interface PeriodSelectorProps {
    value: PeriodParam;
    onChange: (next: PeriodParam) => void;
}

/**
 * The three analytics periods (FR-004), kept as this feature's own component so its
 * option set stays here and its export stays where 009's pages already import it from.
 * The chips themselves are shared with earnings (013) — see `ChipToggle`.
 */
export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
    return <ChipToggle label="Period" options={PERIOD_OPTIONS} value={value} onChange={onChange} />;
}
