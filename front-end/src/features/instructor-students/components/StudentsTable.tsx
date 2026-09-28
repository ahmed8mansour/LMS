import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/atoms/table";
import { ProgressCell } from "./ProgressCell";
import { formatEnrolledAt } from "../types/instructorStudents.types";
import type { RosterRow } from "../types/instructorStudents.types";

/** Initials for the no-picture case (FR-008). */
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function StudentCell({ row }: { row: RosterRow }) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9 shrink-0 border border-graytext/15">
                {row.avatar && <AvatarImage src={row.avatar} alt="" />}
                {/* Radix falls back automatically when the image is absent OR fails to
                    load, so a removed Cloudinary asset shows initials, not a broken icon. */}
                <AvatarFallback className="bg-darkmint/10 text-xs font-semibold text-darkmint">
                    {initials(row.name)}
                </AvatarFallback>
            </Avatar>
            {/* Long and non-Latin names truncate visibly rather than breaking the row;
                the full name stays available on hover. */}
            <span className="min-w-0 truncate font-medium text-darktext" title={row.name}>
                {row.name}
            </span>
        </div>
    );
}

interface StudentsTableProps {
    rows: RosterRow[];
    /**
     * Whether to render the Course column. Driven by the ROUTE, not by the payload —
     * `course` is always sent, the workspace tab hides it and the sidebar page shows it.
     */
    showCourse: boolean;
}

/**
 * The roster table (T021).
 *
 * Two layouts, one data set. At `md` and up it is a real `<table>`, which is what this
 * data is. Below that it becomes a list of cards, because a four-column table at 375px
 * either scrolls sideways or truncates the name into uselessness — and SC-009 forbids
 * horizontal page scroll while FR-005 requires every field to stay visible.
 */
export function StudentsTable({ rows, showCourse }: StudentsTableProps) {
    return (
        <div className="overflow-hidden rounded-xl border border-graytext/20 bg-white shadow-sm">
            {/* Desktop and up */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Student</TableHead>
                            {showCourse && <TableHead>Course</TableHead>}
                            <TableHead>Enrolled</TableHead>
                            <TableHead>Progress</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            // Keyed on the ENROLMENT id: a student in two courses produces
                            // two rows, and keying on the student would drop one of them.
                            <TableRow key={row.id}>
                                <TableCell className="max-w-[280px]">
                                    <StudentCell row={row} />
                                </TableCell>
                                {showCourse && (
                                    <TableCell className="max-w-[220px]">
                                        <span className="block truncate text-graytext" title={row.course.title}>
                                            {row.course.title}
                                        </span>
                                    </TableCell>
                                )}
                                <TableCell className="text-graytext2 tabular-nums">
                                    {formatEnrolledAt(row.enrolled_at)}
                                </TableCell>
                                <TableCell>
                                    <ProgressCell progress={row.progress} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Below md: one card per enrolment, same fields, no sideways scroll */}
            <ul className="divide-y divide-graytext/20 md:hidden">
                {rows.map((row) => (
                    <li key={row.id} className="flex flex-col gap-3 p-4">
                        <StudentCell row={row} />
                        <div className="flex flex-col gap-2 pl-12">
                            {showCourse && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-semibold tracking-wide text-graytext2 uppercase">
                                        Course
                                    </span>
                                    <span className="min-w-0 truncate text-sm text-graytext">
                                        {row.course.title}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-baseline gap-2">
                                <span className="text-xs font-semibold tracking-wide text-graytext2 uppercase">
                                    Enrolled
                                </span>
                                <span className="text-sm text-graytext2 tabular-nums">
                                    {formatEnrolledAt(row.enrolled_at)}
                                </span>
                            </div>
                            <ProgressCell progress={row.progress} />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
