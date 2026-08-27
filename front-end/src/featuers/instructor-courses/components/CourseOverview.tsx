'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { InstructorCourse, statusOf } from '../types/instructorCourses.types';
import { DeleteCourseDialog } from './DeleteCourseDialog';

// Read-only summary of a course. Publish status is display-only here — the publish
// action and its readiness gate are delivered by spec 007 (FR-013).
export function CourseOverview({ course }: { course: InstructorCourse }) {
    const router = useRouter();
    const status = statusOf(course);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start gap-5 rounded-xl border border-graytext/20 bg-white p-5">
                <div className="relative flex h-28 w-44 items-center justify-center overflow-hidden rounded-lg border border-graylighttext/40 bg-lightbg">
                    {course.thumbnail ? (
                        <Image src={course.thumbnail} alt={course.title} fill className="object-cover" />
                    ) : (
                        <ImageIcon className="h-6 w-6 text-graylighttext" />
                    )}
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-darktext">{course.title}</h2>
                        <span
                            className={`rounded px-2 py-1 text-xs font-semibold ${
                                status === 'published'
                                    ? 'bg-darkmint text-white'
                                    : 'bg-lightbg text-graytext2 ring-1 ring-graytext/20'
                            }`}
                        >
                            {status === 'published' ? 'Published' : 'Draft'}
                        </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-graytext2">{course.description}</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/instructor/courses/${course.id}/edit`}>
                            <Pencil className="mr-1 h-4 w-4" /> Edit
                        </Link>
                    </Button>
                    <DeleteCourseDialog
                        course={course}
                        onDeleted={() => router.push('/instructor/courses')}
                        trigger={
                            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50 hover:text-red-600">
                                <Trash2 className="mr-1 h-4 w-4" /> Delete
                            </Button>
                        }
                    />
                </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Detail term="Category" value={course.category} />
                <Detail term="Level" value={course.level} />
                <Detail term="Price" value={`$${course.price}`} />
                <Detail term="Language" value={course.language || '—'} />
            </dl>

            {course.goals_list?.length > 0 && (
                <div className="rounded-xl border border-graytext/20 bg-white p-5">
                    <h3 className="mb-3 text-sm font-bold text-darktext">Learning goals</h3>
                    <ul className="list-inside list-disc space-y-1.5 text-sm text-graytext2">
                        {course.goals_list.map((goal, i) => (
                            <li key={i}>{goal}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function Detail({ term, value }: { term: string; value: string }) {
    return (
        <div className="rounded-lg border border-graytext/20 bg-white p-3">
            <dt className="text-xs font-medium uppercase tracking-wide text-graytext2">{term}</dt>
            <dd className="mt-1 font-semibold capitalize text-darktext">{value}</dd>
        </div>
    );
}
