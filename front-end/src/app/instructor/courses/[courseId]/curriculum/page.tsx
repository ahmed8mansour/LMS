'use client';

import { useParams } from 'next/navigation';
import { CurriculumBuilder } from '@/featuers/instructor-curriculum';

export default function CourseCurriculumPage() {
    const params = useParams();
    const courseId = Number(params.courseId);
    return <CurriculumBuilder courseId={courseId} />;
}
