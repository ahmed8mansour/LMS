import axiosInstance from "@/lib/axios";
import { RosterPageSchema } from "../schemas/instructorStudents.schma";
import type { RosterPage, RosterQuery } from "../types/instructorStudents.types";

/**
 * One endpoint, two scopes (contracts §1): with `course` it is a single course's roster,
 * without it every course the instructor owns.
 *
 * Parameters are sent only when they carry a value — never `?search=&page=1` — so the
 * server applies its own defaults rather than parsing empties.
 */
async function getStudents({ courseId, search, page }: RosterQuery): Promise<RosterPage> {
    const params: Record<string, string | number> = {};
    if (courseId !== undefined) params.course = courseId;
    if (search.trim() !== "") params.search = search.trim();
    if (page > 1) params.page = page;

    const { data } = await axiosInstance.get("/courses/instructor/students/", { params });
    return RosterPageSchema.parse(data);
}

export const instructorStudentsAPI = {
    getStudents,
};
