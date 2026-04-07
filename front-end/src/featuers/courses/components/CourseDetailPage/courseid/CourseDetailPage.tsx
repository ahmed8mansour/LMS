"use client"
import CourseSections from "./CourseSections";
import CourseEnrollCard from "./CourseEnrollCard";
import CourseHero from "./CourseHero";
import CourseGoals from "./CourseGoals";
import CourseInstructor from "./CourseInstructor";
import CourseFeedback from "./CourseFeedback";

import { useCourse } from "@/featuers/courses/hooks/useCourse";
import { notFound } from "next/navigation";
import BounceLoader from "@/components/atoms/bouncing-loader";
import { IoMdStarOutline } from "react-icons/io";
import { MdOutlinePeople } from "react-icons/md";
import { Avatar, AvatarFallback, AvatarImage} from "@/components/atoms/avatar";
import { AiOutlineGlobal } from "react-icons/ai";
import { useCourseStats } from "@/featuers/courses/hooks/useCourseStats";
import { FaArrowRight } from "react-icons/fa";
import Link from "next/link";



export function CourseDetailPage({id}:{id:string}){
    
    const {data:course , isError , isLoading} = useCourse(id)
    const {totalDuration , totalLectures } = useCourseStats(course?.sections ?? [])

    if (isLoading) return (
        <div className="flex items-center justify-center flex-1">
            <BounceLoader/>
        </div>
    )
    if (isError || !course) return notFound()
        
    const last_updated  = new Date(course.last_updated)


    return (
        
        <div className="courses_section min-h-screen font-manrope bg-darkbg py-8 ">
            <div className="container mx-auto  px-4" >
                <div className="courses_content flex justify-between gap-12 lg:flex-nowrap flex-wrap">
                    <div className="w-full lg:basis-8/13 xl:basis-10/13 flex flex-col gap-10">
                        <div className="course_hero">
                            <div className="rounded-xl overflow-hidden mb-6 relative group">
                                <div className="card_wimage w-full bg-cover bg-center h-80" style={{backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.7) 100%), url(${course.thumbnail})`}} >
                                </div>   
                                <div className="absolute left-0 bottom-0 p-8 w-full">
                                    <div className="flex flex-col gap-4 justify-between">
                                        <div className="w-fit h-6 py-1 px-2 bg-darkmint rounded-lg text-white uppercase font-extrabold text-[10px]">
                                            {course.category}
                                        </div>
                                        <h1 className="font-extrabold text-2xl sm:text-4xl/12 text-white">{course.title}</h1>
                                        <div className="flex flex-wrap items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-0.5">
                                                    {Array.from({length:course.rating}).map((_, index) => ( // course.rating = 4.0 
                                                        <IoMdStarOutline
                                                            key={index}
                                                            size={24}
                                                            className={`me-.5 w-4 h-4 text-[#FACC15] `}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-white/90 font-bold text-sm ms-1">{course.rating}</span>
                                                <p className="font-normal text-sm/5 text-white/90">
                                                    ({course.reviews_count} reviews)
                                                </p>
                                            </div>
                                                            
                                            <p className="font-normal text-sm/5 text-white/90 flex items-center gap-1">
                                                <MdOutlinePeople /> {course.subscribers_count} students enrolled
                                            </p>

                                        </div>
                                    </div>
                                </div>

                            </div>
                            <div className="mt-6 flex items-center gap-3">
                                <Avatar className="w-6 h-6 me-1">
                                    <AvatarImage src={course.instructor_profile.profile_picture} alt="@shadcn" />
                                    <AvatarFallback className="bg-amber-200"></AvatarFallback>
                                </Avatar>
                                <p className="font-normal text-sm/5 text-graytext2 gap-x-1">
                                    Created by <span className="text-darktext font-bold uppercase"> {course.instructor_profile.first_name} , { course.instructor_profile.specific_data.title}</span> • Last updated {`${last_updated.getMonth()}/${last_updated.getFullYear()}`} • <span className="inline-flex items-center gap-1" > <AiOutlineGlobal/> {course.language} </span>
                                </p>
                            </div>
                        </div>
                        <CourseGoals goals={course.goals_list}/>
                        <CourseSections Sections={course.sections || []} totalDuration={totalDuration} totalLectures={totalLectures} />
                        <CourseInstructor profile={course.instructor_profile}/>
                        <CourseFeedback rating={course.rating}/>
                        
                    </div>

                    <div className="w-full lg:basis-5/13 xl:basis-3/13 h-fit sticky top-8 rounded-2xl bg-white border border-gray-400/40 shadow-lg p-6">
                        {course?.enrolled_status ? 
                            <Link href={`/dashboard/${course.id}`} className="text-darkmint flex items-center gap-1.5 ">
                                See in Dashboard <FaArrowRight/>
                            </Link>
                        :
                            <CourseEnrollCard price={course.price} totalHourse={totalDuration}/>
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}

