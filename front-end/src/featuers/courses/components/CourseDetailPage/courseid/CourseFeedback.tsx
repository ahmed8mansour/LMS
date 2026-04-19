import { IoMdStarOutline } from "react-icons/io";
import { Fragment } from "react/jsx-runtime";

export default function CourseFeedback({rating} : {rating : number}) {
    return (
        <div className="student_feedback">
            <h2 className="font-bold text-xl mb-6">Student feedback</h2>
            <div className="flex lg:flex-row flex-col gap-8 p-8  items-center">
                <div className="flex flex-col item-center text-center gap-2 basis-1/3 xl:basis-1/4">
                    <h2 className="font-extrabold text-6xl text-darktext">{rating}</h2>
                    <div className="flex items-center justify-center gap-.5">
                        {Array.from({length:rating}).map((num , index) => (
                            <IoMdStarOutline
                                key={index}
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
    )
}
