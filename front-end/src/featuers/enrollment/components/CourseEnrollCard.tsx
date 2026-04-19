"use client";
import { Button } from "@/components/atoms/button";
import { FaArrowRight } from "react-icons/fa";
import { MdOndemandVideo } from "react-icons/md";
import { IoInfiniteOutline } from "react-icons/io5";
import { RiArticleLine } from "react-icons/ri";
import { FaTv } from "react-icons/fa6";
import { LiaCertificateSolid } from "react-icons/lia";
import { usePathname } from "next/navigation";
import { useParams } from "next/navigation";
import { useCreatePaymentIntent } from "../hooks/useCreatePaymentIntent";
import { useRouter } from "next/navigation";
import ButtonLoading from "@/components/atoms/buttonloading";
type props = {
    price: string 
    totalHourse : string
}
export default function CourseEnrollCard({price , totalHourse}:props) {
    const params = useParams()
    const router = useRouter()
    const id = params.id 

    const { mutate:DoCreatePaymentIntent, isPending , isSuccess , isError  } = useCreatePaymentIntent();

    const  CreatePayment = () => {
        DoCreatePaymentIntent(id as string,{
                onSuccess : (data)=>{
                    // Navigate to checkout page with order ID in URL
                    router.push(`/courses/checkout/${data.order.id}/`)
                }
            }
        )

    }

    return (
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-1">
                    <p className="font-extrabold text-darktext text-3xl">${price}</p>
                    <p className="font-normal text-sm text-graytext2 line-through"> $149.99 </p>
                    <p className="font-normal text-sm text-[#16A34A]"> 40% Off </p>
                </div>
                <div>
                    <Button className="h-12 w-full mb-3" variant={"darkmint"} onClick={CreatePayment} disabled={isPending}>
                        
                        {isPending ? 
                            <ButtonLoading />
                            :
                            <>Enroll Now <FaArrowRight /></>
                        }
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
    )
}
