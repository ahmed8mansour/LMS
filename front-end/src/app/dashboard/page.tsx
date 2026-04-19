"use client";

import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";
import { BookOpen, Clock, CheckCircle, PlayCircle, Trophy, ArrowRight, Bell } from "lucide-react";
import Image from "next/image";

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
    id: number;
    imageUrl: string;
    title: string;
    instructor: string;
    progress: number;
    isCompleted?: boolean;
}

function DashboardCourseCard({ id, imageUrl, title, instructor, progress, isCompleted = false }: CourseCardProps) {
    return (
        <div className="bg-white rounded-xl border border-graytext/20 overflow-hidden hover:shadow-md transition-shadow group">
            <div className="h-40 overflow-hidden relative">
                <Image
                    src={imageUrl}
                    alt={title}
                    width={400}
                    height={160}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {isCompleted && (
                    <div className="absolute top-2 right-2 bg-darkmint text-white px-2 py-1 rounded text-xs font-semibold shadow flex items-center gap-1">
                        <CheckCircle size={12} />
                        Done
                    </div>
                )}
            </div>
            <div className="p-5">
                <h4 className="font-bold text-darktext mb-1 line-clamp-1 group-hover:text-darkmint transition-colors">{title}</h4>
                <p className="text-sm text-graytext2 mb-4 line-clamp-1">{instructor}</p>
                <div className="w-full bg-graytext/20 rounded-full h-1.5 mb-2">
                    <div
                        className="bg-darkmint h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="flex justify-between items-center mt-4">
                    <span className="text-xs font-semibold text-darktext">{progress}%</span>
                    <Button variant="ghost" size="sm" className="text-darkmint hover:bg-darkmint/10">
                        {isCompleted ? "Review" : "Continue"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const stats = [
        { title: "Total Enrolled", value: 12, icon: <BookOpen size={20} /> },
        { title: "In Progress", value: 4, icon: <Clock size={20} /> },
        { title: "Completed", value: 8, icon: <CheckCircle size={20} /> },
    ];

    const courses = [
        { id: 1, imageUrl: "https://picsum.photos/seed/react/400/160", title: "React for Beginners", instructor: "Sarah Drasner", progress: 85 },
        { id: 2, imageUrl: "https://picsum.photos/seed/data/400/160", title: "Data Science Foundations", instructor: "Dr. Andrew Ng", progress: 32 },
        { id: 3, imageUrl: "https://picsum.photos/seed/design/400/160", title: "Typography in Web Design", instructor: "Jessica Hische", progress: 100, isCompleted: true },
    ];

    return (
        <main className="bg-lightbg min-h-screen">
            {/* Header */}
            <header className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-darktext mb-1">
                        Welcome back, Alex <span className="text-2xl">👋</span>
                    </h2>
                    <p className="text-graytext2">Monday, October 24, 2023</p>
                </div>

            </header>

            {/* Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {stats.map((stat, index) => (
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
                                strokeDasharray="75, 100"
                                strokeLinecap="round"
                                strokeWidth="3"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-sm font-bold text-darktext">75%</span>
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-graytext2 mb-1">Overall Progress</p>
                        <p className="text-sm font-medium text-darktext">Great job!</p>
                    </div>
                </div>
            </section>

            {/* Continue Learning Banner */}
            <section className="mb-8 relative overflow-hidden rounded-xl bg-white border border-graytext/20">
                <div className="absolute inset-0 z-0">
                    <Image
                        src="https://picsum.photos/seed/banner/1200/400"
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
                            src="https://picsum.photos/seed/course/400/225"
                            alt="Course thumbnail"
                            width={400}
                            height={225}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex-1">
                        <span className="inline-block px-3 py-1 bg-darkmint/10 text-darkmint text-xs font-semibold rounded-full mb-3">
                            Up Next
                        </span>
                        <h3 className="text-2xl font-bold text-darktext mb-2">Advanced UI Design Systems</h3>
                        <p className="text-graytext2 text-sm mb-4">Module 4: Tokens & Components • Video 3/8</p>
                        <div className="w-full bg-graytext/20 rounded-full h-2 mb-2">
                            <div className="bg-darkmint h-2 rounded-full" style={{ width: "60%" }} />
                        </div>
                        <div className="flex justify-between text-xs text-graytext2 mb-6">
                            <span>60% Completed</span>
                            <span>45 mins left</span>
                        </div>
                        <Button variant="darkmint" size="lg" className="gap-2">
                            Resume Learning
                            <ArrowRight size={16} />
                        </Button>
                    </div>
                </div>
            </section>

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
                        <DashboardCourseCard key={course.id} {...course} />
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
                            <p className="font-bold text-darktext">124h 30m</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-darkmint/10 flex items-center justify-center text-darkmint">
                            <PlayCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-graytext2">Lectures completed</p>
                            <p className="font-bold text-darktext">342</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-darkmint/10 flex items-center justify-center text-darkmint">
                            <Trophy size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-graytext2">Quizzes passed</p>
                            <p className="font-bold text-darktext">48</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
