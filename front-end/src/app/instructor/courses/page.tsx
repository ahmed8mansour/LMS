import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { MyCoursesGrid } from '@/featuers/instructor-courses/components/MyCoursesGrid';

export default function InstructorCoursesPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-darktext">My Courses</h1>
                    <p className="text-sm text-graytext2">Drafts and published courses you own</p>
                </div>
                <Button variant={"darkmint"} asChild>
                    <Link href="/instructor/courses/new">
                        <Plus className="mr-1 h-4 w-4" /> New course
                    </Link>
                </Button>
            </div>

            <MyCoursesGrid />
        </div>
    );
}
