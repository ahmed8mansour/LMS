/** A chart with nothing to draw. Never an empty axis, and never a zero presented as data. */
export function ChartEmpty({ label }: { label: string }) {
    return (
        <div
            role="status"
            className="flex h-64 items-center justify-center rounded-lg border border-dashed border-graytext/25 text-sm text-graytext2"
        >
            {label}
        </div>
    );
}
