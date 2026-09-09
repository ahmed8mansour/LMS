import type { VideoStatus } from '@/lib/video';

// VideoStatus is defined once, in @/lib/video, because the atoms need it too and
// an atom must not import from a feature module. Re-exported here so consumers
// of this feature can keep importing it from the module they already use.
export type { VideoStatus, VideoUploadLimits } from '@/lib/video';

// The subset of the lecture payload the video slot cares about. The instructor
// lecture endpoint returns the full lecture; we only read these.
export interface LectureVideo {
    video_status: VideoStatus;
    video_url: string | null;
    has_video: boolean;
}

// The signed upload credential. Every field here except `signature` is part of
// the signed set and must reach Cloudinary verbatim, or it rejects the upload.
export interface Signature {
    signature: string
    timestamp: number
    api_key: string
    cloud_name: string
    folder: string
    public_id: string
    eager: string
    eager_async: boolean
    eager_notification_url: string
    max_file_size: number
    allowed_formats: string
}
