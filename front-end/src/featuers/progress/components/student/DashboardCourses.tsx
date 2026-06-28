"use client";
import { DashboardCourseCard } from "@/components/molecules/DashboardCourseCard";
import { useStudentDashboardCourses } from "../../hooks/useStudentDashboardCourses";
import BounceLoader from "@/components/atoms/bouncing-loader";
import EmptyState from "../../../auth/components/dashboard/EmptyState";
import { Button } from "@/components/atoms/button";
import { Bell} from "lucide-react";

import { useState, useMemo } from "react";

export  function DashboardCourses() {
    const { data: courses , isLoading , isError  } = useStudentDashboardCourses();
    const [activeTab, setActiveTab] = useState<'all' | 'inProgress' | 'completed'>('all');
    
    const filteredCourses = useMemo(() => {
        if (!courses) return [];
        switch (activeTab) {
            case 'inProgress':
                return courses.filter((c) => c.progress >= 0 && c.progress < 100);
            case 'completed':
                return courses.filter((c) => c.progress === 100);
            default:
                return courses;
        }
    }, [courses, activeTab]);

    if (isError) {
        return (
        <div className="flex flex-col h-full items-center justify-center gap-3">
            <Bell className="w-12 h-12 text-red-400" />
            <p className="text-sm text-graytext2">Something went wrong</p>
            <Button variant="darkmint" onClick={() => window.location.reload()}>
                Try Again
            </Button>
        </div>
        );
    }

    if (isLoading) {
        return (
            <main className="bg-lightbg h-full p-8 flex items-center justify-center">
                <BounceLoader />
            </main>
        );
    }

    if ((courses?.length ?? 0) === 0) {
        return <EmptyState />;
    }



    
    return (
        <main className="bg-lightbg min-h-screen p-8">    
            {/* Header */}
        <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-extrabold text-darktext">My Courses</h1>
                    <span className="bg-darkmint/10 text-darkmint text-xs font-semibold px-2.5 py-1 rounded-full">
                        {courses?.length || 0} Courses
                    </span>
                </div>
                <p className="text-graytext2">Track your learning progress and continue where you left off</p>
            </div>
        </header>


            {/* Tabs */}
        <nav className="flex gap-6 mb-8 border-b border-graytext/20 pb-0">
                <button
                    className={`text-sm font-semibold pb-4 transition-colors ${activeTab === 'all' ? 'text-darkmint font-bold border-b-2 border-darkmint' : 'text-graytext2 hover:text-darkmint'}`}
                    onClick={() => setActiveTab('all')}
                >
                    All
                </button>
                <button
                    className={`text-sm font-semibold pb-4 transition-colors ${activeTab === 'inProgress' ? 'text-darkmint font-bold border-b-2 border-darkmint' : 'text-graytext2 hover:text-darkmint'}`}
                    onClick={() => setActiveTab('inProgress')}
                >
                    In Progress
                </button>
                <button
                    className={`text-sm font-semibold pb-4 transition-colors ${activeTab === 'completed' ? 'text-darkmint font-bold border-b-2 border-darkmint' : 'text-graytext2 hover:text-darkmint'}`}
                    onClick={() => setActiveTab('completed')}
                >
                    Completed
                </button>
            </nav>



        {/* Course Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            
            {filteredCourses?.map((course) => (
                <DashboardCourseCard
                    key={course.id}
                    id={course.id}
                    imageUrl={course.thumbnail}
                    title={course.title}
                    instructorAvatar={course.instructor_avatar}
                    instructor={course.instructor_firstname + " " + course.instructor_lastname}
                    progress={course.progress}
                    isCompleted={course.progress === 100}
                />
            ))}

            {filteredCourses.length === 0 && (
                <p className="text-center text-graytext2 col-span-full">No courses found for this filter !!</p>
            )}

        </div>
        </main>

    )
}
