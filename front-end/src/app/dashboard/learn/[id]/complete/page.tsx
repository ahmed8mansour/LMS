import { CourseCompletion } from "@/features/progress";

interface CourseCompletePageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function CourseCompletePage({ params }: CourseCompletePageProps) {
    const { id } = await params;

    return <CourseCompletion courseId={id} />;
}
