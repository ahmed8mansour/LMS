import ServiceItem from "../molecules/ServiceItem"
import { IoIosInfinite } from "react-icons/io";
import { LiaCertificateSolid } from "react-icons/lia";
import { FaPeopleRoof } from "react-icons/fa6";
import { Button } from "../atoms/button";



export default function ServicesSection() {
    return (
        <div className="services_section font-manrope">
            <div className="container mx-auto px-4 ">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 py-24 md:py-32 ">
                    <ServiceItem icon={<IoIosInfinite className="w-7.5 h-9" />} heading="Lifetime Access" body="Enroll once and access your courses forever. Watch anytime, anywhere on any device." />
                    <ServiceItem icon={<LiaCertificateSolid className="w-7.5 h-9" />} heading="Verified Certificates" body="Get industry-recognized certificates for every course you complete to boost your career profile." />
                    <ServiceItem icon={<FaPeopleRoof className="w-7.5 h-9" />} heading="Expert Mentors" body="Direct support from industry experts who have built world-class products and systems." />
                </div>

                <div className="rounded-[24px] bg-darkmint p-8 md:p-12 mb-20 flex items-center justify-between flex-wrap gap-y-5">
                    <div>
                        <h2 className="font-extrabold  text-2xl/8 md:text-4xl/10 text-white">Ready to upgrade your career?</h2>
                        <p className="font-normal  text-md/6 md:text-lg/7 text-white mt-2">Start learning today and join thousands of successful graduates.</p>
                    </div>
                    <div>
                        <Button className="bg-white text-darkmint hover:opacity-90 hover:bg-white shadow-lg w-full sm:w-40 lg:w-49 h-14 md:h-14.5 font-bold text-sm/5 lg:text-base/6">
                            Join for Free Now
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}



