import { Hourglass } from "lucide-react";

interface ComingSoonProps {
    /** The feature name, e.g. "Analytics". */
    title: string;
    /** Optional one-line description of what will live here. */
    description?: string;
}

/**
 * Shared empty/placeholder state for instructor destinations whose features are
 * delivered by later specs. Keeps the shell coherent without erroring or blanking.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
    return (
        <div className="flex flex-1 min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                <Hourglass className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
                <h1 className="text-xl font-bold text-darktext">{title}</h1>
                <p className="text-sm text-graytext2">
                    {description ?? "This section is coming soon."}
                </p>
            </div>
        </div>
    );
}
