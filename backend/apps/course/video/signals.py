"""
Media cleanup on deletion.

Once a Lecture row is gone, nothing in the system can ever name its Cloudinary
assets again — they become unreachable and billed forever. So the teardown has
to happen as part of the delete, not as a separate action someone might forget.

Django's collector emits post_delete per instance during a cascade, so hooking
Lecture alone also covers deleting a Section or a whole Course. That is the
reason this is a signal rather than explicit calls in three viewsets: one choke
point instead of five places to miss.
"""

import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.course.models import Lecture
from .factory import get_video_provider
from .service import destroy_asset

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Lecture, dispatch_uid="course.video.destroy_lecture_assets")
def destroy_lecture_assets(sender, instance, **kwargs):
    if not (instance.video_public_id or instance.pending_video_public_id):
        return

    try:
        provider = get_video_provider()
    except Exception:
        # Misconfigured provider must not block a delete the instructor asked
        # for; destroy_asset already swallows per-asset failures.
        logger.exception("Could not resolve video provider to clean up lecture %s", instance.pk)
        return

    destroy_asset(provider, instance.video_public_id)
    destroy_asset(provider, instance.pending_video_public_id)
