'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import BounceLoader from '@/components/atoms/bouncing-loader';
import { useInstructorCourses } from '../hooks/useInstructorCourses';
import { InstructorCourseCard } from './InstructorCourseCard';
import { CourseStatus, statusOf } from '../types/instructorCourses.types';

type StatusFilter = 'all' | CourseStatus;

const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'published', label: 'Published' },
    { key: 'draft', label: 'Draft' },
];

// My Courses: client-side status filter + title search over the instructor's own
// courses, with loading / error / empty states in the house design language.
export function MyCoursesGrid() {
    const { data: courses, isLoading, isError, refetch } = useInstructorCourses();
    const [filter, setFilter] = useState<StatusFilter>('all');
    const [query, setQuery] = useState('');

    const visible = useMemo(() => {
        if (!courses) return [];
        const q = query.trim().toLowerCase();
        return courses.filter((c) => {
            const matchesStatus = filter === 'all' || statusOf(c) === filter;
            const matchesQuery = q === '' || c.title.toLowerCase().includes(q);
            return matchesStatus && matchesQuery;
        });
    }, [courses, filter, query]);

    if (isLoading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <BounceLoader />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-graytext/20 bg-white py-16 text-center">
                <p className="text-graytext2">We couldn’t load your courses.</p>
                <Button variant="darkmint" onClick={() => refetch()}>
                    Try again
                </Button>
            </div>
        );
    }

    // Empty catalogue (no courses at all) → focused create CTA.
    if (!courses || courses.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-graytext/30 bg-white py-20 text-center">
                <h2 className="text-lg font-bold text-darktext">Create your first course</h2>
                <p className="max-w-sm text-sm text-graytext2">
                    You haven’t created any courses yet. Start building your first one.
                </p>
                <Button asChild variant="darkmint">
                    <Link href="/instructor/courses/new">
                        <Plus className="mr-1 h-4 w-4" /> Create course
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    placeholder="Search by title…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="max-w-xs"
                />
                <div className="flex gap-2">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            onClick={() => setFilter(f.key)}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                filter === f.key
                                    ? 'border-darkmint bg-darkmint text-white'
                                    : 'border-graytext/20 text-graytext2 hover:bg-lightbg'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-graytext/30 bg-white py-16 text-center text-graytext2">
                    No courses match your filters.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((course) => (
                        <InstructorCourseCard key={course.id} course={course} />
                    ))}
                </div>
            )}
        </div>
    );
}
