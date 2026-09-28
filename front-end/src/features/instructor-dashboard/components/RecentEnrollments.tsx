import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";
import type { RecentEnrollment } from "../types/instructorDashboard.types";
import { formatDate, initials } from "../types/instructorDashboard.types";

interface RecentEnrollmentsProps {
    enrollments: RecentEnrollment[];
}

/**
 * The newest active enrollments across the instructor's courses (FR-009, FR-011).
 * Shows only name and avatar — the snapshot carries no contact details (FR-012).
 */
export function RecentEnrollments({ enrollments }: RecentEnrollmentsProps) {
    return (
        <section aria-labelledby="recent-enrollments-title" className="rounded-xl border border-graytext/20 bg-white p-5 shadow-sm">
            <h2 id="recent-enrollments-title" className="mb-3 text-lg font-semibold text-darktext">
                Recent enrollments
            </h2>

            {enrollments.length === 0 ? (
                <div className="rounded-lg bg-lightbg p-4">
                    <p className="font-semibold text-darktext">No enrollments yet</p>
                    <p className="text-sm text-graytext2">Students who enroll in your courses will appear here.</p>
                </div>
            ) : (
                <ul className="flex flex-col divide-y divide-graytext/15">
                    {enrollments.map((enrollment) => (
                        <li key={enrollment.id} className="flex items-center gap-3 py-3">
                            <Avatar className="size-9">
                                <AvatarImage src={enrollment.student.avatar ?? undefined} alt="" />
                                <AvatarFallback className="bg-darkmint/10 text-xs font-semibold text-darkmint">
                                    {initials(enrollment.student.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate font-semibold text-darktext" title={enrollment.student.name}>
                                    {enrollment.student.name}
                                </span>
                                <Link
                                    href={`/instructor/courses/${enrollment.course.id}`}
                                    className="truncate text-sm text-graytext2 hover:text-darkmint hover:underline"
                                    title={enrollment.course.title}
                                >
                                    {enrollment.course.title}
                                </Link>
                            </div>
                            <time dateTime={enrollment.enrolled_at} className="shrink-0 text-xs text-graytext2">
                                {formatDate(enrollment.enrolled_at)}
                            </time>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
