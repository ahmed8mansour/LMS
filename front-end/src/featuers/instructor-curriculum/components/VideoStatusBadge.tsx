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

interface VideoStatusBadgeProps {
    status: VideoStatus;
    /** Whether an asset is actually attached to the lecture. */
    hasVideo?: boolean;
}

// Read-only lecture video status.
//
// `hasVideo` is what keeps this honest: a lecture can be PENDING with an asset
// attached (an upload still being processed), and reading the status alone would
// label that "No video" — telling the instructor to upload something they just
// uploaded.
export function VideoStatusBadge({ status, hasVideo }: VideoStatusBadgeProps) {
    const effective: VideoStatus = status === 'PENDING' && hasVideo ? 'PROCESSING' : status;

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[effective]}`}
        >
            {LABELS[effective]}
        </span>
    );
}
