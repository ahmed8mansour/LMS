"use client"
import { useEffect, useState } from 'react';

/**
 * Generic, so the debounced value keeps its type instead of widening to `any` and
 * leaking into whatever consumes it — a query key, in the roster's case (spec 010,
 * Constitution I).
 */
export default function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(()=>{



        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay);

        // open/close  >> clear the timeout
        return () => clearTimeout(handler)

    },[value , delay])

    return debouncedValue
}
