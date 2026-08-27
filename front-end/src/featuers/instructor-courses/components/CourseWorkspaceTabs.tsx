'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Persistent tab bar for the per-course workspace. Overview is real (this spec);
// the rest are placeholders delivered by later specs.
export function CourseWorkspaceTabs({ courseId }: { courseId: number }) {
    const pathname = usePathname();
    const base = `/instructor/courses/${courseId}`;

    const tabs = [
        { label: 'Overview', href: base, exact: true },
        { label: 'Curriculum', href: `${base}/curriculum` },
        { label: 'Analytics', href: `${base}/analytics` },
        { label: 'Students', href: `${base}/students` },
        { label: 'Reviews', href: `${base}/reviews` },
    ];

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

    return (
        <nav className="flex flex-wrap gap-1 border-b border-graytext/20">
            {tabs.map((tab) => {
                const active = isActive(tab.href, tab.exact);
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                            active
                                ? 'border-darkmint text-darkmint'
                                : 'border-transparent text-graytext2 hover:text-darktext'
                        }`}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
