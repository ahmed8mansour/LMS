import { CheckCircle2, GraduationCap, Users } from "lucide-react";
// Shared with the dashboard and earnings tile rows — see StatTile's own comment.
import { StatTile as Tile } from "@/components/molecules/StatTile";
import { emptyLabel, percent } from "../types/instructorAnalytics.types";
import type { CompletionStat, PeriodLabel, QuizPassStat } from "../types/instructorAnalytics.types";

interface AnalyticsTilesProps {
    completion: CompletionStat;
    quizPass: QuizPassStat;
    activeStudents: number;
    period: PeriodLabel;
}

function Empty({ label }: { label: string }) {
    return <span className="text-lg text-graytext2">{label}</span>;
}

/**
 * The three tiles (FR-008 – FR-010).
 *
 * A percentage is shown only when a real denominator exists: with nothing behind it, the
 * tile says so in words. "0%" always means zero out of something (FR-021, SC-005).
 */
export function AnalyticsTiles({ completion, quizPass, activeStudents, period }: AnalyticsTilesProps) {
    const noData = emptyLabel(period);

    return (
        <section aria-label="Summary" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {completion.total === 0 ? (
                <Tile label="Completion rate" icon={CheckCircle2} title={noData} value={<Empty label={noData} />} />
            ) : (
                <Tile
                    label="Completion rate"
                    icon={CheckCircle2}
                    title={`${percent(completion.completed, completion.total)}%`}
                    value={`${percent(completion.completed, completion.total)}%`}
                    secondary={`${completion.completed.toLocaleString("en-US")} of ${completion.total.toLocaleString("en-US")} students`}
                />
            )}

            {!quizPass.has_quizzes ? (
                <Tile label="Quiz pass rate" icon={GraduationCap} title="No quizzes" value={<Empty label="No quizzes" />} />
            ) : quizPass.attempted === 0 ? (
                <Tile label="Quiz pass rate" icon={GraduationCap} title="No attempts" value={<Empty label="No attempts" />} />
            ) : (
                <Tile
                    label="Quiz pass rate"
                    icon={GraduationCap}
                    title={`${percent(quizPass.passed, quizPass.attempted)}%`}
                    value={`${percent(quizPass.passed, quizPass.attempted)}%`}
                    secondary={`${quizPass.passed.toLocaleString("en-US")} of ${quizPass.attempted.toLocaleString("en-US")} quiz results`}
                />
            )}

            {activeStudents === 0 ? (
                <Tile label="Active students" icon={Users} title={noData} value={<Empty label={noData} />} />
            ) : (
                <Tile
                    label="Active students"
                    icon={Users}
                    title={String(activeStudents)}
                    value={activeStudents.toLocaleString("en-US")}
                    secondary="Enrolled in this period"
                />
            )}
        </section>
    );
}
