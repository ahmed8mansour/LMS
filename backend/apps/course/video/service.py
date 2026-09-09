# service.py  (thin Facades — one responsibility each, SRP)
import json
import uuid
import hashlib
import logging
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from .factory import get_video_provider
from .base import UploadCredentials

logger = logging.getLogger(__name__)

VIDEO_FOLDER = "lms/lectures"

# Lecture.duration is decimal(6,2) MINUTES. Clamp rather than overflow: a video
# longer than the column can hold used to raise inside the webhook handler,
# which returned 5xx, which made Cloudinary retry the same failing payload —
# wedging the lecture in PROCESSING forever. A slightly-wrong number on an
# absurdly long lecture beats an unrecoverable row.
MIN_DURATION_MINUTES = Decimal("0.01")
MAX_DURATION_MINUTES = Decimal("9999.99")

# Ordering used to stop a notification walking a lecture backwards. FAILED sits
# outside the ranking: it is reachable only from PROCESSING (see _may_advance).
STATUS_RANK = {"PENDING": 0, "PROCESSING": 1, "COMPLETED": 2}


class VideoAssetError(Exception):
    """A video lifecycle action the caller got wrong (stale/mismatched upload)."""


def seconds_to_minutes(seconds) -> Decimal | None:
    """
    Convert a provider-reported length (SECONDS) into the decimal MINUTES that
    Lecture.duration has always meant, clamped to the column's range.

    This conversion is the whole point: writing the raw seconds into a minutes
    field made every processed lecture report a length 60x too large, silently
    overwriting what the instructor typed.
    """
    if seconds is None:
        return None
    try:
        # str() first — going through float would introduce binary drift before
        # it ever reaches the decimal column.
        minutes = (Decimal(str(seconds)) / Decimal("60")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
    except (TypeError, ValueError, ArithmeticError):
        return None

    return max(MIN_DURATION_MINUTES, min(minutes, MAX_DURATION_MINUTES))


def destroy_asset(provider, public_id: str | None) -> None:
    """
    Best-effort asset teardown.

    Cleanup must never break the operation that triggered it: an instructor
    removing a video during a provider outage still needs the video gone from
    their lecture, and a failed destroy must not block a delete. We log and
    move on — the alternative is a row the instructor can never clear.
    """
    if not public_id:
        return
    try:
        provider.destroy(public_id)
    except Exception:
        logger.exception("Failed to destroy video asset %s", public_id)


class VideoUploadService:
    def __init__(self, provider=None):
        self.provider = provider or get_video_provider()

    def credentials_for(self, lecture) -> UploadCredentials:
        """
        Reserve an upload slot for `lecture` and issue signed params for a direct
        browser -> Cloudinary upload.

        This RESERVES ONLY. The generated public_id goes to
        `pending_video_public_id`; the lecture's live video, status, and duration
        are deliberately left alone. Signing an upload is not a commitment to it —
        the instructor may pick a file and never send it, or the upload may fail,
        and in either case the lecture must still be serving whatever it was
        serving before. Promotion happens in VideoLifecycleService.promote, once
        the upload is confirmed to have actually landed.
        """
        public_id = f"{VIDEO_FOLDER}/lecture_{lecture.id}_{uuid.uuid4().hex}"

        # Anything already pending is an upload that was signed and abandoned.
        # Drop it now, while we still hold its id — a moment later it would be
        # unreachable and billed forever.
        abandoned = lecture.pending_video_public_id
        if abandoned and abandoned != public_id:
            destroy_asset(self.provider, abandoned)

        lecture.pending_video_public_id = public_id
        lecture.save(update_fields=["pending_video_public_id"])

        return self.provider.generate_upload_credentials(VIDEO_FOLDER, public_id=public_id)


class VideoLifecycleService:
    """Owns the transitions between 'no video', 'in flight', and 'live'."""

    def __init__(self, provider=None):
        self.provider = provider or get_video_provider()

    def promote(self, lecture, public_id: str):
        """
        Make a confirmed upload the lecture's live video.

        The superseded asset is destroyed only AFTER the new one is in place, so
        a replacement that never arrives costs nothing: the old video stays live
        and playable. (Destroying first — which is what "delete then upload" does
        — turns any upload failure into permanent loss of working content.)
        """
        if not public_id or lecture.pending_video_public_id != public_id:
            raise VideoAssetError("This upload is no longer the pending upload for this lecture.")

        superseded = lecture.video_public_id

        with transaction.atomic():
            lecture.video_public_id = public_id
            lecture.pending_video_public_id = None
            lecture.video_status = "PROCESSING"
            lecture.save(
                update_fields=["video_public_id", "pending_video_public_id", "video_status"]
            )

        if superseded and superseded != public_id:
            destroy_asset(self.provider, superseded)

        return lecture

    def remove(self, lecture):
        """
        Take the video off a lecture entirely: destroy both the live asset and
        any in-flight one, then reset the row to "no video".

        `duration` and `title` are left untouched — they're instructor-owned
        fields, and this action was never asked to touch them.

        Works from any status, PROCESSING included: refusing to remove a
        still-processing video is how an instructor ends up stranded with a stuck
        lecture and no way out. A notification that arrives afterwards references
        an asset no lecture points at, and is ignored.
        """
        destroy_asset(self.provider, lecture.video_public_id)
        destroy_asset(self.provider, lecture.pending_video_public_id)

        lecture.video_public_id = None
        lecture.pending_video_public_id = None
        lecture.video_status = "PENDING"
        lecture.save(
            update_fields=["video_public_id", "pending_video_public_id", "video_status"]
        )
        return lecture


class VideoWebhookService:
    def __init__(self, provider=None):
        self.provider = provider or get_video_provider()

    def handle(self, body: bytes, signature: str, timestamp: str) -> bool:
        """
        Apply one provider notification.

        Returns False only when the notification could not be authenticated —
        everything else is a success from the provider's point of view, including
        duplicates, notifications that carry no verdict, and notifications for
        assets we no longer track. Those are all normal, and reporting them as
        failures would just make Cloudinary retry something we deliberately
        ignored.

        Order matters: authenticate -> dedupe -> classify -> locate -> guard -> apply.
        """
        # verify_webhook also enforces the freshness window, so a captured body
        # can't be replayed indefinitely.
        if not self.provider.verify_webhook(body, signature, timestamp):
            return False

        try:
            payload = json.loads(body)
        except (ValueError, TypeError):
            logger.warning("Discarding video webhook with unparseable body")
            return True

        result = self.provider.parse_webhook(payload)

        # Providers retry, and retries are not rare. Without dedupe a retry
        # re-applies the duration write and re-runs promotion.
        if self._already_processed(result, body):
            logger.info("Ignoring duplicate video webhook for %s", result.public_id)
            return True

        if not result.decisive or not result.public_id:
            # An upload ack or similar: carries no transcode verdict, so it must
            # not touch status. This is what used to walk finished lectures back
            # to PROCESSING when notifications arrived out of order.
            return True

        self._apply(result)
        return True

    def _already_processed(self, result, body: bytes) -> bool:
        """
        Record-and-check against the shared webhook ledger (the same model the
        payment gateway uses). Cloudinary has no single event id, so the key is
        the notification's natural identity; a payload without a version falls
        back to a hash of the exact bytes we verified.
        """
        from apps.enrollment.models import ProcessedWebhookEvent

        if result.version:
            event_id = f"{result.notification_type}:{result.public_id}:{result.version}"
        else:
            event_id = f"{result.notification_type}:{hashlib.sha256(body).hexdigest()}"

        _, created = ProcessedWebhookEvent.objects.get_or_create(
            event_id=event_id, defaults={"gateway": "cloudinary_video"}
        )
        return not created

    def _apply(self, result) -> None:
        from apps.course.models import Lecture

        with transaction.atomic():
            lecture = (
                Lecture.objects.select_for_update()
                .filter(video_public_id=result.public_id)
                .first()
            )

            if lecture is None:
                # Not live anywhere — but it may be an upload the client never got
                # to confirm (tab closed, connection dropped). Promote it here so
                # the confirm call is an optimisation, never a correctness
                # dependency.
                lecture = (
                    Lecture.objects.select_for_update()
                    .filter(pending_video_public_id=result.public_id)
                    .first()
                )
                if lecture is None:
                    # Superseded by a newer upload, or its lecture was deleted.
                    # Normal, not an error.
                    logger.info("Video webhook for untracked asset %s", result.public_id)
                    return
                VideoLifecycleService(self.provider).promote(lecture, result.public_id)

            if not self._may_advance(lecture.video_status, result.status):
                logger.info(
                    "Ignoring out-of-order video webhook for %s (%s -> %s)",
                    result.public_id, lecture.video_status, result.status,
                )
                return

            updates = {"video_status": result.status}

            if result.status == "COMPLETED":
                minutes = seconds_to_minutes(result.duration)
                if minutes is not None:
                    # The measured length is authoritative: it's what students
                    # actually watch, and the instructor's mm:ss entry was a guess
                    # typed before the file existed.
                    updates["duration"] = minutes

            for field, value in updates.items():
                setattr(lecture, field, value)
            lecture.save(update_fields=list(updates))

    @staticmethod
    def _may_advance(current: str, incoming: str) -> bool:
        """
        A notification may only move a lecture FORWARD. Once a video is
        COMPLETED, only an explicit instructor action (replace or remove) takes
        it out of that state — a late or repeated notification never does.
        """
        if current == "COMPLETED":
            return False
        if incoming == "FAILED":
            return current == "PROCESSING"
        return STATUS_RANK.get(incoming, -1) > STATUS_RANK.get(current, -1)
