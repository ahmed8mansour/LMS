import Link from "next/link";
import { RiGraduationCapFill } from "react-icons/ri";

export default function LogoWithText() {
    return (
        <Link href="/" className="flex items-center gap-2 text-darkmint text-lg leading-7 font-extrabold">
            <div className="bg-darkmint w-8 h-8 flex items-center justify-center rounded-[8px]">
                <RiGraduationCapFill color="white" size={22} />
            </div>
            LMS Platform
        </Link>
    )
}
