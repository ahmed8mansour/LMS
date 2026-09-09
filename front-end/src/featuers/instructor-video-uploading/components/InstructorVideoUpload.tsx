'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import FileDropzone from '@/components/atoms/file-dropzone';
import { FileList } from '@/components/atoms/file-list';
import type { FileItemData } from '@/components/atoms/file-item';
import { Button } from '@/components/atoms/button';
import { Skeleton } from '@/components/atoms/skeleton';
import { HlsVideoPlayer } from '@/components/molecules/HlsVideoPlayer';
import { toasterror, toastinfo } from '@/lib/toast';
import { validateVideoFile, VIDEO_ACCEPT, VIDEO_LIMITS_LABEL } from '@/lib/video';
// Deep import, not the barrel: the curriculum barrel re-exports LectureEditor,
// which imports this module's barrel — going through it would close a cycle.
import { useCurriculum } from '@/featuers/instructor-curriculum/hooks/useCurriculum';
import { useUploadVideo } from '../hooks/useUploadVideo';
import { useLectureVideo } from '../hooks/useLectureVideo';
import { useDeleteVideo } from '../hooks/useDeleteVideo';
import { RemoveVideoDialog } from './RemoveVideoDialog';

interface InstructorVideoUploadProps {
    lectureId: number;
    courseId: number;
}

// One lecture, one video. The row is derived from server truth (useLectureVideo)
// plus the live upload, so it's correct on a cold reload — not just in-session.
export function InstructorVideoUpload({ lectureId, courseId }: InstructorVideoUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [localFile, setLocalFile] = useState<File | null>(null);
    const [replaceMode, setReplaceMode] = useState(false);

    const { status, hasVideo, videoUrl, isLoading, stalled, recheck } = useLectureVideo(lectureId);
    const { mutate: uploadVideo, progress, phase, isPending: isUploading, cancel } = useUploadVideo(lectureId);
    const { removeAsync, isRemoving } = useDeleteVideo(lectureId);
    const { hasEnrollments } = useCurriculum(courseId);

    const busy = isUploading || isRemoving;

    // Leaving mid-transfer aborts the upload. Nothing is corrupted — the lecture
    // keeps whatever it was serving — but the instructor loses the transfer, so
    // it's worth a prompt.
    useEffect(() => {
        if (!isUploading) return;
        const warn = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isUploading]);

    const handleFileSelect = (files: FileList | null) => {
        const picked = files?.[0];
        if (!picked) return;

        // A lecture holds one video. Say so rather than silently dropping the rest.
        if (files && files.length > 1) {
            toastinfo('One video per lecture', `Using “${picked.name}” and ignoring the other files.`);
        }

        const problem = validateVideoFile(picked);
        if (problem) {
            toasterror('Can’t use that file', problem);
            return;
        }

        // Straight to upload, even when replacing: the new video only takes over
        // once the server confirms it landed, so a cancelled or failed
        // replacement leaves the existing one live and playable. (Deleting first
        // would turn any upload failure into permanent loss.)
        setLocalFile(picked);
        setReplaceMode(false);
        uploadVideo(picked);
    };

    const cancelUpload = () => {
        cancel();
        setLocalFile(null);
        setReplaceMode(false);
    };

    const dropzone = (
        <FileDropzone
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
            limitsLabel={VIDEO_LIMITS_LABEL}
            accept={VIDEO_ACCEPT}
            disabled={busy}
        />
    );

    const removeAction = (
        <RemoveVideoDialog
            hasEnrollments={hasEnrollments}
            onConfirm={() => removeAsync()}
            trigger={
                <Button size="sm" variant="ghost" className="hover:text-red-500" disabled={busy}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                </Button>
            }
        />
    );

    const videoRow = (item: FileItemData) => <FileList items={[item]} />;

    let body: React.ReactNode;
    if (isUploading && localFile) {
        body = videoRow({
            key: 'local',
            name: localFile.name,
            sizeKb: Math.round(localFile.size / 1024),
            progress,
            finalizing: phase === 'finalizing',
            onCancel: cancelUpload,
        });
    } else if (replaceMode) {
        body = (
            <>
                {dropzone}
                <div className="px-6 pb-5">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setReplaceMode(false)}
                        className="text-sm text-graytext2 hover:text-darktext"
                    >
                        Keep the current video
                    </Button>
                </div>
            </>
        );
    } else if (isLoading) {
        body = (
            <div className="p-6">
                <Skeleton className="h-20 w-full rounded-lg" />
            </div>
        );
    } else if (hasVideo) {
        body = (
            <>
                {status === 'COMPLETED' && videoUrl && (
                    <div className="px-6 pt-2">
                        <HlsVideoPlayer
                            src={videoUrl}
                            status={status}
                            title="Lecture video"
                            className="aspect-video w-full overflow-hidden rounded-lg"
                        />
                    </div>
                )}
                {videoRow({
                    key: 'v',
                    name: 'Lecture video',
                    // PENDING with an asset attached predates promote-on-confirm;
                    // show it as processing rather than as "no video".
                    status: status === 'PENDING' ? 'PROCESSING' : status,
                    stalled,
                    onReplace: () => setReplaceMode(true),
                    onRecheck: () => recheck(),
                    removeAction,
                    disabled: busy,
                })}
            </>
        );
    } else {
        body = dropzone;
    }

    return (
        <div className="flex flex-col gap-3">
            <span className="font-mono text-xs uppercase tracking-wide text-graytext2">Video</span>
            <div className="rounded-lg border border-graytext/20 bg-white">{body}</div>
        </div>
    );
}
