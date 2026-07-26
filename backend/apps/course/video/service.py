# service.py  (thin Facades — one responsibility each, SRP)
import json
import uuid

from .factory import get_video_provider
from .base import UploadCredentials

VIDEO_FOLDER = "lms/lectures"


class VideoUploadService:
    def __init__(self, provider=None):
        self.provider = provider or get_video_provider()

    def credentials_for(self, lecture=None) -> UploadCredentials:
        """
        Issue signed upload params for a direct browser -> Cloudinary upload.

        When `lecture` is given, we assign a deterministic public_id to it and
        persist it BEFORE the upload starts. That way the completion webhook can
        always find the row to update — the upload/webhook ordering no longer
        matters, so there is no race. When `lecture` is None the upload is not
        bound to any lecture and Cloudinary auto-names the asset in the folder.
        """
        public_id = None
        if lecture is not None:
            public_id = f"{VIDEO_FOLDER}/lecture_{lecture.id}_{uuid.uuid4().hex}"
            lecture.video_public_id = public_id
            lecture.video_status = "PENDING"
            lecture.save(update_fields=["video_public_id", "video_status"])

        return self.provider.generate_upload_credentials(VIDEO_FOLDER, public_id=public_id)


class VideoWebhookService:
    def __init__(self, provider=None):
        self.provider = provider or get_video_provider()

    def handle(self, body: bytes, signature: str, timestamp: str) -> bool:
        if not self.provider.verify_webhook(body, signature, timestamp):
            return False

        result = self.provider.parse_webhook(json.loads(body))

        from apps.course.models import Lecture
        Lecture.objects.filter(video_public_id=result.public_id).update(
            video_status=result.status,
            **({"duration": result.duration} if result.duration is not None else {}),
        )
        return True
