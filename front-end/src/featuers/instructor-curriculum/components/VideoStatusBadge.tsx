import { VideoStatus } from '../types/instructorCurriculum.types';

const LABELS: Record<VideoStatus, string> = {
    PENDING: 'No video',
    PROCESSING: 'Processing',
    COMPLETED: 'Video ready',
    FAILED: 'Video failed',
};

const STYLES: Record<VideoStatus, string> = {
    PENDING: 'border-graytext/30 text-graytext2',
    PROCESSING: 'border-amber-400 text-amber-600',
    COMPLETED: 'border-darkmint/50 text-darkmint',
    FAILED: 'border-red-400 text-red-600',
};

// Read-only lecture video status (upload itself is spec 006).
export function VideoStatusBadge({ status }: { status: VideoStatus }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[status]}`}
        >
            {LABELS[status]}
        </span>
    );
}
