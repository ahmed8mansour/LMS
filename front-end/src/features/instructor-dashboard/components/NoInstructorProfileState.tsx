import { UserX } from "lucide-react";

/**
 * Handled state for an instructor-gated account that has no instructor profile
 * (FR-032). Not an error to retry: nothing on the client can fix it.
 */
export function NoInstructorProfileState() {
    return (
        <div className="max-w-6xl mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                <UserX className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
                <h1 className="text-xl font-bold text-darktext">Instructor profile not found</h1>
                <p className="text-sm text-graytext2">
                    This account doesn&apos;t have an instructor profile, so there&apos;s no dashboard to show.
                    Please contact support to have one set up.
                </p>
            </div>
        </div>
    );
}
