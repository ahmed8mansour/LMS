import { IoMdStarOutline } from "react-icons/io";
import { MdOutlinePeople } from "react-icons/md";
import { Avatar, AvatarFallback, AvatarImage} from "@/components/atoms/avatar";
import { AiOutlineGlobal } from "react-icons/ai";


// thumbnail , category , rating , sbuscribersnumber , reviews count , language  , instrctor_profile

export default function CourseHero() {
    return (
            <div className="course_hero">
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

    )
}
