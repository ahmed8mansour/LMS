import Link from "next/link";
import { Button } from "../atoms/button";
import { Github, ExternalLink } from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "../atoms/avatar";
import { FaRegStar } from "react-icons/fa";
interface CourseCardProps {
    ImageUrl: string,
    Name: string,
    About: string,
    Price: number,
    AvaterUrl: string,
    Instructor: string,
    Rate: number,
    Subscribers: number,
    Tag?: string,
}

export default function CourseCard({
    ImageUrl,
    Name,
    About,
    Price,
    AvaterUrl,
    Instructor,
    Rate,
    Subscribers,
    Tag,
}: CourseCardProps) {



    return (
        <div className="group overflow-hidden rounded-xl p-4 border border-darkbg shadow-lg transition-all duration-300 hover:-translate-y-2 bg-white cursor-pointer">
            {/* Preview Area */}
            <div className="relative h-56 bg-gradient-to-br from-primary/80 via-primary to-primary/60 p-6 rounded-2xl overflow-hidden">

                {/* Device Mockups */}
                <Image
                    src={ImageUrl}
                    alt={Name}
                    fill
                    className="object-cover w-full h-full transform transition-transform duration-300 group-hover:scale-105 rounded-2xl"
                />
                {Tag && (
                    <div className="absolute z-10 w-fit h-6 py-1 px-2 bg-white rounded-[4px] text-darkmint left-3 top-3 uppercase font-extrabold text-[10px]">
                        {Tag}
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="space-y-4 py-5">
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-darktext group-hover:text-darkmint ">{Name}</h3>
                        <p className="text-base font-bold text-darkmint">${Price}</p>
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{About}</p>
                    <div className="flex items-center justify-between pt-4">
                        <div className="flex items-center">
                            <Avatar className="w-6 h-6">
                                <AvatarImage src={AvaterUrl} alt="@shadcn" />
                                <AvatarFallback className="bg-amber-200"></AvatarFallback>
                            </Avatar>
                            <p className="text-xs font-semibold text-darktext ms-2">{Instructor}</p>
                        </div>
                        <div className="flex items-center gap-x-2">
                            <div className="text-[#F59E0B] flex items-center gap-x-1"><FaRegStar />{Rate}</div>
                            <div className="text-muted-foreground">({Subscribers})</div>
                        </div>
                    </div>
                </div>



                {/* Actions */}
                {/* <div className="flex items-center gap-2 pt-1">
                    <Button
                        asChild
                        className="flex-1 bg-darkyellow text-darkbg2 hover:bg-darkyellow/80 font-semibold cursor-pointer"
                    >
                        <Link href={LiveDemoLink || "#"} target="_blank" rel="noopener noreferrer " >
                            <ExternalLink size={20} className="text-darkbg2" />
                            Live Demo
                        </Link>
                    </Button>
                    <Button
                        asChild
                        variant="outline"
                        size="icon"
                        className="border-border dark:bg-transparent  bg-lightbg3 hover:bg-lightbg3"
                    >
                        <Link href={RepoLink} target="_blank" rel="noopener noreferrer " >
                            <Github className="h-5 w-5" />
                        </Link>
                    </Button>
                </div> */}
            </div>
        </div>
    );
};

