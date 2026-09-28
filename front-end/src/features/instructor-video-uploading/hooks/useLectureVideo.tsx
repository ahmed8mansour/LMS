import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InstructorVideoUploadingAPI } from '../api/InstructorVideoUploading.api';
import { toastsuccess, toasterror } from '@/lib/toast';
import type { VideoStatus } from '@/lib/video';

// Server-truth video state for a lecture. Read-only (delete lives in
// useDeleteVideo). Own query key so background polling never triggers the
// editor form's reset-on-data.
export const LECTURE_VIDEO_KEY = (lectureId: number) =>
    ['instructor', 'lecture', lectureId, 'video'] as const;

const POLL_MS = 5000;
const MAX_POLLS = 60; // ~5 min, then stop — a stuck webhook shouldn't poll forever

// `hasVideo` matters here: a lecture can legitimately sit in PENDING with an
// asset attached if it predates the promote-on-confirm lifecycle.
const isProcessing = (status: VideoStatus, hasVideo: boolean) =>
    hasVideo && (status === 'PENDING' || status === 'PROCESSING');

export function useLectureVideo(lectureId: number) {
    const polls = useRef(0);
    // Polling stopping is not the same as processing finishing. Without this the
    // interface just shows a spinner that will never resolve, with no hint that
    // anyone stopped looking.
    const [stalled, setStalled] = useState(false);

    const query = useQuery({
        queryKey: LECTURE_VIDEO_KEY(lectureId),
        queryFn: () => InstructorVideoUploadingAPI.getLectureVideo(lectureId),
        enabled: Number.isFinite(lectureId),
        refetchInterval: (q) => {
            const d = q.state.data;
            if (!d || !isProcessing(d.video_status, d.has_video)) {
                polls.current = 0;
                setStalled(false);
                return false; // terminal (or no video) — stop polling
            }
            if (polls.current >= MAX_POLLS) {
                setStalled(true); // give up watching, but say so
                return false;
            }
            polls.current += 1;
            return POLL_MS;
        },
    });

    // Toast once when processing reaches a terminal state, so the instructor
    // learns the outcome without watching the row.
    const prevStatus = useRef<VideoStatus | undefined>(undefined);
    useEffect(() => {
        const status = query.data?.video_status;
        if (!status) return;
        if (prevStatus.current && prevStatus.current !== status) {
            if (status === 'COMPLETED') toastsuccess('Video ready', 'Processing finished');
            if (status === 'FAILED') toasterror('Video failed', 'Processing failed — please re-upload.');
        }
        prevStatus.current = status;
    }, [query.data?.video_status]);

    // Manual re-check after we've stopped polling: restart the budget so a video
    // that is genuinely still transcoding gets watched again.
    const recheck = () => {
        polls.current = 0;
        setStalled(false);
        return query.refetch();
    };

    return {
        status: query.data?.video_status,
        videoUrl: query.data?.video_url ?? null,
        hasVideo: query.data?.has_video ?? false,
        isLoading: query.isLoading,
        stalled,
        recheck,
        refetch: query.refetch,
    };
}
