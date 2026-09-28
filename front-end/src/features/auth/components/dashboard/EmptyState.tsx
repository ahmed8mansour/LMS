import React from 'react'


import { Button } from "@/components/atoms/button";
import { BookOpen} from "lucide-react";
import Link from "next/link";

export default function EmptyState() {
    return (
        <div className="text-center h-full flex flex-col items-center justify-center">
            <BookOpen className="w-16 h-16 text-graytext/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-darktext mb-2">No courses yet</h3>
            <p className="text-graytext2 mb-4">Start learning by enrolling in a course</p>
            <Link href="/courses">
                <Button variant="darkmint">Browse Courses</Button>
            </Link>
        </div>
    );
}

