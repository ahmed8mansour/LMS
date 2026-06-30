export interface StudentOverview {
    stats: Stats
    courses: CardCourse[]
}

export type StudentCourses = CardCourse[];


export interface Stats {
    completed_courses: number
    inprogress_courses: number
    total_mins_spent: number
}


export interface CardCourse {
    id: string
    title: string
    thumbnail: string
    category: string
    progress: number
    instructor_firstname: string
    instructor_lastname: string
    instructor_avatar: string
    total_lectures: number
    lectures_completed: number
}

export interface EnrolledCourseOverview {
    course: Course
    progress: number | string
    sections: Section[]
}

export type EnrolledCourseOveview = EnrolledCourseOverview;

export interface Course {
    id: number
    title: string
    description: string
    thumbnail: string
    category: string
    level: string
    price: string
    rating: string
    subscribers_count: number
    reviews_count: number
    is_published: boolean
    language: string
    last_updated: string
    goals_list: string[]
    instructor_profile: InstructorProfile
}

export interface InstructorProfile {
    id: number
    specific_data: SpecificData
    has_usable_password: boolean
    last_login: string | null
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
    students_count: number
}

export interface Section {
    id: number
    title: string
    order: number
    is_completed: boolean
    is_unlocked: boolean
    lectures: Lecture[]
    quiz: Quiz | null
}

export interface Lecture {
    id: number
    title: string
    duration: string
    order: number
    video_url: string
    is_completed: boolean
    is_unlocked: boolean
}

export type EnrolledLectureDetail = Lecture;

export interface Quiz {
    id: number
    title: string
    is_passed: boolean
    is_unlocked: boolean
}


export interface LectureCompletionResponse {
    lecture_id: number,
    is_completed: boolean,
    completed_at: string
    already_completed: boolean
}

// ─── Quiz Flow ───────────────────────────────────────────────────────────────

export interface QuizChoice {
    id: number
    text: string
    selected: boolean | null
    correct: boolean | null
}

export interface QuizQuestion {
    id: number
    text: string
    order: number
    choices: QuizChoice[]
}

export interface QuizDetail {
    title: string
    questions_count: number
    passed: boolean
    questions: QuizQuestion[]
}

export interface QuizAnswer {
    question_id: number
    choice_id: number
}

export interface QuizSubmission {
    quiz_id: number
    answers: QuizAnswer[]
}

export interface QuizResultItem {
    question_id: number
    selected_choice_id: number
    is_correct: boolean
}

export interface QuizResult {
    quiz_id: number
    score: number
    passed: boolean
    total_questions: number
    correct_answers: number
    results: QuizResultItem[]
}