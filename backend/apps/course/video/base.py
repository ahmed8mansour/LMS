# base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class UploadCredentials:
    """
    One signed permission to upload one asset.

    Every field here except `signature` itself is part of the SIGNED SET: the
    client must send each one back to the provider verbatim, or the signature the
    provider recomputes won't match and the upload is rejected. Adding a field
    here is therefore always a coordinated client+server change.
    """
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
    public_id: str
    eager: str
    eager_async: bool
    eager_notification_url: str
    max_file_size: int
    allowed_formats: str


@dataclass(frozen=True)
class WebhookResult:
    """
    A parsed provider notification.

    `decisive` marks whether this notification actually reports a transcode
    outcome. Providers send several notification types per asset (a plain upload
    ack, then the eager-transcode result) and delivery is NOT ordered, so a
    non-decisive one must never be allowed to set status — that is what let a
    late upload-ack walk a finished lecture back to PROCESSING.
    """
    public_id: str
    status: str
    duration: float | None
    notification_type: str
    version: str
    decisive: bool


class VideoProvider(ABC):
    """Abstraction every video backend must satisfy (Strategy)."""

    @abstractmethod
    def generate_upload_credentials(self, folder: str, public_id: str | None = None) -> UploadCredentials:
        pass

    @abstractmethod
    def build_streaming_url(self, public_id: str) -> str:
        pass

    @abstractmethod
    def destroy(self, public_id: str) -> None:
        pass

    @abstractmethod
    def verify_webhook(self, body: bytes, signature: str, timestamp: str) -> bool:
        pass

    @abstractmethod
    def parse_webhook(self, payload: dict) -> WebhookResult:
        pass