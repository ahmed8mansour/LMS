import { CourseContent } from "@/featuers/progress";

interface CoursePageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
    const { id } = await params;

    return <CourseContent courseId={id} />;
}
