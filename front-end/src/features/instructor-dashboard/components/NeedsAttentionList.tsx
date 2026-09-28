import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AttentionItem, AttentionType, DashboardSnapshot } from "../types/instructorDashboard.types";
import { ATTENTION_LABEL, attentionHref } from "../types/instructorDashboard.types";

interface NeedsAttentionListProps {
    needsAttention: DashboardSnapshot["needs_attention"];
}

const WARNING_TYPES: ReadonlySet<AttentionType> = new Set(["live_needs_attention", "video_failed"]);

function count(n: number, singular: string, plural: string): string {
    return `${n.toLocaleString("en-US")} ${n === 1 ? singular : plural}`;
}

function detail(item: AttentionItem): string {
    const type = item.type;
    switch (type) {
        case "live_needs_attention":
            return `${count(item.blocker_count, "issue", "issues")} · ${count(item.active_students, "student", "students")} affected`;
        case "video_failed":
            return count(item.failed_lecture_ids.length, "failed video", "failed videos");
        case "ready_to_publish":
            return "Passes every publish check";
        case "draft_in_progress":
            return `${count(item.blocker_count, "blocker", "blockers")} remaining`;
        default: {
            const unmapped: never = type;
            return unmapped;
        }
    }
}

/**
 * Courses that need the instructor, ranked by the server (FR-013–FR-019). Items are
 * links into existing surfaces only — no actions happen here (FR-033).
 */
export function NeedsAttentionList({ needsAttention }: NeedsAttentionListProps) {
    const { total, items } = needsAttention;

    return (
        <section aria-labelledby="needs-attention-title" className="rounded-xl border border-graytext/20 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="needs-attention-title" className="text-lg font-semibold text-darktext">
                    Needs attention
                </h2>
                {total > items.length && (
                    <span className="text-sm text-graytext2">
                        Showing {items.length} of {total}
                    </span>
                )}
            </div>

            {total === 0 ? (
                // Shown, never hidden: an empty list is a statement that nothing is wrong (FR-018).
                <div className="flex items-center gap-3 rounded-lg bg-lightbg p-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-darkmint" />
                    <div className="min-w-0">
                        <p className="font-semibold text-darktext">All caught up</p>
                        <p className="text-sm text-graytext2">Nothing needs your attention right now.</p>
                    </div>
                </div>
            ) : (
                <ul className="flex flex-col divide-y divide-graytext/15">
                    {items.map((item) => (
                        <li key={item.course.id}>
                            <Link
                                href={attentionHref(item)}
                                className="flex items-center gap-3 py-3 transition-colors hover:bg-lightbg sm:px-2 rounded-lg"
                            >
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span
                                        className={cn(
                                            "w-fit rounded-full border px-2 py-0.5 text-xs font-semibold",
                                            WARNING_TYPES.has(item.type)
                                                ? "border-red-200 bg-red-50 text-red-600"
                                                : "border-graytext/20 text-graytext2",
                                        )}
                                    >
                                        {ATTENTION_LABEL[item.type]}
                                    </span>
                                    <span className="truncate font-semibold text-darktext" title={item.course.title}>
                                        {item.course.title}
                                    </span>
                                    <span className="truncate text-sm text-graytext2">{detail(item)}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-graytext2" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-3 border-t border-graytext/15 pt-3">
                <Link href="/instructor/courses" className="text-sm font-semibold text-darkmint hover:underline">
                    View all courses
                </Link>
            </div>
        </section>
    );
}
