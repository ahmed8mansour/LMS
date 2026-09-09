import axiosInstance from "./axios";
import axios from 'axios';
import type { AxiosError } from 'axios';
import { validateVideoFile } from './video';

export async function uploadImageToCloudinary(file: File): Promise<string> {
    const { data: sigData } = await axiosInstance.get('/auth/user/getCloudinarySignature/');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', sigData.api_key);
    formData.append('timestamp', sigData.timestamp);
    formData.append('signature', sigData.signature);

    const { data } = await axios.post(
        `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`,
        formData,
        { timeout: 60000 }
    );

    return data.secure_url;
}

/** 'transferring' = bytes still moving; 'finalizing' = all sent, waiting on Cloudinary + our confirm. */
export type UploadPhase = 'transferring' | 'finalizing';

interface UploadVideoOptions {
    onProgress?: (percent: number) => void;
    onPhase?: (phase: UploadPhase) => void;
    signal?: AbortSignal;
}

// Cloudinary caps a single-request upload at 100MB, and lecture video is
// routinely far larger, so the file goes up in chunks. Every chunk except the
// last must be the same size and a multiple of 5MB.
const CHUNK_SIZE = 20 * 1024 * 1024;

// Direct browser -> Cloudinary upload for a lecture video. The file bytes never
// touch our API: Django only signs the request (POST /courses/video/upload-
// signature/, which reserves a public_id on the lecture without disturbing the
// video it is currently serving), then the browser uploads straight to
// Cloudinary. Every signed field must be sent back verbatim or Cloudinary
// rejects the signature.
export async function uploadVideoToCloudinary(
    file: File,
    lectureId: number,
    { onProgress, onPhase, signal }: UploadVideoOptions = {},
): Promise<string> {
    const { data: sig } = await axiosInstance.post('/courses/video/upload-signature/', {
        lecture_id: lectureId,
    });

    // The credentials carry the limits Cloudinary will actually enforce. The
    // picker already checked against our local constants; re-checking here means
    // that if those constants ever drift from the backend settings, the
    // instructor gets a real message instead of an opaque rejection after
    // sitting through the whole transfer.
    const violation = validateVideoFile(file, {
        max_file_size: sig.max_file_size,
        allowed_formats: sig.allowed_formats,
    });
    if (violation) throw new Error(violation);

    // Rebuilt per chunk: FormData is single-use, and each chunk carries the same
    // signed parameter set alongside its own slice of the file.
    const buildChunkForm = (chunk: Blob) => {
        const formData = new FormData();
        formData.append('file', chunk, file.name);
        formData.append('api_key', sig.api_key);
        formData.append('timestamp', String(sig.timestamp));
        formData.append('signature', sig.signature);
        formData.append('eager', sig.eager);
        formData.append('eager_async', String(sig.eager_async));
        formData.append('eager_notification_url', sig.eager_notification_url);
        // `allowed_formats` is part of the signed set, so it must be echoed
        // verbatim — omitting it breaks the signature.
        //
        // `max_file_size` is NOT sent: it is an upload-preset parameter, not an
        // upload-endpoint one, so signing and sending it here made Cloudinary's
        // recomputed signature disagree with ours and reject the finished upload
        // with 401. It still arrives in `sig` and still gates the file locally
        // (see the pre-flight check above) — it just isn't a signed field.
        formData.append('allowed_formats', sig.allowed_formats);
        // A lecture-bound upload carries a public_id (folder is empty). Send
        // whichever the backend signed, never both.
        if (sig.public_id) formData.append('public_id', sig.public_id);
        if (sig.folder) formData.append('folder', sig.folder);
        return formData;
    };

    const data = await uploadInChunks(
        `https://api.cloudinary.com/v1_1/${sig.cloud_name}/video/upload`,
        file,
        buildChunkForm,
        { onProgress, onPhase, signal },
    );

    // Tell our API the upload landed. Only now does this asset become the
    // lecture's video — signing merely reserved it, so an abandoned or failed
    // upload leaves whatever the lecture was already serving untouched.
    await confirmLectureVideo(lectureId, sig.public_id);

    return data.secure_url;
}

// Cloudinary stitches chunks by X-Unique-Upload-Id; Content-Range tells it where
// each slice belongs. Only the final chunk's response carries the asset JSON —
// the earlier ones just acknowledge.
async function uploadInChunks(
    url: string,
    file: File,
    buildChunkForm: (chunk: Blob) => FormData,
    { onProgress, onPhase, signal }: UploadVideoOptions,
) {
    const uploadId = newUploadId();
    const total = file.size;
    let response: { secure_url: string } | undefined;
    let phase: UploadPhase = 'transferring';

    onPhase?.('transferring');

    for (let start = 0; start < total; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, total);
        const sentBefore = start;

        let data: { secure_url: string };
        try {
            ({ data } = await axios.post(url, buildChunkForm(file.slice(start, end)), {
                signal,
                headers: {
                    'X-Unique-Upload-Id': uploadId,
                    'Content-Range': `bytes ${start}-${end - 1}/${total}`,
                },
                onUploadProgress: (e) => {
                    const sent = Math.min(sentBefore + e.loaded, total);
                    onProgress?.(Math.round((sent * 100) / total));
                    // Once every byte is out the door the bar would otherwise sit
                    // at 100% while Cloudinary finishes the request, which reads
                    // as a hang. Say what is actually happening instead.
                    if (sent >= total && phase === 'transferring') {
                        phase = 'finalizing';
                        onPhase?.('finalizing');
                    }
                },
            }));
        } catch (e) {
            throw asProviderError(e);
        }

        response = data;
    }

    if (!response) {
        // Zero-byte file: the loop never ran, so nothing was uploaded. The
        // picker rejects these, but a Blob of size 0 must not resolve as success.
        throw new Error('The selected file is empty.');
    }

    onPhase?.('finalizing');
    return response;
}

/**
 * Convert a failure from Cloudinary into an error that says so.
 *
 * This matters more than it looks. Cloudinary is not our API, but the upload
 * mutation's error handler (`handleAuthError`) is written for ours: it turns any
 * 401 into "please sign in first", and it reads `data.error` as a string.
 * Cloudinary answers signature problems with 401 and puts its reason in
 * `data.error.message` (an object) — so an upload rejected for, say, a stale
 * signature was reported as a login problem, with the real reason discarded.
 *
 * Re-throwing as a plain Error routes it to the branch that shows `message`
 * verbatim, so the actual cause reaches the instructor and the logs.
 */
function asProviderError(e: unknown): unknown {
    const err = e as AxiosError<{ error?: { message?: string } }>;

    // Cancellation is control flow, not failure — it must stay recognisable.
    if (err?.code === 'ERR_CANCELED') return e;
    if (!err?.isAxiosError) return e;

    if (!err.response) {
        return new Error('Lost connection to the video host during the upload.');
    }

    const reason = err.response.data?.error?.message ?? err.response.statusText ?? '';
    const status = err.response.status;

    // 401 from Cloudinary is a signature problem, never a session problem: a
    // stale timestamp (signatures expire after an hour, which a long upload can
    // outlive) or a signed field that did not arrive verbatim.
    if (status === 401) {
        return new Error(
            `The video host rejected the upload's signature${reason ? `: ${reason}` : ''}. ` +
                'This is not a sign-in problem — please retry the upload.',
        );
    }

    return new Error(
        `The video host rejected the upload (${status})${reason ? `: ${reason}` : ''}.`,
    );
}

function newUploadId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID().replace(/-/g, '');
    }
    return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

// The webhook performs the same promotion if this never runs, so a failure here
// is not fatal — it only costs the instructor the immediate "processing" state.
// A 400 means the upload was already promoted (or superseded), which is a
// success from the caller's point of view, not an error to surface.
async function confirmLectureVideo(lectureId: number, publicId: string): Promise<void> {
    try {
        await axiosInstance.post(`/courses/video/${lectureId}/confirm/`, { public_id: publicId });
    } catch {
        // Intentionally swallowed: the status poll picks up the real state.
    }
}
