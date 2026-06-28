import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Medal,
  RefreshCw,
  RotateCcw,
  Target,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/atoms/button";

type QuizResultStatus = "passed" | "failed";

interface QuizResultData {
  status: QuizResultStatus;
  quizTitle: string;
  sectionTitle: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  passingScore: number;
  timeTaken: string;
  xpEarned: number;
}

const mockResults: Record<QuizResultStatus, QuizResultData> = {
  passed: {
    status: "passed",
    quizTitle: "Section Quiz",
    sectionTitle: "Section 2: Layout Masterclass",
    score: 80,
    totalQuestions: 10,
    correctAnswers: 8,
    passingScore: 50,
    timeTaken: "12:45",
    xpEarned: 150,
  },
  failed: {
    status: "failed",
    quizTitle: "Section Quiz",
    sectionTitle: "Section 2: Layout Masterclass",
    score: 40,
    totalQuestions: 10,
    correctAnswers: 4,
    passingScore: 50,
    timeTaken: "09:18",
    xpEarned: 0,
  },
};

interface QuizResultPageProps {
  params: Promise<{
    id: string;
    quizId: string;
  }>;
  searchParams?: Promise<{
    status?: QuizResultStatus;
  }>;
}

function getResultStatus(status?: string): QuizResultStatus {
  return status === "failed" ? "failed" : "passed";
}

export default async function QuizResultPage({ params, searchParams }: QuizResultPageProps) {
  const [{ id, quizId }, query] = await Promise.all([params, searchParams]);
  const result = mockResults[getResultStatus(query?.status)];
  const isPassed = result.status === "passed";
  const scoreLabel = `${result.score}%`;
  const answeredLabel = `${result.correctAnswers}/${result.totalQuestions}`;

  const statusConfig = isPassed
    ? {
        icon: CheckCircle2,
        eyebrow: "Passed",
        title: `${result.quizTitle} Completed`,
        description: "Great job. You passed this quiz and unlocked the next section.",
        iconClassName: "bg-darkmint/10 text-darkmint shadow-[0_0_40px_rgba(43,88,105,0.18)]",
        badgeClassName: "bg-darkmint text-white",
        scoreClassName: "text-darkmint",
        primaryLabel: "Continue",
        primaryHref: `/dashboard/learn/${id}`,
        primaryIcon: ArrowRight,
        secondaryLabel: "Review Answers",
        secondaryIcon: RefreshCw,
      }
    : {
        icon: XCircle,
        eyebrow: "Failed",
        title: `${result.quizTitle} Needs Another Try`,
        description: `You need at least ${result.passingScore}% to pass. Review the answers, then retry the quiz.`,
        iconClassName: "bg-destructive/10 text-destructive shadow-[0_0_40px_rgba(220,38,38,0.14)]",
        badgeClassName: "bg-destructive text-white",
        scoreClassName: "text-destructive",
        primaryLabel: "Retry Quiz",
        primaryHref: `/dashboard/learn/${id}/quiz/${quizId}`,
        primaryIcon: RotateCcw,
        secondaryLabel: "Review Answers",
        secondaryIcon: RefreshCw,
      };

  const StatusIcon = statusConfig.icon;
  const PrimaryIcon = statusConfig.primaryIcon;
  const SecondaryIcon = statusConfig.secondaryIcon;

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden px-4 py-8 md:px-8 md:py-12">
      <div className="absolute inset-x-0 top-0 h-72 bg-darkmint/[0.06]" />

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center rounded-xl border border-border bg-background p-6 text-center shadow-sm md:p-10">
        <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ${statusConfig.iconClassName}`}>
          <StatusIcon className="h-16 w-16" />
        </div>

        <span className={`mb-6 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${statusConfig.badgeClassName}`}>
          {statusConfig.eyebrow}
        </span>

        <p className="mb-2 text-sm font-medium text-graytext">{result.sectionTitle}</p>
        <div className={`mb-3 font-headline text-6xl font-black tracking-tight md:text-7xl ${statusConfig.scoreClassName}`}>
          {scoreLabel}
        </div>

        <h1 className="mb-3 font-headline text-2xl font-bold text-darktext md:text-3xl">
          {statusConfig.title}
        </h1>
        <p className="mb-8 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
          {statusConfig.description}
        </p>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <ResultMetric icon={Target} label="Correct Answers" value={answeredLabel} />
          <ResultMetric icon={Clock} label="Time Taken" value={result.timeTaken} />
          <ResultMetric icon={Medal} label="XP Earned" value={`+${result.xpEarned}`} />
        </div>

        <div className="mt-8 flex w-full flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            className="min-h-12 rounded-lg border-darkmint/20 px-6 font-headline font-bold text-darktext"
          >
            <SecondaryIcon className="h-4 w-4" />
            {statusConfig.secondaryLabel}
          </Button>

          <Button asChild variant="darkmint" className="min-h-12 rounded-lg px-8 font-headline font-bold">
            <Link href={statusConfig.primaryHref}>
              {statusConfig.primaryLabel}
              <PrimaryIcon className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

function ResultMetric({
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
