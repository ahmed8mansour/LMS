'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ImageIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { InstructorCourse, statusOf } from '../types/instructorCourses.types';
import { DeleteCourseDialog } from './DeleteCourseDialog';

// A single owned course in the My Courses grid: thumbnail, title, status badge,
// and Edit / Manage / Delete actions. Mirrors the house DashboardCourseCard styling.
export function InstructorCourseCard({ course }: { course: InstructorCourse }) {
    const status = statusOf(course);

    return (
        <div className="group flex flex-col overflow-hidden rounded-xl border border-graytext/20 bg-white transition-shadow hover:shadow-md">
            <div className="relative h-40 w-full overflow-hidden bg-darkbg">
                {course.thumbnail ? (
                    <Image
                        src={course.thumbnail}
                        alt={course.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-7 w-7 text-graylighttext" />
                    </div>
                )}
                <span
                    className={`absolute left-3 top-3 rounded px-2 py-1 text-xs font-semibold shadow ${
                        status === 'published'
                            ? 'bg-darkmint text-white'
                            : 'bg-white text-graytext2 ring-1 ring-graytext/20'
                    }`}
                >
                    {status === 'published' ? 'Published' : 'Draft'}
                </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-5">
                <h4 className="line-clamp-1 font-bold text-darktext transition-colors group-hover:text-darkmint">
                    {course.title}
                </h4>
                <p className="line-clamp-2 text-sm text-graytext2">{course.description}</p>

                <div className="mt-auto flex items-center gap-2 pt-3">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/instructor/courses/${course.id}/edit`}>Edit</Link>
                    </Button>
                    <Button asChild variant="darkmint" size="sm">
                        <Link href={`/instructor/courses/${course.id}`}>Manage</Link>
                    </Button>
                    <DeleteCourseDialog
                        course={course}
                        trigger={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="ml-auto text-red-500 hover:bg-red-50 hover:text-red-600"
                                aria-label={`Delete ${course.title}`}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        }
                    />
                </div>
            </div>
        </div>
    );
}
