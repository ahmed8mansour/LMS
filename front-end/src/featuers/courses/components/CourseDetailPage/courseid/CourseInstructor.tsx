import { IoMdStarOutline } from "react-icons/io";
import Image from "next/image";
import { MdOutlinePerson } from "react-icons/md";
import { MdOutlineReviews } from "react-icons/md";
import { InstructorProfile } from "@/featuers/courses/types/course.types";
import { StarRating } from "@/components/atoms/StarRating";

type props = {profile : InstructorProfile}

export default function CourseInstructor( {profile} :props ) {
    const hasRating = profile.reviews_count > 0 && profile.avg_rating !== null;

    return (
            <div className="instructor_area pt-6 ">
                <h2 className="font-bold text-xl mb-6">Instructor</h2>
                <div className="flex lg:flex-row flex-col  gap-8">
                    <div className="left_side flex flex-col items-center gap-4 basis-1/3 xl:basis-1/4">
                        <div className="p-4 pt-0">
                            <Image src={profile.profile_picture} alt="instructor pic" className="shadow-lg rounded-full w-55 h-55 shrink-0" width={220}  height={220} />
                        </div>
                    </div>
                    <div className="right_side basis-2/3 xl:basis-3/4">
                        <h2 className="font-bold text-lg text-darkmint mb-1">{profile.first_name +" "+ profile.last_name}</h2>
                        <p className="font-semibold text-sm uppercase text-graytext2 mb-1">{profile.specific_data.title}</p>
                        <div className="pt-2.5 lg:pe-20">
                            <p className="text-sm/7 font-normal text-darkmint mb-3 ">{profile.specific_data.about}
                            </p>
                        </div>
                        <div className="instructor_data flex flex-wrap gap-2 text-center">
                            <div className="flex items-center gap-2">
                                {hasRating ? (
                                    <>
                                        <StarRating rating={profile.avg_rating!} size={16} />
                                        <p className="text-darktext font-bold text-sm">{profile.avg_rating} Instructor Rating</p>
                                    </>
                                ) : (
                                    <>
                                        <IoMdStarOutline className="text-darkmint"/>
                                        <p className="text-graytext2 font-bold text-sm">Not yet rated</p>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <MdOutlineReviews className="text-darkmint"/>
                                <p className="text-darktext font-bold text-sm">
                                    {hasRating ? `${profile.reviews_count.toLocaleString()} Reviews` : "0 Reviews"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <MdOutlinePerson className="text-darkmint"/>
                                <p className="text-darktext font-bold text-sm">45,820 Students</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

    )
}
