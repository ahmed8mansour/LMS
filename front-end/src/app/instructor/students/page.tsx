import { Suspense } from "react";
import { InstructorStudents, RosterSkeleton } from "@/featuers/instructor-students";

// The page reads ?search= and ?page= through useSearchParams, which Next 16 requires to
// sit under a Suspense boundary.
export default function InstructorStudentsPage() {
    return (
        <Suspense fallback={<RosterSkeleton />}>
            <InstructorStudents />
        </Suspense>
    );
}
