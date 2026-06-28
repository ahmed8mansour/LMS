"use client";

import { Button } from "@/components/atoms/button";
import { BookOpen, Clock, CheckCircle, PlayCircle, Trophy, ArrowRight, Bell,} from "lucide-react";
import Image from "next/image";
import { useStudentDashboardOverview } from "../../hooks/useStudentDashboardOverview";
import BounceLoader from "@/components/atoms/bouncing-loader";
import Link from "next/link";
import { DashboardCourseCard } from "@/components/molecules/DashboardCourseCard";
import EmptyState from "../../../auth/components/dashboard/EmptyState";


interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    iconBg?: string;
}


function StatCard({ title, value, icon, iconBg = "bg-darkmint/10" }: StatCardProps) {
    return (
        <div className="bg-white p-6 rounded-xl border border-graytext/20 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
            <div>
                <p className="text-sm text-graytext2 font-medium mb-1">{title}</p>
                <p className="text-2xl font-bold text-darktext">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center text-darkmint`}>
                {icon}
            </div>
        </div>
    );
}

interface CourseCardProps {
    id: string;
    imageUrl: string;
    title: string;
    instructor: string;
    progress: number;
    isCompleted?: boolean;
}





export function DashboardPage() {
    const { isError, isLoading, data } = useStudentDashboardOverview();

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

    const stats = data?.stats || { completed_courses: 0, inprogress_courses: 0, total_mins_spent: 0 };
    const courses = data?.courses || [];

    const { totalLecturesCompleted } = courses.reduce(
        (acc, c) => ({
            totalLecturesCompleted: acc.totalLecturesCompleted + c.lectures_completed,
        }),
        { totalLecturesCompleted: 0 }
    );

    const overallProgressPercent = courses.length > 0
        ? Math.round(stats.completed_courses / courses.length * 100)
        : 0;

    const statCards = [
        {
            title: "Total Enrolled",
            value: courses.length,
            icon: <BookOpen size={20} />,
            iconBg: "bg-darkmint/10",
        },
        {
            title: "In Progress",
            value: stats.inprogress_courses,
            icon: <Clock size={20} />,
            iconBg: "bg-darkmint/10",
        },
        {
            title: "Completed",
            value: stats.completed_courses,
            icon: <CheckCircle size={20} />,
            iconBg: "bg-darkmint/10",
        },
    ];

    if (courses.length === 0) {
        return <EmptyState />;
    }

    return (
        <main className="bg-lightbg min-h-screen p-8">
            {/* Header */}
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-darktext mb-1">
                        Welcome back <span className="text-2xl">👋</span>
                    </h2>
                    <p className="text-graytext2">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </header>

            {/* Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {statCards.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}

                {/* Overall Progress Card */}
                <div className="bg-white p-6 rounded-xl border border-graytext/20 shadow-sm flex items-center gap-4">
                    <div className="relative w-16 h-16">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-graytext/20"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeDasharray="100, 100"
                                strokeWidth="3"
                            />
                            <path
                                className="text-darkmint"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="currentColor"
                                strokeDasharray={`${overallProgressPercent}, 100`}
                                strokeLinecap="round"
                                strokeWidth="3"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-darktext">{overallProgressPercent}%</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-graytext2 mb-1">Overall Progress</p>
                        <p className="text-sm font-medium text-darktext">{overallProgressPercent >= 75 ? "Excellent!" : overallProgressPercent >= 50 ? "Good job!" : "Keep going!"}</p>
                    </div>
                </div>
            </section>

            {/* Continue Learning Banner */}
            {courses.length > 0 && (
                <section className="mb-8 relative overflow-hidden rounded-xl bg-white border border-graytext/20">
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={courses[0].thumbnail}
                            alt="Course banner"
                            width={1200}
                            height={400}
                            className="w-full h-full object-cover opacity-10"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-lightbg via-lightbg/90 to-transparent" />
                    </div>
                    <div className="relative z-10 p-8 flex flex-col md:flex-row items-center gap-8">
                        <div className="w-full md:w-1/3 aspect-video rounded-lg overflow-hidden shadow-md flex-shrink-0">
                            <Image
                                src={courses[0].thumbnail}
                                alt="Course thumbnail"
                                width={400}
                                height={225}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <span className="inline-block px-3 py-1 bg-darkmint/10 text-darkmint text-xs font-semibold rounded-full mb-3">
                                {courses[0].progress === 100 ? "Completed" : "Up Next"}
                            </span>
                            <h3 className="text-2xl font-bold text-darktext mb-2">{courses[0].title}</h3>
                            <p className="text-graytext2 text-sm mb-4">
                                {courses[0].instructor_firstname} {courses[0].instructor_lastname} • {courses[0].category}
                            </p>
                            <div className="w-full bg-graytext/20 rounded-full h-2 mb-2">
                                <div className="bg-darkmint h-2 rounded-full" style={{ width: `${courses[0].progress}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-graytext2 mb-6">
                                <span>{courses[0].progress}% Completed</span>
                                <span>{courses[0].progress === 100 ? "Completed" : "Keep going!"}</span>
                            </div>
                            <Button variant="darkmint" size="lg" className="gap-2">
                                {courses[0].progress === 100 ? "Review Course" : "Resume Learning"}
                                <ArrowRight size={16} />
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            {/* Recent Courses */}
            <section className="mb-10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-darktext">My Recent Courses</h3>
                    <Button variant="ghost" className="text-darkmint hover:bg-darkmint/10">
                        View All
                    </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => (
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
                </div>
            </section>

            {/* Learning Activity */}
            <section className="border-t border-graytext/20 pt-8 pb-4">
                <h3 className="text-lg font-bold text-darktext mb-4">Learning Activity</h3>
                <div className="flex flex-wrap gap-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-darkmint/10 flex items-center justify-center text-darkmint">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-graytext2">Total hours learned</p>
                            <p className="font-bold text-darktext">{Math.floor(stats.total_mins_spent / 60)}h {parseInt(stats.total_mins_spent % 60 as any)}m</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-darkmint/10 flex items-center justify-center text-darkmint">
                            <PlayCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-graytext2">Lectures completed</p>
                            <p className="font-bold text-darktext">{totalLecturesCompleted}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-darkmint/10 flex items-center justify-center text-darkmint">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-graytext2">Courses completed</p>
                            <p className="font-bold text-darktext">{stats.completed_courses}</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
