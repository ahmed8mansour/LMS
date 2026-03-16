"use client"
import { useEffect, useState } from 'react';

export default function useDebounce(value:any , delay:number) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(()=>{



        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay);

        // open/close  >> clear the timeout
        return () => clearTimeout(handler)
    
    },[value , delay])

    return debouncedValue
}
