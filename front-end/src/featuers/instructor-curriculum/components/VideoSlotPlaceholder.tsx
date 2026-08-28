import { Film } from 'lucide-react';
import { VideoStatus } from '../types/instructorCurriculum.types';
import { VideoStatusBadge } from './VideoStatusBadge';

// Read-only video slot for the lecture editor. Uploading, processing, replace,
// and retry are delivered by spec 006 — here it only shows the current status
// and a clearly-labelled placeholder (FR-006).
export function VideoSlotPlaceholder({ status }: { status: VideoStatus }) {
    return (
        <div className="flex flex-col gap-3">
            <span className="text-xs font-mono uppercase tracking-wide text-graytext2">Video</span>
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-graytext/40 bg-lightbg/40 p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-graytext/10 text-graytext2">
                    <Film className="h-6 w-6" />
                </div>
                <div className="flex flex-col items-center gap-2">
                    <VideoStatusBadge status={status} />
                    <p className="max-w-xs text-sm text-graytext2">
                        Video upload arrives in a later update. This lecture&rsquo;s video status is
                        shown here once uploading is available.
                    </p>
                </div>
            </div>
        </div>
    );
}
