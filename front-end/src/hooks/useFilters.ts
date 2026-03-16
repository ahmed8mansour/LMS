"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect , useState } from "react"
export function useFilters() {

    const router = useRouter()
    const searchParams = useSearchParams()
    const params = new URLSearchParams(searchParams.toString())
    
    const setFilter = (key: string, value: string) => {
        params.set(key, value)
        router.replace(`?${params.toString()}`, { scroll: false })
    }
    const deleteFilter = (key: string,) => {
        params.delete(key)
        router.replace(`?${params.toString()}`, { scroll: false })
    }

    const toggleFilter = (key: string, value: string) => {
        const values = params.getAll(key)

        params.delete(key)

        if (values.includes(value)) {
        values.filter(v => v !== value).forEach(v => params.append(key, v))
        } else {
        [...values, value].forEach(v => params.append(key, v))
        }

        router.replace(`?${params.toString()}`, { scroll: false })
    }

    const getFilter = (key: string) => {
        return searchParams.get(key)
    }

    const getFilters = (key: string) => {
        return searchParams.getAll(key)
    }

    const resetFilters = () => {
        router.replace("?", { scroll: false })
    }



    return {
        setFilter,
        toggleFilter,
        getFilter,
        getFilters,
        resetFilters,
        deleteFilter,
        searchParams
    }
}