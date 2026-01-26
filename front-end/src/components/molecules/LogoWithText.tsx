import Link from "next/link";
import { RiGraduationCapFill } from "react-icons/ri";

export default function LogoWithText({ Text = "LMS Platform", classNameT = "", classNameI = "", IconColor = "text-white" }) {
    return (
        <Link href="/" className={`flex items-center gap-2 text-lg leading-7 font-extrabold `} >
            <div className={`bg-darkmint w-8 h-8 flex items-center justify-center rounded-[8px] ${classNameI}`}>
                <RiGraduationCapFill className={IconColor} size={22} />
            </div>
            <p className={`text-darkmint ${classNameT}`}>
                {Text}
            </p>
        </Link >
    )
}
