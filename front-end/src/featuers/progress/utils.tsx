import { Section  , Lecture , Quiz} from "./types/progress.types";
import {useQueryClient } from "@tanstack/react-query";
import { EnrolledCourseOverview } from "./types/progress.types";

export function getNextPreviousLecture(
    course_data: EnrolledCourseOverview | undefined,
    currentLectureId: number
) {
    let previous: Lecture | Quiz | string | null = null;
    let next: Lecture | Quiz |  string |null = null;

    const sections = course_data?.sections || [];

    let currentLecture: Lecture | null = null;
    let currentSection: Section | null = null;
    let currentSectionIndex = -1;

    for (let i = 0; i < sections.length; i++) {
        const found = sections[i].lectures.find(l => l.id === currentLectureId);
        if (found) {
            currentLecture = found;
            currentSection = sections[i];
            currentSectionIndex = i;
            break;
        }
    }

    if (!currentLecture || !currentSection) return { next: null, previous: null };

    const prevSection = sections[currentSectionIndex - 1] ?? null;
    const nextSection = sections[currentSectionIndex + 1] ?? null;



    // 2. getting PREVIOUS
    if (currentLecture.order === 1) {
        if (currentSectionIndex === 0) {
            previous = null; 
        } else if (prevSection) {
            previous = prevSection.quiz ?? prevSection.lectures.at(-1) ?? null;
        }
    } else {
        previous = currentSection.lectures.find(
            l => l.order === currentLecture!.order - 1
        ) ?? null;
    }

    // 3. getting NEXT 
    if (currentLecture.is_completed) {
        const nextInSection = currentSection.lectures.find(l => l.order === currentLecture!.order + 1 ) ?? null;
        if (nextInSection) {
            next = nextInSection;
        } else if (currentSection.quiz && !currentSection.quiz.is_passed) {
            next = currentSection.quiz;
        } else if (nextSection) {
            next = nextSection.lectures[0] ?? null;
        } else {
            next = null; 
        }
    }

    if(next) {
        const type = 'video_url' in next ? 'lecture' : 'quiz';
        next = `/dashboard/learn/${course_data?.course.id}/${type}/${next.id}`;
    }

    if (previous) {
        const type = 'video_url' in previous ? 'lecture' : 'quiz';
        previous = `/dashboard/learn/${course_data?.course.id}/${type}/${previous.id}`;
    }

    return { next, previous };
}