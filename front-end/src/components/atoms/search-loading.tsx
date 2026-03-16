'use client'

import { useEffect, useId, useState } from 'react'

import { LoaderCircleIcon, SearchIcon } from 'lucide-react'

import { Input } from './input'
import { Label } from './label'
import { useFilters } from '@/hooks/useFilters'
import { useRouter } from 'next/navigation'

const InputSearchLoaderDemo = () => {
    const {searchParams , setFilter  , deleteFilter}= useFilters()
    const router = useRouter()

    const [isLoading, setIsLoading] = useState(false)
    const [searchValue, setsearchValue] = useState(searchParams.get('search') ?? '');

    const id = useId()


    useEffect(()=>{
        const timer = setTimeout(() => {
            const params  = new URLSearchParams(searchParams.toString())
            if (searchValue) setFilter('search',searchValue)
            else deleteFilter('search')
            setIsLoading(false)
            
            
        }, 1000);

        setIsLoading(true)

        return () =>  {

            clearTimeout(timer)
            setIsLoading(false)
        }
    },[searchValue ])

    return (
        <div className='w-full xl:max-w-2/3 lg:max-w-4/7 space-y-2'>
            <div className='relative'>
                <div className='text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50'>
                    <SearchIcon className='size-4' />
                    <span className='sr-only'>Search</span>
                </div>
                <Input
                    id={id}
                    type='search'
                    placeholder='Search for courses, skills, or instructors...'
                    value={searchValue}
                    onChange={e => setsearchValue(e.target.value)}
                    className='peer bg-lightbg px-9 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none'
                />
                {isLoading && (
                    <div className='text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3 peer-disabled:opacity-50'>
                        <LoaderCircleIcon className='size-4 animate-spin' />
                        <span className='sr-only'>Loading...</span>
                    </div>
                )}
            </div>
        </div>
    )
}

export default InputSearchLoaderDemo