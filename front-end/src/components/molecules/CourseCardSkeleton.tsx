import { Skeleton } from "@/components/atoms/skeleton";

export default function CourseCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-xl p-4 border border-darkbg shadow-lg bg-white">
            {/* Image / Preview */}
            <div className="relative h-56 rounded-2xl overflow-hidden">
                <Skeleton className="w-full h-full rounded-2xl" />

                {/* Tag Skeleton */}
                <div className="absolute left-3 top-3">
                    <Skeleton className="h-6 w-14 rounded-[4px]" />
                </div>
            </div>

            {/* Content */}
            <div className="space-y-4 py-5">
                {/* Title + Price */}
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-12" />
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                </div>

                {/* Instructor + Rating */}
                <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-6 h-6 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                    </div>

                    <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                </div>
            </div>
        </div>
    );
}
