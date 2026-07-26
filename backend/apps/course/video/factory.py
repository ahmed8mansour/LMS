# factory.py  (Factory — provider selection by config)

from django.core.exceptions import ImproperlyConfigured
from django.conf import settings
from .base import VideoProvider
from .cloudinary_provider import CloudinaryVideoProvider


def get_video_provider() -> VideoProvider:
    provider = getattr(settings, "VIDEO_PROVIDER", "cloudinary")
    if provider == "cloudinary":
        return CloudinaryVideoProvider()
    raise ImproperlyConfigured(f"Unknown VIDEO_PROVIDER: {provider}")