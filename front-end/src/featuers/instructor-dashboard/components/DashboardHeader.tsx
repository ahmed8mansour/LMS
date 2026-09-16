import Link from "next/link";
import { Plus } from "lucide-react";

interface DashboardHeaderProps {
    /** Instructor display name from the snapshot. */
    name: string;
}

/** Greeting plus the primary "Create course" action (FR-002). Wraps on narrow screens. */
export function DashboardHeader({ name }: DashboardHeaderProps) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
                <h1 className="text-2xl md:text-3xl font-bold text-darktext break-words">Welcome back, {name}</h1>
                <p className="text-graytext2">Here&apos;s how your courses are doing</p>
            </div>
            <Link
                href="/instructor/courses/new"
                className="inline-flex items-center gap-2 rounded-lg bg-darkmint px-5 py-3 font-semibold text-white transition-colors hover:bg-darkmint/90"
            >
                <Plus className="h-4 w-4" />
                Create course
            </Link>
        </header>
    );
}
