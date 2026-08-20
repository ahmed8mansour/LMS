import Link from "next/link";
import { BookOpen, LayoutList, Upload, Rocket } from "lucide-react";

const onboardingSteps = [
    { icon: BookOpen, title: "Complete your instructor profile", desc: "Add your title, bio, and avatar so students trust you." },
    { icon: LayoutList, title: "Create your first course", desc: "Set the title, price, and details to start building." },
    { icon: Upload, title: "Add curriculum & videos", desc: "Structure sections and lectures, then upload your videos." },
    { icon: Rocket, title: "Publish", desc: "Once your course is ready, publish it to the catalog." },
];

export default function InstructorDashboardPage() {
    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-8">
            <header className="flex flex-col gap-2">
                <h1 className="text-2xl md:text-3xl font-bold text-darktext">Welcome to your instructor workspace</h1>
                <p className="text-graytext2">
                    This is your home base for creating and managing courses. Here&apos;s how to get started.
                </p>
            </header>

            <section aria-label="Getting started" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {onboardingSteps.map((step, i) => (
                    <div
                        key={step.title}
                        className="flex items-start gap-4 rounded-xl border border-darkbg bg-white p-5"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-darkmint/10 text-darkmint">
                            <step.icon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-graytext2">Step {i + 1}</span>
                            <h2 className="font-semibold text-darktext">{step.title}</h2>
                            <p className="text-sm text-graytext2">{step.desc}</p>
                        </div>
                    </div>
                ))}
            </section>

            <div>
                <Link
                    href="/instructor/courses"
                    className="inline-flex items-center gap-2 rounded-lg bg-darkmint px-5 py-3 font-semibold text-white transition-colors hover:bg-darkmint/90"
                >
                    <LayoutList className="h-4 w-4" />
                    Create your first course
                </Link>
            </div>
        </div>
    );
}
