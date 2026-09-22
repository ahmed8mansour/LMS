import axiosInstance from "@/lib/axios";
import { ReviewsPageSchema } from "../schemas/instructorReviews.schma";
import type { ReviewsPage, ReviewsQuery } from "../types/instructorReviews.types";

/**
 * One endpoint, two scopes (contracts §1): with `courseId` it is a single course's
 * reviews, without it every course the instructor owns.
 *
 * Parameters are sent only when they carry a value — never `?rating=all&page=1` — so the
 * server applies its own defaults rather than parsing empties.
 */
async function getReviews({ courseId, rating, page }: ReviewsQuery): Promise<ReviewsPage> {
    const params: Record<string, string | number> = {};
    if (courseId !== undefined) params.course = courseId;
    if (rating !== "all") params.rating = rating;
    if (page > 1) params.page = page;

    const { data } = await axiosInstance.get("/reviews/instructor/reviews/", { params });
    return ReviewsPageSchema.parse(data);
}

export const instructorReviewsAPI = {
    getReviews,
};
