import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from "@/components/atoms/field"
import { RadioGroup, RadioGroupItem } from "@/components/molecules/radio-group"
import { FaLongArrowAltRight } from "react-icons/fa";
import CourseCard from "../molecules/CourseCard";
// import { useState } from "react";

const courses = [
    {
        ImageUrl: "/images/home/image.png",
        Name: "React Mastery",
        About: "Learn React from scratch with hands-on projects and expert guidance.",
        Price: 49,
        AvaterUrl: "",
        Instructor: "Jane Doe",
        Rate: 4.8,
        Subscribers: 1520,
        Tag: "Best Seller",
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "UI/UX Design Bootcamp",
        About: "Master UI/UX fundamentals, wireframing, and user research techniques.",
        Price: 59,
        AvaterUrl: "",
        Instructor: "John Smith",
        Rate: 4.7,
        Subscribers: 985,
    },
    {
        ImageUrl: "/images/home/image.png",
        Name: "Python for Data Science",
        About: "A comprehensive course covering Python basics, Pandas, and machine learning.",
        Price: 65,
        AvaterUrl: "",
        Instructor: "Emily Clark",
        Rate: 4.9,
        Subscribers: 2044,
    },
]

export default function CoursesSection() {
    // const [selected, setSelected] = useState()
    // console.log(selected)

    return (
        <div className="courses_section font-manrope" id="hero_section">
            <div className="container mx-auto px-4">
                <div className="filtering_area py-8 flex flex-col sm:flex-row sm:items-center gap-y-4 gap-x-4">
                    <p className="uppercase text-graylighttext font-bold text-sm leading-5 min-w-max mb-2 sm:mb-0">
                        Filter By:
                    </p>
                    <RadioGroup
                        // value={selected}
                        // value={'All Categories'}
                        defaultValue="All Categories"
                        className="flex flex-wrap gap-2 sm:gap-x-4"
                    >
                        {[
                            'All Categories',
                            'Design',
                            'Development',
                            'Business',
                            'Markerting',
                            'Data Science',
                        ].map((element, idx) => {
                            return (
                                <FieldLabel
                                    htmlFor={element}
                                    className="h-10 rounded-4xl min-w-[130px] px-3 flex-1 sm:flex-none cursor-pointer flex items-center justify-center text-center bg-darkbg hover:bg-darkbg/45"
                                    key={idx}
                                >
                                    <Field orientation="horizontal">
                                        <FieldContent className="flex items-center justify-center">
                                            <FieldTitle className="text-xs sm:text-sm">{element}</FieldTitle>
                                        </FieldContent>
                                        <RadioGroupItem value={element} className="hidden" id={element} />
                                    </Field>
                                </FieldLabel>
                            );
                        })}
                    </RadioGroup>
                </div>

                <div className="courses_area ">
                    <div className="flex items-center justify-between pt-12">
                        <h1 className="text-darktext text-xl/6 md:text-2xl/8 font-extrabold">Popular Courses</h1>
                        <p className="text-darkmint text-xs/4 md:text-sm/5 font-bold flex items-center gap-x-2">View all courses <FaLongArrowAltRight size={16} /> </p>
                    </div>

                    <div className="cards_parent pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
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
                </div>

            </div>
        </div>
    )
}


