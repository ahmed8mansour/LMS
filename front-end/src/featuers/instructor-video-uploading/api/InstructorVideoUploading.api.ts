import axiosInstance from '@/lib/axios';
import { LectureVideo } from '../types/InstructorVideoUploading.types';

// Reads the lecture's current video state (status / url / has_video). Used by
// the status poll, so it targets the instructor lecture retrieve endpoint.
async function getLectureVideo(lectureId: number): Promise<LectureVideo> {
    const { data } = await axiosInstance.get(`/courses/instructor/lectures/${lectureId}/`);
    return data;
}

// Removes the video from a lecture: destroys the Cloudinary asset and resets
// the lecture to "no video". Responds 204 with no body — the caller re-reads
// the lecture rather than trusting a payload echoed back from the delete.
async function deleteVideo(lectureId: number): Promise<void> {
    await axiosInstance.delete(`/courses/video/${lectureId}/`);
}

// Note: the upload itself lives in `@/lib/cloudinary` (uploadVideoToCloudinary),
// because the bytes go straight to Cloudinary and never through our API — only
// the signature, confirm, and delete calls belong here.
export const InstructorVideoUploadingAPI = {
    getLectureVideo,
    deleteVideo,
};
