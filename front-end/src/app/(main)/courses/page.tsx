import { IoFilterSharp } from "react-icons/io5";
import { Button } from "@/components/atoms/button";
import { Checkbox } from "@/components/atoms/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, } from "@/components/atoms/field";
import { Slider } from "@/components/atoms/slider"
import { Label } from "@/components/atoms/label";
import { RadioGroup, RadioGroupItem } from "@/components/molecules/radio-group";
import CourseCard from "@/components/molecules/CourseCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/atoms/select";
import Filters from "@/components/molecules/Filters";
import InputSearchLoaderDemo from "@/components/atoms/search-loading";
import { courses } from "@/store/FakeData";
import CourseCardSkeleton from "@/components/molecules/CourseCardSkeleton";
export default function Courses() {

    return (
        <div className="courses_section min-h-screen font-manrope bg-darkbg py-8 ">
            <div className="container mx-auto px-4" >
                <div className="pb-8">
                    <h1 className="font-extrabold md:text-4xl/10 text-2xl/6">Explore Courses</h1>
                    <p className="font-normal text-lg/7 text-graylighttext mt-2">120+ premium courses available from industry experts</p>
                </div>
                <div className="courses_content flex justify-between gap-8 md:flex-nowrap flex-wrap">
                    <div className="filters w-full md:basis-5/13 xl:basis-3/13 h-fit bg-white p-6 rounded-2xl border border-[#E2E8F0]">
                        <Filters />
                    </div>
                    <div className="courses w-full md:basis-8/13 xl:basis-10/13">
                        <div className="searching bg-white p-4 rounded-2xl flex items-center justify-between gap-4 border border-[#E2E8F0] lg:flex-nowrap flex-wrap ">
                            <InputSearchLoaderDemo />
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-bold text-sm/5 text-graytext2">Sort by:</p>
                                <Select >
                                    <SelectTrigger className="xl:w-[190px] !h-12 bg-lightbg font-semibold text-sm/5 text-darktext data-[placeholder]:text-darktext data-[placeholder]:text-sm/5 data-[placeholder]:font-semibold " >
                                        <SelectValue placeholder="Most Popular" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-lightbg ">
                                        <SelectItem className="font-semibold text-sm/5 text-darktext" value="Most Popular">Most Popular</SelectItem>
                                        <SelectItem className="font-semibold text-sm/5 text-darktext" value="Newest">Newest</SelectItem>
                                        <SelectItem className="font-semibold text-sm/5 text-darktext" value="system">System</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="cards_parent grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 my-8">
                            {courses.map((course, idx) => (
                                <CourseCard
                                    key={idx}
                                    ImageUrl={course.ImageUrl}
                                    Name={course.Name}
                                    About={course.About}
                                    Price={course.Price}
                                    AvaterUrl={course.AvaterUrl}
                                    Instructor={course.Instructor}
                                    Rate={course.Rate}
                                    Subscribers={course.Subscribers}
                                    Tag={course.Tag}
                                />
                            ))}
                        </div>


                        {/* <div className="cards_Skeleton pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {courses.map((course, idx) => (
                                <CourseCardSkeleton />
                            ))}
                        </div> */}
                        <div className="text-center">
                            <div className="flex flex-col items-center justify-center gap-4">
                                <Button variant={"outline"} className="font-bold text-base/6 text-darktext h-12 shadow-lg w-50" >
                                    Load More Courses
                                </Button>
                                <p className="text-graytext2 text-sm/5">Showing 6 of 124 courses</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}





