import { Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/atoms/accordion"
import { FaRegCirclePlay } from "react-icons/fa6";
import { MdOutlineQuiz } from "react-icons/md";
import CourseSectionItem from "@/components/molecules/CourseSectionItem";
import { Section } from "@/featuers/courses/types/course.types";
import { useMemo } from "react";
import { useCourseStats } from "@/featuers/courses/hooks/useCourseStats";
type props = {Sections : Section[] , totalLectures:number ,totalDuration:string }


export default function CourseSections({Sections , totalDuration , totalLectures} :props ) {

    return (
            <div className="course_content">
                <div className="content_heading flex flex-wrap gap-y-2 items-center justify-between mb-6">
                    <h2 className="text-darktext text-xl font-bold">Course content</h2>
                    <div className="flex items-center">
                        <p className="text-graytext2  text-xs lg:text-sm font-normal">{Sections.length} sections •</p>
                        <p className="text-graytext2  text-xs lg:text-sm font-normal">{totalLectures} lectures •</p>
                        <p className="text-graytext2  text-xs lg:text-sm font-normal">{totalDuration} total length</p>
                    </div>
                </div>
                <div className="course_sections">

                    {Sections?.map((section , index) =>{ 
                    console.log(section)    
                    return (
                        <Accordion
                        key={index}
                        type="single"
                        collapsible
                        className="rounded-lg border mb-3"
                        defaultValue="0"
                        >
                            <AccordionItem
                            key={`${index}`}
                            value={`${index}`}
                            className="border-b rounded-lg  last:border-b-0 bg-white"
                            >
                            <AccordionTrigger className="bg-darkbg px-4 border-b rounded-b-none ps-11 font-bold text-sm text-darktext min-h-14 ">
                                Section {index + 1}: {section?.title}

                                <p className="text-graytext2 text-xs font-normal">
                                    {section.lectures.length} lectures • {section.lectures.reduce((total, element) => total + parseFloat(element.duration), 0)} min
                                </p>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pt-4">
                                <div className="accordion_items flex flex-col ">
                                    {section.lectures.map((lecture , index) => (
                                        <CourseSectionItem key={index} title={lecture.title} pretitle={lecture.duration} icon={<FaRegCirclePlay className="text-darkmint w-5 h-6"/>} />
                                    ))}
                                    {section.quiz &&
                                        <CourseSectionItem title={section.quiz?.title} pretitle={`${section.quiz?.questions_count} questions`} icon={<MdOutlineQuiz className="text-darkmint w-5 h-6"/>} />
                                    }
                                </div>
                            </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    )
                
                }
                    
                    )}

                </div>

            </div>
    )
}
