"use client";
import { Button } from "@/components/atoms/button";
import { FaArrowRight } from "react-icons/fa";
import { MdOndemandVideo } from "react-icons/md";
import { IoInfiniteOutline } from "react-icons/io5";
import { FaTv } from "react-icons/fa6";
import { LiaCertificateSolid } from "react-icons/lia";
import { useParams } from "next/navigation";
import { useCreatePaymentIntent } from "../hooks/useCreatePaymentIntent";
import { useFreeEnrollment } from "../hooks/useFreeEnrollment";
import ButtonLoading from "@/components/atoms/buttonloading";
type props = {
    price: string
    totalHourse : string
}
export default function CourseEnrollCard({price , totalHourse}:props) {
    const params = useParams()
    const id = params.id

    const { mutate: DoCreatePaymentIntent, isPending: isPaymentPending } = useCreatePaymentIntent();
    const { mutate: DoFreeEnroll, isPending: isFreePending } = useFreeEnrollment();

    const isFree = parseFloat(price) === 0;
    const isPending = isPaymentPending || isFreePending;

    const handleEnroll = () => {
        if (isFree) {
            DoFreeEnroll(id as string);
        } else {
            DoCreatePaymentIntent(id as string);
        }
    }

    return (
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-1">
                    <p className="font-extrabold text-darktext text-3xl">
                        {isFree ? "Free" : `$${price}`}
                    </p>
                </div>
                <div>
                    <Button className="h-12 w-full mb-3" variant={"darkmint"} onClick={handleEnroll} disabled={isPending}>
                        {isPending ?
                            <ButtonLoading />
                            :
                            <>{isFree ? "Enroll for Free" : "Enroll Now"} <FaArrowRight /></>
                        }
                    </Button>
                </div>
                {!isFree && <p className="text-center text-graytext2 text-xs font-normal">30-Day Money-Back Guarantee</p>}
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
    )
}
