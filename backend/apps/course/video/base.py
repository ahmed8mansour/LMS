# base.py
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class UploadCredentials:
    signature: str
    timestamp: int
    api_key: str
    cloud_name: str
    folder: str
    public_id: str
    eager: str
    eager_async: bool
    eager_notification_url: str


@dataclass(frozen=True)
class WebhookResult:
    public_id: str
    status: str            
    duration: float | None


class VideoProvider(ABC):
    """Abstraction every video backend must satisfy (Strategy)."""

    @abstractmethod
    def generate_upload_credentials(self, folder: str, public_id: str | None = None) -> UploadCredentials:
        pass

    @abstractmethod
    def build_streaming_url(self, public_id: str) -> str:
        pass

    @abstractmethod
    def verify_webhook(self, body: bytes, signature: str, timestamp: str) -> bool:
        pass

    @abstractmethod
    def parse_webhook(self, payload: dict) -> WebhookResult:
        pass