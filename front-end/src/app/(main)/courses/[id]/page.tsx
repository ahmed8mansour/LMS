import { IoMdStarOutline } from "react-icons/io";
import { MdOutlinePeople } from "react-icons/md";
import { Avatar, AvatarFallback, AvatarImage} from "@/components/atoms/avatar";
import { AiOutlineGlobal } from "react-icons/ai";
import { FaRegCheckCircle } from "react-icons/fa";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/atoms/accordion"
import { FaRegCirclePlay } from "react-icons/fa6";
import { MdOutlineQuiz } from "react-icons/md";
import CourseSectionItem from "@/components/molecules/CourseSectionItem";
import Image from "next/image";
import { MdOutlinePerson } from "react-icons/md";
import { MdOutlineReviews } from "react-icons/md";
import { Button } from "@/components/atoms/button";
import { FaArrowRight } from "react-icons/fa";
import { Fragment } from "react/jsx-runtime";
import { MdOndemandVideo } from "react-icons/md";
import { IoInfiniteOutline } from "react-icons/io5";
import { RiArticleLine } from "react-icons/ri";
import { FaTv } from "react-icons/fa6";
import { LiaCertificateSolid } from "react-icons/lia";

export default function page() {
    const goals = [ "Design globally distributed database clusters", "Implement advanced caching strategies using Redis", "Master horizontal vs vertical scaling trade-offs", "Architect event-driven microservices with Kafka", "Ensure 99.99% availability in production", "Optimizing SQL queries for multi-tenant SaaS" ]
    
    const Sections = [
            {
                name: "UI Design Essentials",
                lectures: [
                    { name: "Typography & Color Theory", time: "13:15" },
                    { name: "Design Grids and Layouts", time: "10:50" }
                ],
                quiz: {
                    name: "UI Basics",
                    numofquestions: 7
                }
            },
            {
                name: "UX Research & Testing",
                lectures: [
                    { name: "User Interview Techniques", time: "16:00" },
                    { name: "Usability Testing Methods", time: "12:34" }
                ],
                quiz: {
                    name: "Research Quiz",
                    numofquestions: 9
                }
            },
            {
                name: "Wireframing & Prototyping",
                lectures: [
                    { name: "Wireframing with Figma", time: "18:20" },
                    { name: "Interactive Prototyping", time: "14:05" }
                ],
                quiz: {
                    name: "Wireframes & Prototypes",
                    numofquestions: 8
                }
            }
        ]



    return (
        <div className="courses_section min-h-screen font-manrope bg-darkbg py-8 ">
            <div className="container mx-auto  px-4" >
                    <div className="courses_content flex justify-between gap-12 md:flex-nowrap flex-wrap">
                        <div className="w-full md:basis-8/13 xl:basis-10/13 flex flex-col gap-10">
                            <div className="course_thumbnail">
                                <div className="rounded-xl overflow-hidden mb-6 relative group">
                                    <div className="card_wimage w-full bg-cover bg-center h-[320px]" style={{backgroundImage: "linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.7) 100%), url('/images/home/courseid.png')"}} >
                                    </div>   
                                    <div className="absolute left-0 bottom-0 p-8 w-full">
                                        <div className="flex flex-col gap-4 justify-between">
                                            <div className="w-fit h-6 py-1 px-2 bg-darkmint rounded-[4px] text-white uppercase font-extrabold text-[10px]">
                                                Best Seller
                                            </div>
                                            <h1 className="font-extrabold text-2xl sm:text-4xl/12 text-white">Advanced Systems Design for High- Scale SaaS</h1>
                                            <div className="flex flex-wrap items-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map((num) => (
                                                            <IoMdStarOutline
                                                                key={num}
                                                                size={24}
                                                                className={`me-.5 w-4 h-4 text-[#FACC15] `}
                                                            />
                                                        ))}
                                                    </div>
                                                    <span className="text-white/90 font-bold text-sm ms-1">4.9</span>
                                                    <p className="font-normal text-sm/5 text-white/90">
                                                        (1,240 reviews)
                                                    </p>
                                                </div>
                                                
                                                <p className="font-normal text-sm/5 text-white/90 flex items-center gap-1">
                                                    <MdOutlinePeople /> 12,450 students enrolled
                                                </p>

                                            </div>
                                        </div>
                                    </div>

                                </div>
                                <div className="mt-6 flex items-center gap-3">
                                    <Avatar className="w-6 h-6 me-1">
                                        <AvatarImage src="/" alt="@shadcn" />
                                        <AvatarFallback className="bg-amber-200"></AvatarFallback>
                                    </Avatar>
                                    <p className="font-normal text-sm/5 text-graytext2 gap-x-1">
                                        Created by <span className="text-darktext font-bold">Jane Doe, Senior Architect</span> • Last updated 10/2023 • <span className="inline-flex items-center gap-1" > <AiOutlineGlobal/> English </span>
                                    </p>
                                </div>
                            </div>

                            <div className="goals_list flex flex-col p-6 sm:p-8 gap-6 bg-white rounded-2xl border border-graylighttext/40">
                                <h2 className="text-lg sm:text-xl font-bold text-darktext">What you'll learn</h2>
                                <ul className="text-body list-inside space-y-2">
                                    {goals.map((goal, index) => (
                                        <li className="flex items-start gap-2 text-xs sm:text-sm/5 font-medium" key={index + 1}>
                                            <FaRegCheckCircle className="w-4 h-4 text-darkmint flex-shrink-0 mt-0.5" />
                                            <span>{goal}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            
                            <div className="course_content">
                                <div className="content_heading flex flex-wrap gap-y-2 items-center justify-between mb-6">
                                    <h2 className="text-darktext text-xl font-bold">Course content</h2>
                                    <div className="flex items-center">
                                        <p className="text-graytext2  text-xs lg:text-sm font-normal">24 sections •</p>
                                        <p className="text-graytext2  text-xs lg:text-sm font-normal">124 lectures •</p>
                                        <p className="text-graytext2  text-xs lg:text-sm font-normal">22h 45m total length</p>
                                    </div>
                                </div>
                                <div className="course_sections">

                                    {Sections.map((section , index) => (
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
                                                Section {index + 1}: {section.name}

                                                <p className="text-graytext2 text-xs font-normal">
                                                    {section.lectures.length} lectures • {section.lectures.reduce((total, element) => total + parseInt(element.time), 0)} min
                                                </p>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-4 pt-4">
                                                <div className="accordion_items flex flex-col ">
                                                    {section.lectures.map((lecture , index) => (
                                                        <CourseSectionItem key={index} title={lecture.name} pretitle={lecture.time} icon={<FaRegCirclePlay className="text-darkmint w-5 h-6"/>} />
                                                    ))}
                                                    <CourseSectionItem title={section.quiz.name} pretitle={`${section.quiz.numofquestions} questions`} icon={<MdOutlineQuiz className="text-darkmint w-5 h-6"/>} />
                                                </div>
                                            </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    ))}

                                </div>

                            </div>
                            
                            <div className="instructor_area pt-6 ">
                                <h2 className="font-bold text-xl mb-6">Instructor</h2>
                                <div className="flex lg:flex-row flex-col  gap-8">
                                    <div className="left_side flex flex-col items-center gap-4 basis-1/3 xl:basis-1/4">
                                        <div className="p-4 pt-0">
                                            <Image src={"/images/home/doc7.png"} alt="instructor pic" className="shadow-lg rounded-full" width={128} height={128} /> 
                                        </div>
                                        <div className="instructor_data flex flex-col gap-2 text-center">
                                            <div className="flex items-center  gap-2">
                                                <IoMdStarOutline className="text-darkmint"/>
                                                <p className="text-darktext font-bold text-sm">4.9 Instructor Rating</p>
                                            </div>
                                            <div className="flex items-center  gap-2">
                                                <MdOutlineReviews  className="text-darkmint"/>
                                                <p className="text-darktext font-bold text-sm">12,450 Reviews</p>
                                            </div>
                                            <div className="flex items-center  gap-2">
                                                <MdOutlinePerson className="text-darkmint"/>
                                                <p className="text-darktext font-bold text-sm">45,820 Students</p>
                                            </div>
                                        </div>





                                    </div>
                                    <div className="right_side basis-2/3 xl:basis-3/4">
                                        <h2 className="font-bold text-lg text-darkmint mb-1">Jane Doe</h2>
                                        <p className="font-semibold text-sm uppercase text-graytext2 mb-1">Senior Architect at CloudSystems Inc.</p>
                                        <div className="pt-2.5 lg:pe-20">
                                            <p className="text-sm/7 font-normal text-darkmint mb-3 ">Jane is a veteran software architect with over 15 years of experience building
                                                scalable systems for Silicon Valley's top SaaS firms. She specializes in
                                                distributed computing, low-latency architectures, and cloud-native transitions.
                                            </p>
                                            
                                            <p className="text-sm/7 font-normal text-darkmint">
                                                Her teaching philosophy focuses on "learning by breaking"—understanding how
                                                systems fail to better understand how to build them resiliently. When she isn't
                                                designing systems, she contributes to open-source orchestration tools.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="student_feedback">
                                <h2 className="font-bold text-xl mb-6">Student feedback</h2>
                                <div className="flex lg:flex-row flex-col gap-8 p-8  items-center">
                                    <div className="flex flex-col item-center text-center gap-2 basis-1/3 xl:basis-1/4">
                                        <h2 className="font-extrabold text-6xl text-darktext">4.9</h2>
                                        <div className="flex items-center justify-center gap-.5">
                                            {[1, 2, 3, 4, 5].map((num) => (
                                                <IoMdStarOutline
                                                    key={num}
                                                    size={24}
                                                    className={`me-.5 w-4 h-4 text-[#FACC15] `}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-darkmint font-bold text-sm">Course Rating</span>
                                    </div>
                                    <div className="grid w-full grid-cols-[30px_1fr_45px] items-center gap-x-4 gap-y-3 basis-2/3 xl:basis-3/4">
                                        {["80%", "45%", "30%", "100%", "10%"].map((num , index) => (
                                            <Fragment key={index}>
                                                <span className="text-sm font-bold">{index + 1 }</span>
                                                <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[#d5dee1]">
                                                <div className="rounded-full bg-darkmint" style={{width: num}}></div>
                                                </div>
                                                <span className="text-darkmint text-sm font-bold text-right">{num}</span>
                                            </Fragment>
                                        ))}
                                    </div>
                                </div>

                            </div>
                            
                        </div>
                        <div className="w-full md:basis-5/13 xl:basis-3/13 h-fit sticky top-8 rounded-2xl bg-white border border-gray-400/40 shadow-lg p-6">
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-1">
                                    <p className="font-extrabold text-darktext text-3xl">$89.99</p>
                                    <p className="font-normal text-sm text-graytext2 line-through"> $149.99 </p>
                                    <p className="font-normal text-sm text-[#16A34A]"> 40% Off </p>
                                </div>
                                <div>
                                    <Button className="h-12 w-full mb-3" variant={"darkmint"}>
                                        Enroll Now <FaArrowRight />
                                    </Button>
                                    <Button className="h-12 w-full bg-darkbg" variant={"outline"}>
                                        Add to Cart
                                    </Button>
                                </div>
                                <p className="text-center text-graytext2 text-xs font-normal">30-Day Money-Back Guarantee</p>
                                <div className="">
                                    <h2 className="font-bold text-sm text-darktext mb-4">This course includes:</h2>
                                    <div className="flex items-center gap-2 text-graytext2 text-sm font-normal mb-2">
                                        <MdOndemandVideo className="w-4 h-4" />
                                        22.5 hours on-demand video
                                    </div>
                                    <div className="flex items-center gap-2 text-graytext2 text-sm font-normal mb-2">
                                        <RiArticleLine className="w-4 h-4" />
                                        12 articles
                                    </div>
                                    <div className="flex items-center gap-2 text-graytext2 text-sm font-normal mb-2">
                                        <IoInfiniteOutline className="w-4 h-4" />
                                        Full lifetime access
                                    </div>
                                    <div className="flex items-center gap-2 text-graytext2 text-sm font-normal mb-2">
                                        <FaTv className="w-4 h-4" />
                                        Access on mobile and TV
                                    </div>
                                    <div className="flex items-center gap-2 text-graytext2 text-sm font-normal mb-2">
                                        <LiaCertificateSolid className="w-4 h-4" />
                                        Certificate of completion
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>
            </div>
        </div>
    )
}

