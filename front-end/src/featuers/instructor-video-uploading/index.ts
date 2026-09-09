// Public surface of the instructor-video-uploading feature module.

export { InstructorVideoUpload } from './components/InstructorVideoUpload';
export { RemoveVideoDialog } from './components/RemoveVideoDialog';

export { useLectureVideo, LECTURE_VIDEO_KEY } from './hooks/useLectureVideo';
export { useUploadVideo } from './hooks/useUploadVideo';
export { useDeleteVideo } from './hooks/useDeleteVideo';

export { InstructorVideoUploadingAPI } from './api/InstructorVideoUploading.api';

export type {
    LectureVideo,
    Signature,
    VideoStatus,
    VideoUploadLimits,
} from './types/InstructorVideoUploading.types';
