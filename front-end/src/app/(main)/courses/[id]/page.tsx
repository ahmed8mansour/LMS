import { CourseDetailPage } from "@/features/courses";
interface PageParams {
    id: string; 
}

// Type the props for the Page component
interface PageProps {
    params: Promise<PageParams>;
  // searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function page({params} : PageProps){
    const {id} = await params
    return (
            <CourseDetailPage id={id}/>
    )
}

