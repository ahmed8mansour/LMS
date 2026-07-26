'use client';

import { useParams } from "next/navigation";
import { LectureContent } from "@/featuers/progress";

export default function LecturePage() {
  const params = useParams<{ lectureId: string; id: string }>();
  return <LectureContent {...params} />;
}
