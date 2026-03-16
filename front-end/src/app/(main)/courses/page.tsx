import Filters from "@/components/molecules/Filters";
import SearchAndSort from "@/components/molecules/SearchAndSort";
import { CoursesCards } from "@/featuers/courses";
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
                        <SearchAndSort/>
                        <CoursesCards/>
                    </div>
                </div>
            </div>
        </div>
    )
}





