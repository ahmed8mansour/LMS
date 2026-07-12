"use client";

import { useState } from "react";
import { IoMdStar, IoMdStarOutline } from "react-icons/io";
import { cn } from "@/lib/utils";

interface StarInputProps {
    value: number;
    onChange: (value: number) => void;
    size?: number;
    disabled?: boolean;
    className?: string;
}

export function StarInput({ value, onChange, size = 32, disabled, className }: StarInputProps) {
    const [hovered, setHovered] = useState<number | null>(null);
    const displayValue = hovered ?? value;

    return (
        <div
            className={cn("flex items-center gap-1", disabled && "opacity-50 pointer-events-none", className)}
            onMouseLeave={() => setHovered(null)}
            role="radiogroup"
            aria-label="Rate your experience"
        >
            {Array.from({ length: 5 }).map((_, index) => {
                const star = index + 1;
                const filled = star <= displayValue;
                return (
                    <button
                        key={star}
                        type="button"
                        disabled={disabled}
                        aria-checked={star === value}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        role="radio"
                        onMouseEnter={() => setHovered(star)}
                        onClick={() => onChange(star)}
                        className="cursor-pointer transition-transform active:scale-95"
                    >
                        {filled ? (
                            <IoMdStar size={size} className="text-[#FACC15]" />
                        ) : (
                            <IoMdStarOutline size={size} className="text-graytext2 hover:text-[#FACC15] transition-colors" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}
