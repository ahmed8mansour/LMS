import { Button } from "@/components/atoms/button";
import { FaArrowRight } from "react-icons/fa";
import { MdOndemandVideo } from "react-icons/md";
import { IoInfiniteOutline } from "react-icons/io5";
import { RiArticleLine } from "react-icons/ri";
import { FaTv } from "react-icons/fa6";
import { LiaCertificateSolid } from "react-icons/lia";


type props = {
    price: string 
    totalHourse : string
}
export default function CourseEnrollCard({price , totalHourse}:props) {
    return (
        <div className="w-full lg:basis-5/13 xl:basis-3/13 h-fit sticky top-8 rounded-2xl bg-white border border-gray-400/40 shadow-lg p-6">
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-1">
                    <p className="font-extrabold text-darktext text-3xl">${price}</p>
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
                        {totalHourse} on-demand video
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
    )
}
