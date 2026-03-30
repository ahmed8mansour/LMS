"use client"
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from "@/components/atoms/field"

import { RadioGroup, RadioGroupItem } from "@/components/molecules/radio-group"
import { FaLongArrowAltRight } from "react-icons/fa";
import CourseCard from "../../../components/molecules/CourseCard";
import Link from "next/link";
import HomeRadioGroup from "../../../components/molecules/HomeRadioGroup";
import { useState } from "react";
import { usePaginatedCourses } from "@/featuers/courses/hooks/usePaginatedCourses";
import CourseCardSkeleton from "../../../components/molecules/CourseCardSkeleton";

export default function CoursesSection() {
    const [selected , setSelected] = useState('all Categories')
    const {data , error, isPending } = usePaginatedCourses({'category': selected == "all Categories" ? undefined : [selected]  , 'sort' : 'popular' ,'page_size' : '3'})

    const courses =  data?.pages[0]?.results

    

    return (
        <div className="courses_section font-manrope" id="hero_section">
            <div className="container mx-auto px-4">
                <div className="filtering_area py-8 flex flex-col sm:flex-row sm:items-center gap-y-4 gap-x-4">
                    <p className="uppercase text-graylighttext font-bold text-sm leading-5 min-w-max mb-2 sm:mb-0">
                        Filter By:
                    </p>
                    <HomeRadioGroup  selected={selected} setSelected={setSelected}/>
                </div>

                <div className="courses_area ">
                    <div className="flex items-center justify-between pt-12">
                        <h1 className="text-darktext text-xl/6 md:text-2xl/8 font-extrabold">Popular Courses</h1>
                        <Link href={"/courses"}>
                            <p className="text-darkmint text-xs/4 md:text-sm/5 font-bold flex items-center gap-x-2">View all courses <FaLongArrowAltRight size={16} /> </p>
                        </Link>
                    </div>

                    <div className="cards_parent pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {courses?.map((course, idx) => (
                            <CourseCard
                                key={idx}
                                id={course.id}
                                ImageUrl={course.thumbnail}
                                Name={course.title}
                                About={course.description}
                                Price={parseInt(course.price)}
                                AvaterUrl={course.instructor_profile.profile_picture}
                                Instructor={course.instructor_profile.first_name}
                                Rate={course.rating}
                                Subscribers={course.subscribers_count}
                                Tag={course.category}
                            />
                        ))}
                    </div>
                    
                    {courses?.length === 0 && !isPending &&
                        <div className="text-darkmint font-bold">There is no courses match these filters</div>
                    }
                    {error &&
                        <div className="text-red-500 font-bold text-base">Something went wrong ,try later</div>
                    }

                    {isPending && 
                        <div className="cards_parent pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {[1,2,3].map((idx) => (
                                <CourseCardSkeleton key={idx} />
                            ))}
                        </div>
                    }

                </div>

            </div>
        </div>
    )
}


