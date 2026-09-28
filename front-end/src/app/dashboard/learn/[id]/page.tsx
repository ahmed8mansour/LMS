import { CourseContent } from "@/features/progress";

interface CoursePageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
    const { id } = await params;

    return <CourseContent courseId={id} />;
}
