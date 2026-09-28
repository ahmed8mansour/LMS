"use client";

import { BookOpen, Play, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { DashboardCourseCard } from "@/components/molecules/DashboardCourseCard";
import { DashboardCourses } from "@/features/progress";
export default function page() {
    return (
        <DashboardCourses/>
    )
}
