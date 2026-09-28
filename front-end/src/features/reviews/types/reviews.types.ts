export interface Review {
    id: number
    rating: number
    comment: string
    created_at: string
    updated_at: string
    // present on public course-review payloads:
    student_name?: string
    student_avatar?: string | null
    // present on the student's own-review payloads:
    course_id?: number
    course_title?: string
    course_thumbnail?: string
}



export interface CourseReviewsPage  {
    count: number
    results: Review[]
    next: string | null
    previous: string | null
}

export interface ReviewableCourse {
    course_id: number
    title: string
    thumbnail: string
    instructor_name: string
}

export interface InstructorRating {
    avg_rating: number | null
    reviews_count: number
}

export interface SubmitReviewInput {
    course_id: number
    rating: number
    comment?: string
}

export interface UpdateReviewInput {
    rating: number
    comment?: string
}

