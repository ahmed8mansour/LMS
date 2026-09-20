import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, GraduationCap, Users } from "lucide-react";
import { emptyLabel, percent } from "../types/instructorAnalytics.types";
import type { CompletionStat, PeriodLabel, QuizPassStat } from "../types/instructorAnalytics.types";

interface AnalyticsTilesProps {
    completion: CompletionStat;
    quizPass: QuizPassStat;
    activeStudents: number;
    period: PeriodLabel;
}

interface TileProps {
    label: string;
    icon: LucideIcon;
    title: string;
    value: ReactNode;
    secondary?: ReactNode;
}

function Tile({ label, icon: Icon, title, value, secondary }: TileProps) {
    return (
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-graytext/20 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-graytext2">{label}</span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-darkmint/10 text-darkmint">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
            </div>
            <div className="truncate text-2xl font-bold text-darktext" title={title}>
                {value}
            </div>
            {secondary && <div className="truncate text-sm text-graytext2">{secondary}</div>}
        </div>
    );
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
