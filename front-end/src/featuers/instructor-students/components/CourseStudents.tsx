"use client";

import { isAxiosError } from "axios";
import { NoInstructorProfileState, isNoInstructorProfileError } from "@/featuers/instructor-dashboard";
import { RosterPagination } from "@/components/molecules/RosterPagination";
import { useInstructorStudents } from "../hooks/useInstructorStudents";
import { useRosterParams } from "../hooks/useRosterParams";
import { ROSTER_PAGE_SIZE } from "../types/instructorStudents.types";
import { RosterEmpty, RosterError, RosterSkeleton } from "./RosterStates";
import { StudentSearch } from "./StudentSearch";
import { StudentsTable } from "./StudentsTable";

/**
 * The course workspace's Students tab (FR-001 – FR-003).
 *
 * The only component here that fetches. Everything below it takes props, so the loading /
 * error / empty / rows decision lives in exactly one place.
 */
export function CourseStudents({ courseId }: { courseId: number }) {
    const { search, page, setSearch, setPage } = useRosterParams();
    const query = useInstructorStudents({ courseId, search, page });

    if (isNoInstructorProfileError(query.error)) {
        return <NoInstructorProfileState />;
    }

    // A course that isn't this instructor's is a 404 — identical to one that doesn't
    // exist, deliberately (FR-032), so the copy must not distinguish them either. The
    // workspace layout already renders "Course not found", so this adds nothing.
    const notFound = isAxiosError(query.error) && query.error.response?.status === 404;

    const count = query.data?.count ?? 0;
    const searching = search.trim() !== "";

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                    <h1 className="text-xl font-bold text-darktext">Enrolled students</h1>
                    {/* The total from the server, not results.length (FR-002, FR-022). */}
                    {query.data && (
                        <p className="text-sm text-graytext2">
                            {count === 1 ? "1 student" : `${count.toLocaleString("en-US")} students`}
                            {searching && " matching your search"}
                        </p>
                    )}
                </div>
                <StudentSearch value={search} onChange={setSearch} />
            </div>

            {query.isPending ? (
                // The skeleton replaces the table on every fetch — including a page or
                // search change — rather than leaving stale rows on screen (FR-036).
                <RosterSkeleton />
            ) : notFound ? null : query.isError || !query.data ? (
                <RosterError onRetry={() => void query.refetch()} />
            ) : count === 0 ? (
                searching ? (
                    <RosterEmpty variant="no-matches" term={search} onClearSearch={() => setSearch("")} />
                ) : (
                    <RosterEmpty variant="no-students" />
                )
            ) : (
                <>
                    <StudentsTable rows={query.data.results} showCourse={false} />
                    <RosterPagination
                        count={count}
                        page={page}
                        rows={query.data.results.length}
                        pageSize={ROSTER_PAGE_SIZE}
                        hasNext={query.data.next !== null}
                        hasPrevious={query.data.previous !== null}
                        onPageChange={setPage}
                        label="students"
                    />
                </>
            )}
        </div>
    );
}
