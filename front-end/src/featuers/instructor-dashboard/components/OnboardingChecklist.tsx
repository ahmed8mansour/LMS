import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, CheckCircle2, Circle, LayoutList, Plus, Rocket, UserPen, Video } from "lucide-react";
import type { DashboardSnapshot } from "../types/instructorDashboard.types";

type Onboarding = DashboardSnapshot["onboarding"];

interface OnboardingChecklistProps {
    onboarding: Onboarding;
}

interface Step {
    key: keyof Onboarding;
    icon: LucideIcon;
    title: string;
    desc: string;
    href: string;
}

// Shown only while the instructor owns no courses (FR-020, FR-022), so steps 2–5 all
// start at creating a course. The profile step links to settings, which stays a
// placeholder until spec 011 (FR-024).
const STEPS: Step[] = [
    {
        key: "profile_complete",
        icon: UserPen,
        title: "Complete your instructor profile",
        desc: "Add your title and bio so students trust you.",
        href: "/instructor/settings",
    },
    {
        key: "has_course",
        icon: BookOpen,
        title: "Create your first course",
        desc: "Set the title, price, and details to start building.",
        href: "/instructor/courses/new",
    },
    {
        key: "has_curriculum",
        icon: LayoutList,
        title: "Add curriculum",
        desc: "Structure your course into sections and lectures.",
        href: "/instructor/courses/new",
    },
    {
        key: "has_ready_video",
        icon: Video,
        title: "Upload a video",
        desc: "Attach a video to a lecture and let it finish processing.",
        href: "/instructor/courses/new",
    },
    {
        key: "has_published_course",
        icon: Rocket,
        title: "Publish",
        desc: "Once your course is ready, publish it to the catalog.",
        href: "/instructor/courses/new",
    },
];

/** Onboarding for an instructor with no courses. Step states come from real data (FR-021, FR-023). */
export function OnboardingChecklist({ onboarding }: OnboardingChecklistProps) {
    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-darktext">Welcome to your instructor workspace</h1>
                <p className="text-graytext2">
                    This is your home base for creating and managing courses. Here&apos;s how to get started.
                </p>
            </header>

            <ol aria-label="Getting started" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {STEPS.map((step, i) => {
                    const done = onboarding[step.key];
                    const body = (
                        <>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-darkmint/10 text-darkmint">
                                <step.icon className="h-5 w-5" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="text-xs font-semibold text-graytext2">Step {i + 1}</span>
                                <h2 className={done ? "font-semibold text-graytext2 line-through" : "font-semibold text-darktext"}>
                                    {step.title}
                                </h2>
                                <p className="text-sm text-graytext2">{step.desc}</p>
                            </div>
                            {done ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-darkmint" aria-hidden="true" />
                            ) : (
                                <Circle className="h-5 w-5 shrink-0 text-graytext2" aria-hidden="true" />
                            )}
                            {done && <span className="sr-only">Completed</span>}
                        </>
                    );

                    return (
                        <li key={step.key}>
                            {done ? (
                                <div className="flex h-full items-start gap-4 rounded-xl border border-graytext/20 bg-lightbg p-5">
                                    {body}
                                </div>
                            ) : (
                                <Link
                                    href={step.href}
                                    className="flex h-full items-start gap-4 rounded-xl border border-graytext/20 bg-white p-5 shadow-sm transition-colors hover:border-darkmint/40"
                                >
                                    {body}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>

            <div>
                <Link
                    href="/instructor/courses/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-darkmint px-5 py-3 font-semibold text-white transition-colors hover:bg-darkmint/90"
                >
                    <Plus className="h-4 w-4" />
                    Create your first course
                </Link>
            </div>
        </div>
    );
}
