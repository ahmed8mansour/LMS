export interface CourseSummary {
    id: number
    title: string
    description: string
    thumbnail: string
    category: string
    level: string
    price: string
    language: string
    rating: number
    subscribers_count: number
    reviews_count: number
    is_published: boolean
    last_updated: string
    instructor_profile: InstructorProfile
    enrolled_status?: boolean
}

export interface Course extends CourseSummary {
    goals_list: string[]
    sections: Section[]
}

export interface InstructorProfile {
    id: number
    specific_data: SpecificData
    last_login: any
    profile_picture: string
    username: string
    first_name: string
    last_name: string
    email: string
    role: string
    is_active: boolean
    is_email_verified: boolean
    date_joined: string
}

export interface SpecificData {
    title: string
    about: string
}

export interface Section {
    id: number
    title: string
    order: number
    course: number
    lectures: Lecture[]
    quiz?: Quiz
}

export interface Lecture {
    id: number
    title: string
    duration: string
    video_url: string
    order: number
    section: number
}

export interface Quiz {
    id: number
    title: string
    questions_count: number
    section: number
}



// ==============================
// ==============================
// ==============================
export interface PaginatedResponse<T> {
    next:     string | null
    previous: string | null
    results:  T[]
}

export interface CourseFilterParams {
    search?:    string
    category?:  string[]
    level?:     string
    min_price?: number
    max_price?: number
    rating?:    number
    sort?:      string
    cursor?:    string
    page_size? : string
}