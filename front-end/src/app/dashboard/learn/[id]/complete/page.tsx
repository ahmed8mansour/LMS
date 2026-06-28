import Link from "next/link";
import {
  Award,
  BookOpenCheck,
  Clock,
  LayoutDashboard,
  MessageSquare,
  Trophy,
} from "lucide-react";

import { Button } from "@/components/atoms/button";

interface CourseCompletionData {
  courseName: string;
  lecturesCompleted: number;
  totalLectures: number;
  timeSpent: string;
  quizAverage: string;
  certificateStatus: string;
}

const mockCompletionData: CourseCompletionData = {
  courseName: "Advanced UI/UX Principles",
  lecturesCompleted: 12,
  totalLectures: 12,
  timeSpent: "18h 30m",
  quizAverage: "92%",
  certificateStatus: "Certificate coming soon",
};

interface CourseCompletePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CourseCompletePage({ params }: CourseCompletePageProps) {
  const { id } = await params;
  const lectureProgress = `${mockCompletionData.lecturesCompleted}/${mockCompletionData.totalLectures}`;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-8 md:px-8 md:py-12">
      <div className="absolute inset-x-0 top-0 h-72 bg-darkmint/[0.06]" />

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center rounded-xl border border-border bg-background p-6 text-center shadow-sm md:p-10">
        <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-darkmint/10 text-darkmint shadow-[0_0_40px_rgba(43,88,105,0.18)] md:h-32 md:w-32">
          <Trophy className="h-16 w-16 md:h-20 md:w-20" />
        </div>

        <span className="mb-6 rounded-full bg-darkmint px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
          Course Completed
        </span>

        <p className="mb-2 text-sm font-medium text-graytext">Final milestone</p>
        <h1 className="mb-3 font-headline text-3xl font-extrabold tracking-tight text-darktext md:text-5xl">
          {mockCompletionData.courseName}
        </h1>
        <p className="mb-8 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
          You have completed every lecture and passed the required quizzes for this course.
        </p>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <CompletionMetric icon={BookOpenCheck} label="Lectures" value={lectureProgress} />
          <CompletionMetric icon={Clock} label="Time Spent" value={mockCompletionData.timeSpent} />
          <CompletionMetric icon={Award} label="Quiz Average" value={mockCompletionData.quizAverage} />
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-center">
          <Button variant="darkmint" className="min-h-12 rounded-lg px-8 font-headline font-bold">
            <MessageSquare className="h-4 w-4" />
            Leave a Review
          </Button>

          <Button
            asChild
            variant="outline"
            className="min-h-12 rounded-lg border-darkmint/20 px-8 font-headline font-bold text-darktext"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-full bg-darkbg px-4 py-2 text-xs font-medium text-graytext">
          <Trophy className="h-4 w-4 text-darkmint" />
          <span>{mockCompletionData.certificateStatus}</span>
        </div>

        <Button asChild variant="link" className="mt-3 h-auto p-0 text-darkmint">
          <Link href={`/dashboard/learn/${id}`}>View course curriculum</Link>
        </Button>
      </section>
    </div>
  );
}

function CompletionMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-border bg-darkbg p-4">
      <Icon className="mb-2 h-5 w-5 text-darkmint" />
      <span className="font-headline text-lg font-bold text-darktext">{value}</span>
      <span className="mt-1 text-xs font-bold uppercase tracking-wide text-graytext">{label}</span>
    </div>
  );
}
