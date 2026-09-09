import { AlertCircle, CheckCircle2, Film, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import type { VideoStatus } from '@/lib/video';

// One row, two modes:
//  - uploading: pass `progress` -> progress bar + cancel.
//  - persisted: pass `status`   -> status line + Replace/Retry and Remove.
export interface FileItemData {
    key: string;
    name: string;
    sizeKb?: number;
    progress?: number;
    /** Shown instead of the percentage while the transfer is done but the server isn't. */
    finalizing?: boolean;
    status?: VideoStatus;
    /** Set when polling has stopped but the video is still processing. */
    stalled?: boolean;
    onCancel?: () => void;
    onReplace?: () => void;
    onRecheck?: () => void;
    /** Rendered as-is so the caller can wrap Remove in a confirmation dialog. */
    removeAction?: ReactNode;
    disabled?: boolean;
}

const STATUS_META: Record<VideoStatus, { label: string; className: string; Icon: typeof Film; spin?: boolean }> = {
    PENDING: { label: 'No video', className: 'text-graytext2', Icon: Film },
    PROCESSING: { label: 'Processing…', className: 'text-amber-600', Icon: Loader2, spin: true },
    COMPLETED: { label: 'Video ready', className: 'text-darkmint', Icon: CheckCircle2 },
    FAILED: { label: 'Processing failed', className: 'text-red-600', Icon: AlertCircle },
};

export function UploadedFileItem({
    name,
    sizeKb,
    progress,
    finalizing,
    status,
    stalled,
    onCancel,
    onReplace,
    onRecheck,
    removeAction,
    disabled,
}: FileItemData) {
    const uploading = progress !== undefined;
    const meta = status ? STATUS_META[status] : null;
    const processing = status === 'PENDING' || status === 'PROCESSING';

    return (
        <div className="flex items-center gap-3 rounded-lg border border-graytext/20 p-2">
            <div className="flex h-14 w-18 items-center justify-center self-start overflow-hidden rounded-sm bg-darkbg">
                <Film className="h-5 w-5 text-graytext2" />
            </div>

            <div className="flex-1 pr-1">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="max-w-[220px] truncate text-sm text-darktext">{name}</span>
                        {sizeKb !== undefined && (
                            <span className="whitespace-nowrap text-sm text-graytext2">{sizeKb} KB</span>
                        )}
                    </div>
                    {uploading && onCancel && (
                        <Button size="sm" variant="ghost" className="hover:text-red-500" onClick={onCancel}>
                            Cancel
                        </Button>
                    )}
                </div>

                {uploading ? (
                    <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-darkbg">
                            <div
                                className={`h-full bg-darkmint transition-[width] ${finalizing ? 'animate-pulse' : ''}`}
                                style={{ width: `${progress ?? 0}%` }}
                            />
                        </div>
                        <span className="whitespace-nowrap text-xs text-graytext2">
                            {/* At 100% the bytes are gone but Cloudinary is still
                                answering; saying "finishing up" beats a bar that
                                looks stuck. */}
                            {finalizing ? 'Finishing up…' : `${Math.round(progress ?? 0)}%`}
                        </span>
                    </div>
                ) : meta ? (
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
                            <meta.Icon className={`h-3.5 w-3.5 ${meta.spin ? 'animate-spin' : ''}`} />
                            {stalled && processing ? 'Still processing' : meta.label}
                        </span>
                        <div className="flex items-center gap-1">
                            {/* Every state offers a way out. Hiding Replace unless
                                the video was ready, and disabling Remove while it
                                processed, is what turned a stuck transcode into a
                                dead end with no escape. */}
                            {stalled && processing && onRecheck && (
                                <Button size="sm" variant="ghost" onClick={onRecheck} disabled={disabled}>
                                    <RefreshCw className="mr-1 h-4 w-4" /> Check again
                                </Button>
                            )}
                            {onReplace && (
                                <Button size="sm" variant="ghost" onClick={onReplace} disabled={disabled}>
                                    <RefreshCw className="mr-1 h-4 w-4" />
                                    {status === 'FAILED' ? 'Re-upload' : 'Replace'}
                                </Button>
                            )}
                            {removeAction}
                        </div>
                    </div>
                ) : null}

                {stalled && processing && (
                    <p className="mt-1 text-xs text-graytext2">
                        This is taking longer than usual. It may still finish on its own — check again, or
                        replace the video.
                    </p>
                )}
            </div>
        </div>
    );
}
