import { Section  , Lecture , Quiz} from "./types/progress.types";
import {useQueryClient } from "@tanstack/react-query";
import { EnrolledCourseOverview } from "./types/progress.types";

/**
 * Every lecture completed and every quiz passed — the same rule the completion
 * endpoint applies server-side, evaluated here on data the page already holds
 * so navigation does not need a round trip.
 */
export function isCourseFinished(sections: Section[]): boolean {
    if (sections.length === 0) return false;

    const lectures = sections.flatMap((section) => section.lectures);
    if (lectures.length === 0) return false;

    return (
        lectures.every((lecture) => lecture.is_completed) &&
        sections.every((section) => !section.quiz || section.quiz.is_passed)
    );
}

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
    } else if (currentLecture.is_completed && isCourseFinished(sections)) {
        // Nothing left anywhere in the course: the last step leads to the
        // completion summary rather than to a dead end.
        next = `/dashboard/learn/${course_data?.course.id}/complete`;
    }

    if (previous) {
        const type = 'video_url' in previous ? 'lecture' : 'quiz';
        previous = `/dashboard/learn/${course_data?.course.id}/${type}/${previous.id}`;
    }

    return { next, previous };
}