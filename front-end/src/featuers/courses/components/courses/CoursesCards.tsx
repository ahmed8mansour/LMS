'use client'
import { Button } from "@/components/atoms/button";
import CourseCard from "@/components/molecules/CourseCard";
import { useFilters } from "@/hooks/useFilters";
import { usePaginatedCourses } from "../../hooks/usePaginatedCourses";
import { CourseFilterParams } from "../../types/course.types";
import CourseCardSkeleton from "@/components/molecules/CourseCardSkeleton";
import { notFound } from "next/navigation";

export function CoursesCards() {
    const {searchParams} = useFilters()
    const urlParams : CourseFilterParams = {
        ...Object.fromEntries(searchParams.entries()),
        category: searchParams.getAll('category'),  
    }
    const {data  , error , isFetching , fetchNextPage , isPending , isFetchingNextPage ,  hasNextPage } = usePaginatedCourses(urlParams)
    
    const courses = data?.pages.flatMap(page => page.results) ?? []
    // first load 
    if (isPending) {
        return (
            <div className="cards_parent grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 my-8">
                {[1,2,3,4,5,6].map((idx) => (
                    <CourseCardSkeleton key={idx} />
                ))}
            </div>
        )

    }

    if (error) notFound()
    
    if (!isFetching && courses.length === 0 ) return <div className="p-3 text-darkmint font-bold">There is no courses match these filters</div>

    return (
        <>
            <div className="cards_parent grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 my-8">
                {courses.map((course, idx) => (
                    <CourseCard
                        key={idx}
                        course={course}
                    />
                ))}
            </div>

            {isFetchingNextPage && 
                <div className="cards_Skeleton grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 my-8">
                    {[1,2,3].map((course, idx) => (
                        <CourseCardSkeleton key={idx} />
                    ))}
                </div> 
            
            }


            {hasNextPage && 
                <div className="text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <Button 
                        onClick={() => fetchNextPage()}
                        disabled={isFetching || !hasNextPage}
                        variant={"outline"} className="font-bold text-base/6 text-darktext h-12 shadow-lg w-50" >
                            {isFetchingNextPage ? 
                            "loading..."
                            :
                            'Load More Courses'
                            }
                        </Button>
                    </div>
                </div>
            }

        </>
        
    )
}
