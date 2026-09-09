// Shared lecture-video domain helpers. Lives in lib/ rather than in a feature
// module because the atoms (file-item, file-dropzone) need the status type too,
// and an atom must not import from a feature.

/**
 * A lecture's video state. Exactly four meanings, and PENDING is the one that
 * used to be ambiguous:
 *  - PENDING    no video attached at all
 *  - PROCESSING a video is attached and transcoding
 *  - COMPLETED  ready to stream
 *  - FAILED     transcoding failed; retry or replace
 */
export type VideoStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface VideoUploadLimits {
    max_file_size: number;
    allowed_formats: string;
}

/** `"mp4,mov,webm"` → `['mp4','mov','webm']`. */
export function parseAllowedFormats(allowed: string): string[] {
    return allowed
        .split(',')
        .map((f) => f.trim().toLowerCase())
        .filter(Boolean);
}

/** Human-readable size, e.g. `2 GB`. Used in the limit copy and error messages. */
export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** i;
    // Whole numbers read better for the big units instructors actually see.
    return `${value >= 10 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/**
 * The upload limits shown in the dropzone and checked before a transfer starts.
 *
 * ⚠️ These mirror `VIDEO_MAX_UPLOAD_BYTES` / `VIDEO_ALLOWED_FORMATS` in
 * `backend/config/settings.py`. **Change them here whenever you change them
 * there.** Only the backend's copy is enforced — it is signed into the upload
 * credentials, so Cloudinary applies it no matter what this file says.
 *
 * Drift is not silent: the upload re-checks the file against the signed limits
 * that come back with those credentials, so a stale constant here produces a
 * clear message instead of an opaque rejection from Cloudinary.
 */
export const VIDEO_UPLOAD_LIMITS: VideoUploadLimits = {
    max_file_size: 2 * 1024 * 1024 * 1024, // 2 GiB
    allowed_formats: 'mp4,mov,webm,mkv,m4v',
};

/** e.g. "MP4, MOV, WEBM, MKV, M4V up to 2 GB" — the dropzone's limit copy. */
export const VIDEO_LIMITS_LABEL = `${parseAllowedFormats(VIDEO_UPLOAD_LIMITS.allowed_formats)
    .join(', ')
    .toUpperCase()} up to ${formatBytes(VIDEO_UPLOAD_LIMITS.max_file_size)}`;

/** `accept` for the file picker, so unsupported files aren't offered at all. */
export const VIDEO_ACCEPT = parseAllowedFormats(VIDEO_UPLOAD_LIMITS.allowed_formats)
    .map((f) => `.${f}`)
    .join(',');

function extensionOf(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * Reject a bad file BEFORE any bytes move. Returns an error message, or null
 * when the file is acceptable.
 *
 * Defaults to the constants above (what the dropzone advertises). The upload
 * calls it a second time with the limits actually signed into the credentials,
 * which is the authoritative pair — that second call is what catches drift.
 *
 * Either way this is a courtesy that saves a wasted transfer, not the security
 * boundary: Cloudinary enforces the signed limits itself.
 */
export function validateVideoFile(
    file: File,
    limits: VideoUploadLimits = VIDEO_UPLOAD_LIMITS,
): string | null {
    if (file.size === 0) {
        return 'That file is empty.';
    }

    const formats = parseAllowedFormats(limits.allowed_formats);
    const extension = extensionOf(file.name);

    // Browsers report an empty or generic MIME type for some containers (.mkv
    // especially), so the extension is the reliable check when we know the
    // allowed list; the MIME type is the fallback when we don't.
    if (formats.length > 0) {
        if (!formats.includes(extension)) {
            return `Only ${formats.join(', ')} files are accepted.`;
        }
    } else if (!file.type.startsWith('video/')) {
        return 'Please choose a video file.';
    }

    if (file.size > limits.max_file_size) {
        return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(limits.max_file_size)}.`;
    }

    return null;
}
