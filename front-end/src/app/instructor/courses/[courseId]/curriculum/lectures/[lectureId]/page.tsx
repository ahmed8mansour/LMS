'use client';

import { useParams } from 'next/navigation';
import { LectureEditor } from '@/features/instructor-curriculum';

export default function LectureEditorPage() {
    const params = useParams();
    const courseId = Number(params.courseId);
    const lectureId = Number(params.lectureId);
    return <LectureEditor courseId={courseId} lectureId={lectureId} />;
}
