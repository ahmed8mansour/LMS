import { useMemo } from 'react'
import { Section } from '../types/course.types'

export function useCourseStats(sections: Section[] = []) {
    return useMemo(() => {
        let totalMinutes = 0
        let totalLectures = 0

        for (const section of sections) {
            totalLectures += section.lectures.length
            for (const lecture of section.lectures) {
                totalMinutes += parseFloat(lecture.duration)
            }
        }

        const hours   = Math.floor(totalMinutes / 60)
        const minutes = Math.round(totalMinutes % 60)

        return {
            totalLectures,
            totalSections: sections.length,
            totalDuration: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
        }
    }, [sections])
}