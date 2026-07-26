from .base import VideoProvider , WebhookResult , UploadCredentials
import time
import hashlib
import cloudinary
import cloudinary.utils
from django.conf import settings

class CloudinaryVideoProvider(VideoProvider):

    def generate_upload_credentials(self, folder: str, public_id: str | None = None) -> UploadCredentials:
        timestamp = int(time.time())
        notification_url = settings.CLOUDINARY_VIDEO_WEBHOOK_URL
        params = {
            "timestamp": timestamp,
            "eager": "sp_auto/m3u8",
            "eager_async": "true",
            "eager_notification_url": notification_url,
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
        )

    def build_streaming_url(self, public_id: str) -> str: 
        url, _ = cloudinary.utils.cloudinary_url(
            public_id, resource_type="video",
            streaming_profile="auto", format="m3u8",
        )

        return url
    
    def verify_webhook(self, body: bytes, signature: str, timestamp: str) -> bool:
        # Cloudinary signs webhook notifications differently from outgoing API
        # requests: SHA1(raw_body + timestamp + api_secret), plain concatenation.
        api_secret = settings.CLOUDINARY_STORAGE["API_SECRET"]
        payload = body.decode() + timestamp + api_secret
        expected = hashlib.sha1(payload.encode("utf-8")).hexdigest()

        return expected == signature


    def parse_webhook(self, payload: dict) -> WebhookResult:
        eager = payload.get("eager") or []
        if payload.get("error"):
            video_status = "FAILED"
        elif eager:
            video_status = "COMPLETED"
        else:
            video_status = "PROCESSING"

        return WebhookResult(
            public_id=payload.get("public_id", ""),
            status=video_status,
            duration=payload.get("duration"),
        )
