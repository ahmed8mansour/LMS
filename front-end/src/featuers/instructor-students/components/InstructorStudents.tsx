"use client";

import { useQuery } from "@tanstack/react-query";
import { NoInstructorProfileState, isNoInstructorProfileError } from "@/featuers/instructor-dashboard";
import { instructorCoursesAPI } from "@/featuers/instructor-courses";
import { RosterPagination } from "@/components/molecules/RosterPagination";
import { useInstructorStudents } from "../hooks/useInstructorStudents";
import { useRosterParams } from "../hooks/useRosterParams";
import { ROSTER_PAGE_SIZE } from "../types/instructorStudents.types";
import { RosterEmpty, RosterError, RosterSkeleton } from "./RosterStates";
import { StudentSearch } from "./StudentSearch";
import { StudentsTable } from "./StudentsTable";

/**
 * The sidebar Students page: every enrolment across every owned course (FR-026 – FR-029).
 *
 * Mirrors CourseStudents with three differences: no `courseId`, the Course column on, and
 * two empty states instead of one.
 */
export function InstructorStudents() {
    const { search, page, setSearch, setPage } = useRosterParams();
    const query = useInstructorStudents({ search, page });

    const count = query.data?.count ?? 0;
    const searching = search.trim() !== "";

    // FR-029 needs "you own no courses" told apart from "your courses have no students
    // yet", and an empty roster cannot distinguish them — both are count: 0. The course
    // list answers it, but only in that one case, so the query is gated rather than run
    // on every visit. The key matches useInstructorCourses (spec 004), so a visit to My
    // Courses makes this free.
    const coursesQuery = useQuery({
        queryKey: ["instructor", "courses"],
        queryFn: instructorCoursesAPI.list,
        enabled: !!query.data && count === 0 && !searching,
    });
    const ownsNoCourses = coursesQuery.data?.length === 0;

    if (isNoInstructorProfileError(query.error)) {
        return <NoInstructorProfileState />;
    }

    return (
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-darktext">Students</h1>
                    <p className="text-sm text-graytext2">
                        {query.data
                            ? count === 1
                                ? "1 enrolment across your courses"
                                : `${count.toLocaleString("en-US")} enrolments across your courses`
                            : "Across all your courses"}
                    </p>
                </div>
                <StudentSearch value={search} onChange={setSearch} />
            </div>

            {query.isPending ? (
                <RosterSkeleton />
            ) : query.isError || !query.data ? (
                <RosterError onRetry={() => void query.refetch()} />
            ) : count === 0 ? (
                searching ? (
                    <RosterEmpty variant="no-matches" term={search} onClearSearch={() => setSearch("")} />
                ) : ownsNoCourses ? (
                    <RosterEmpty variant="no-courses" />
                ) : (
                    <RosterEmpty variant="no-students" />
                )
            ) : (
                <>
                    {/* The only structural difference from the workspace tab. `course` is
                        always in the payload; the route decides whether to show it. */}
                    <StudentsTable rows={query.data.results} showCourse />
                    <RosterPagination
                        count={count}
                        page={page}
                        rows={query.data.results.length}
                        pageSize={ROSTER_PAGE_SIZE}
                        hasNext={query.data.next !== null}
                        hasPrevious={query.data.previous !== null}
                        onPageChange={setPage}
                        label="enrolments"
                    />
                </>
            )}
        </div>
    );
}
