"use client";

export interface ChipOption<T extends string> {
    value: T;
    label: string;
}

interface ChipToggleProps<T extends string> {
    /** Names the group for assistive technology, e.g. "Period". */
    label: string;
    options: readonly ChipOption<T>[];
    value: T;
    onChange: (next: T) => void;
}

/**
 * A single-select row of chips: analytics' period selector, earnings' period selector,
 * and anything later that needs the same control.
 *
 * Generic over its value so each caller keeps its own union — analytics' periods are
 * `30 | 90 | all`, earnings' are `month | year | all`, and neither has to widen to a
 * bare string to share the markup (research R11).
 *
 * `role="group"` and `aria-pressed` are not decoration: they are how the selected chip
 * is announced. Marking selection by colour alone would leave the current period
 * unreadable to a screen reader.
 */
export function ChipToggle<T extends string>({ label, options, value, onChange }: ChipToggleProps<T>) {
    return (
        <div role="group" aria-label={label} className="flex flex-wrap gap-1">
            {options.map((option) => {
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
