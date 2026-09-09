from .base import VideoProvider , WebhookResult , UploadCredentials
import time
import hmac
import hashlib
import logging
import cloudinary
import cloudinary.utils
import cloudinary.uploader
from django.conf import settings

logger = logging.getLogger(__name__)

# Cloudinary's notification for a finished eager (adaptive-HLS) transcode. This
# is the ONLY notification type that reports a transcode outcome; the others
# (plain "upload" acks, moderation, etc.) carry no verdict and must not be
# allowed to set a lecture's status.
EAGER_NOTIFICATION_TYPE = "eager"


class CloudinaryVideoProvider(VideoProvider):

    def generate_upload_credentials(self, folder: str, public_id: str | None = None) -> UploadCredentials:
        timestamp = int(time.time())
        notification_url = settings.CLOUDINARY_VIDEO_WEBHOOK_URL
        max_file_size = settings.VIDEO_MAX_UPLOAD_BYTES
        allowed_formats = settings.VIDEO_ALLOWED_FORMATS
        params = {
            "timestamp": timestamp,
            "eager": "sp_auto/m3u8",
            "eager_async": "true",
            "eager_notification_url": notification_url,
            # `allowed_formats` IS an upload-endpoint parameter, so signing it
            # makes Cloudinary the enforcement point for format: a client that
            # skips its own check still gets rejected upstream.
            #
            # `max_file_size` is deliberately NOT here. It is an upload *preset*
            # parameter, not an upload-endpoint one. Cloudinary recomputes the
            # signature from the parameters this endpoint accepts, so signing and
            # sending one it does not recognise here makes the recomputed
            # signature disagree with ours — the upload then fails with 401
            # "Invalid Signature", after the whole file has already transferred.
            #
            # It is still returned to the client (below) as the advertised limit,
            # and the client refuses oversized files before transferring. To
            # enforce size server-side, set an account-level limit or attach a
            # signed upload preset carrying max_file_size via `upload_preset`.
            "allowed_formats": allowed_formats,
        }
        # When a public_id is given (lecture-bound upload) we pin it and skip
        # `folder`, since the public_id already carries the folder path — passing
        # both would double-nest. Otherwise Cloudinary auto-names within `folder`.
        if public_id:
            params["public_id"] = public_id
        else:
            params["folder"] = folder

        # Every signed key must be sent back to Cloudinary exactly as-is, or the
        # signature Cloudinary recomputes on their end won't match.
        signature = cloudinary.utils.api_sign_request(params, settings.CLOUDINARY_STORAGE["API_SECRET"])

        return UploadCredentials(
            signature=signature,
            timestamp=timestamp,
            api_key=settings.CLOUDINARY_STORAGE["API_KEY"],
            cloud_name=settings.CLOUDINARY_STORAGE["CLOUD_NAME"],
            folder="" if public_id else folder,
            public_id=public_id or "",
            eager="sp_auto/m3u8",
            eager_async=True,
            eager_notification_url=notification_url,
            max_file_size=max_file_size,
            allowed_formats=allowed_formats,
        )

    def build_streaming_url(self, public_id: str) -> str:
        url, _ = cloudinary.utils.cloudinary_url(
            public_id, resource_type="video",
            streaming_profile="auto", format="m3u8",
        )

        return url

    def destroy(self, public_id: str) -> None:
        # resource_type must be "video" (the asset was uploaded as one);
        # invalidate=True purges any cached CDN copies of the deleted asset.
        cloudinary.uploader.destroy(public_id, resource_type="video", invalidate=True)

    def verify_webhook(self, body: bytes, signature: str, timestamp: str) -> bool:
        # Cloudinary signs webhook notifications differently from outgoing API
        # requests: SHA1(raw_body + timestamp + api_secret), plain concatenation.
        api_secret = settings.CLOUDINARY_STORAGE["API_SECRET"]

        # Reject stale notifications before doing anything else. Without an age
        # bound, a body captured once stays a valid forgery forever — the
        # signature never expires on its own.
        if not self._timestamp_is_fresh(timestamp):
            return False

        payload = body.decode() + timestamp + api_secret
        expected = hashlib.sha1(payload.encode("utf-8")).hexdigest()

        # compare_digest, not ==: a short-circuiting comparison leaks how many
        # leading characters matched, which is a timing oracle against the secret.
        return hmac.compare_digest(expected, signature or "")

    def _timestamp_is_fresh(self, timestamp: str) -> bool:
        try:
            sent_at = int(timestamp)
        except (TypeError, ValueError):
            return False

        max_age = settings.CLOUDINARY_WEBHOOK_MAX_AGE_SECONDS
        age = time.time() - sent_at
        # Guard both directions: a far-future timestamp is as suspect as an old
        # one, and the same window is a reasonable tolerance for clock skew.
        return -max_age <= age <= max_age

    def parse_webhook(self, payload: dict) -> WebhookResult:
        notification_type = payload.get("notification_type") or ""
        if notification_type:
            decisive = notification_type == EAGER_NOTIFICATION_TYPE
        else:
            # Payloads that omit notification_type entirely fall back to the old
            # heuristic (an `eager` array means the transcode reported in). Keeps
            # completions working if the field is ever absent, without letting a
            # typed "upload" ack pass as a verdict.
            decisive = bool(payload.get("eager"))

        # Status is only meaningful on a decisive notification. Anything else
        # gets PROCESSING as a placeholder that the caller will discard along
        # with the rest of the result.
        if not decisive:
            video_status = "PROCESSING"
        elif payload.get("error"):
            video_status = "FAILED"
        else:
            video_status = "COMPLETED"

        return WebhookResult(
            public_id=payload.get("public_id", ""),
            status=video_status,
            duration=payload.get("duration"),
            notification_type=notification_type,
            version=str(payload.get("version") or ""),
            decisive=decisive,
        )
