'use client';

import Link from "next/link";
import { Menu, X, ChevronLeft } from "lucide-react";
import { useEffect } from "react";
import { UserAvater } from "@/featuers/auth";
import { useUIStore } from "@/store/ui.store";
import { LearnCourseTitle, LearnSideBar } from "@/featuers/progress";

function LayoutComponent({ children }: { children: React.ReactNode }) {
    const isSidebarOpen = useUIStore((state) => state.isLearnSideBarOpen);
    const toggleLearnSideBar = useUIStore((state) => state.toggleLearnSideBar);

useEffect(() => {
    const handleResize = () => {
    if (window.innerWidth >= 768) {
        toggleLearnSideBar(true);
    } else {
        toggleLearnSideBar(false);
    }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
}, [toggleLearnSideBar]);

const toggleSidebar = () => {
    toggleLearnSideBar(!isSidebarOpen);
}

return (
    <div className="min-h-screen bg-lightbg font-manrope">

        {/* mobile hamburger button  */}

        <button
            type="button"
            onClick={toggleSidebar}
            className={`fixed top-20 left-6 z-50 p-3 rounded-lg bg-lightbg/90 text-darktext shadow-md hover:bg-lightbg transition-all duration-200 ${isSidebarOpen ? "md:hidden" : "md:block"}`}
            aria-label={isSidebarOpen ? "Close course navigation" : "Open course navigation"}
        >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* mobile overlay  */}
        <div
            className={`fixed inset-x-0 top-16 bottom-0 bg-black/40 backdrop-blur-sm z-30 transition-opacity duration-300 md:hidden ${
                isSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
            onClick={toggleSidebar}
        />

        {/* header  */}
        <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-4 px-6 h-16 bg-lightbg border-b border-border/10 shadow-sm ">
            <Link href="/dashboard" className="flex items-center gap-2 text-darkmint hover:text-darkmint/80 transition-colors">
            <ChevronLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span className="font-label text-sm font-medium">Back to Dashboard</span>
            </Link>
            <div className="hidden md:block font-semibold text-base text-darkmint">
            <LearnCourseTitle />
            </div>
            <div className="flex items-center gap-3">
                <UserAvater/>
            </div>
        </header>

        {/* sidebar  */}
        <div className="pt-16 min-h-screen">
            <aside
                className={`
                    fixed left-0 top-16 bottom-0 z-40 flex flex-col overflow-hidden bg-lightbg
                    border-r border-border/30 shadow-lg transition-[transform,width,opacity] ease-in-out duration-300
                    ${
                    isSidebarOpen
                        ? "w-80 translate-x-0 opacity-100 pointer-events-auto"
                        : "w-80 -translate-x-full opacity-0 pointer-events-none md:w-0 md:translate-x-0 md:opacity-100"
                    }
                    
                    `}
            >

            <LearnSideBar/>

            </aside>

            <main className={`min-h-[calc(100vh-4rem)] overflow-y-auto bg-background transition-[margin] duration-300 ease-in-out lg:shadow-[-4px_0_15px_rgba(0,0,0,0.03)] relative ${isSidebarOpen ? "md:ml-80" : "md:ml-0"}`}>
            {children}
            </main>
        </div>
    
    </div>
);
}

export default LayoutComponent;
