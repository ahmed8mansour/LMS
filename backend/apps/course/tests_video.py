"""006 — Lecture video upload API tests: signature, confirm, delete, webhook, cleanup.

The video provider is mocked throughout (a FakeProvider recording every destroy),
so nothing here touches Cloudinary and asset teardown is directly assertable.
Reuses the instructor/course helpers from apps.course.tests.
"""
import json
import time
from decimal import Decimal
from unittest.mock import patch


from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.course.models import Section, Lecture
from apps.course.tests import make_instructor, make_course
from apps.course.video.base import UploadCredentials, WebhookResult
from apps.course.video.service import (
    VideoLifecycleService, VideoUploadService, VideoWebhookService,
    VideoAssetError, seconds_to_minutes,
)
from apps.enrollment.models import ProcessedWebhookEvent


class FakeProvider:
    """Records destroys; classifies webhooks the way the real provider does."""

    def __init__(self, authentic=True, destroy_raises=False):
        self.destroyed = []
        self.authentic = authentic
        self.destroy_raises = destroy_raises

    def generate_upload_credentials(self, folder, public_id=None):
        return UploadCredentials(
            signature='sig', timestamp=1, api_key='k', cloud_name='c',
            folder='' if public_id else folder, public_id=public_id or '',
            eager='sp_auto/m3u8', eager_async=True, eager_notification_url='http://hook',
            max_file_size=123, allowed_formats='mp4',
        )

    def build_streaming_url(self, public_id):
        return f'https://cdn/{public_id}.m3u8'

    def destroy(self, public_id):
        if self.destroy_raises:
            raise RuntimeError('cloudinary is down')
        self.destroyed.append(public_id)

    def verify_webhook(self, body, signature, timestamp):
        return self.authentic

    def parse_webhook(self, payload):
        notification_type = payload.get('notification_type') or ''
        decisive = (
            notification_type == 'eager' if notification_type else bool(payload.get('eager'))
        )
        if not decisive:
            video_status = 'PROCESSING'
        elif payload.get('error'):
            video_status = 'FAILED'
        else:
            video_status = 'COMPLETED'
        return WebhookResult(
            public_id=payload.get('public_id', ''), status=video_status,
            duration=payload.get('duration'), notification_type=notification_type,
            version=str(payload.get('version') or ''), decisive=decisive,
        )


def _lecture(section, order=0, duration=Decimal('4.20'), **overrides):
    data = dict(section=section, title='L', duration=duration, order=order)
    data.update(overrides)
    return Lecture.objects.create(**data)


class VideoTestCase(APITestCase):
    """Shared fixture: an instructor with a lecture, and a patched provider."""

    def setUp(self):
        self.user, self.profile = make_instructor('vid_a@test.com', 'vid_a')
        self.other, self.other_profile = make_instructor('vid_b@test.com', 'vid_b')
        self.course = make_course(self.profile)
        self.section = Section.objects.create(course=self.course, title='S', order=0)
        self.lecture = _lecture(self.section)
        self.client.force_authenticate(user=self.user)

        self.provider = FakeProvider()
        # Patch where the name is USED, not where it's defined: both modules did
        # `from .factory import get_video_provider`, so each holds its own binding.
        for target in (
            'apps.course.video.service.get_video_provider',
            'apps.course.video.signals.get_video_provider',
        ):
            patcher = patch(target, return_value=self.provider)
            patcher.start()
            self.addCleanup(patcher.stop)

    def refresh(self):
        self.lecture.refresh_from_db()
        return self.lecture


# --------------------------------------------------------------------------
# Upload signature
# --------------------------------------------------------------------------

class VideoSignatureTests(VideoTestCase):
    url = None

    def setUp(self):
        super().setUp()
        self.url = reverse('video_upload_signature')

    def test_requires_lecture_id(self):
        res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', res.data)

    def test_reserves_pending_id_and_returns_limits(self):
        res = self.client.post(self.url, {'lecture_id': self.lecture.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertIn('max_file_size', res.data)
        self.assertIn('allowed_formats', res.data)
        self.assertTrue(self.refresh().pending_video_public_id)
        self.assertEqual(res.data['public_id'], self.lecture.pending_video_public_id)

    def test_does_not_disturb_an_existing_ready_video(self):
        """Signing is not a commitment: a ready lecture keeps its video."""
        self.lecture.video_public_id = 'live/asset'
        self.lecture.video_status = 'COMPLETED'
        self.lecture.save()

        self.client.post(self.url, {'lecture_id': self.lecture.id}, format='json')

        lecture = self.refresh()
        self.assertEqual(lecture.video_public_id, 'live/asset')
        self.assertEqual(lecture.video_status, 'COMPLETED')
        self.assertEqual(lecture.duration, Decimal('4.20'))
        self.assertEqual(self.provider.destroyed, [])

    def test_second_signature_destroys_the_abandoned_pending_asset(self):
        self.client.post(self.url, {'lecture_id': self.lecture.id}, format='json')
        abandoned = self.refresh().pending_video_public_id

        self.client.post(self.url, {'lecture_id': self.lecture.id}, format='json')

        self.assertEqual(self.provider.destroyed, [abandoned])
        self.assertNotEqual(self.refresh().pending_video_public_id, abandoned)

    def test_cannot_sign_for_another_instructors_lecture(self):
        other_section = Section.objects.create(
            course=make_course(self.other_profile), title='S', order=0
        )
        other_lecture = _lecture(other_section)

        res = self.client.post(self.url, {'lecture_id': other_lecture.id}, format='json')

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        other_lecture.refresh_from_db()
        self.assertIsNone(other_lecture.pending_video_public_id)

    def test_unknown_lecture_is_404(self):
        res = self.client.post(self.url, {'lecture_id': 999999}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_unauthenticated_is_refused(self):
        self.client.force_authenticate(user=None)
        res = self.client.post(self.url, {'lecture_id': self.lecture.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)


class CloudinarySignedParamsTests(APITestCase):
    """
    What the REAL provider puts in the signed set — the FakeProvider used
    everywhere else can't catch this, because it never signs anything.

    Cloudinary recomputes the signature from the parameters its upload endpoint
    accepts. Signing one it doesn't recognise there makes the two disagree, and
    the upload then dies with 401 "Invalid Signature" *after* the whole file has
    already transferred. That is exactly what `max_file_size` did: it is an
    upload *preset* parameter, not an upload-endpoint one.
    """

    def _signed_params(self, **kwargs):
        from apps.course.video.cloudinary_provider import CloudinaryVideoProvider

        with patch('cloudinary.utils.api_sign_request', return_value='sig') as signer:
            CloudinaryVideoProvider().generate_upload_credentials('lms/lectures', **kwargs)
        return signer.call_args[0][0]

    def test_max_file_size_is_never_signed(self):
        """Regression: signing it 401'd the upload after a full transfer."""
        self.assertNotIn('max_file_size', self._signed_params(public_id='lms/lectures/x'))

    def test_allowed_formats_is_signed(self):
        """It IS a real upload parameter, so the provider enforces format for us."""
        params = self._signed_params(public_id='lms/lectures/x')
        self.assertEqual(params['allowed_formats'], settings.VIDEO_ALLOWED_FORMATS)

    def test_max_file_size_is_still_returned_to_the_client(self):
        """Not signed, but still the advertised limit the client gates on."""
        from apps.course.video.cloudinary_provider import CloudinaryVideoProvider

        with patch('cloudinary.utils.api_sign_request', return_value='sig'):
            creds = CloudinaryVideoProvider().generate_upload_credentials(
                'lms/lectures', public_id='lms/lectures/x'
            )
        self.assertEqual(creds.max_file_size, settings.VIDEO_MAX_UPLOAD_BYTES)


# --------------------------------------------------------------------------
# Confirm / promote
# --------------------------------------------------------------------------

class VideoConfirmTests(VideoTestCase):
    def _confirm(self, public_id, lecture=None):
        lecture = lecture or self.lecture
        return self.client.post(
            reverse('video_confirm', args=[lecture.id]),
            {'public_id': public_id}, format='json',
        )

    def test_promotes_pending_to_live(self):
        self.lecture.pending_video_public_id = 'new/asset'
        self.lecture.save()

        res = self._confirm('new/asset')

        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        lecture = self.refresh()
        self.assertEqual(lecture.video_public_id, 'new/asset')
        self.assertIsNone(lecture.pending_video_public_id)
        self.assertEqual(lecture.video_status, 'PROCESSING')
        self.assertTrue(res.data['has_video'])

    def test_promoting_a_replacement_destroys_only_the_superseded_asset(self):
        self.lecture.video_public_id = 'old/asset'
        self.lecture.video_status = 'COMPLETED'
        self.lecture.pending_video_public_id = 'new/asset'
        self.lecture.save()

        self._confirm('new/asset')

        self.assertEqual(self.provider.destroyed, ['old/asset'])
        self.assertEqual(self.refresh().video_public_id, 'new/asset')

    def test_first_upload_destroys_nothing(self):
        self.lecture.pending_video_public_id = 'new/asset'
        self.lecture.save()

        self._confirm('new/asset')

        self.assertEqual(self.provider.destroyed, [])

    def test_stale_public_id_is_rejected_and_changes_nothing(self):
        self.lecture.video_public_id = 'live/asset'
        self.lecture.video_status = 'COMPLETED'
        self.lecture.pending_video_public_id = 'new/asset'
        self.lecture.save()

        res = self._confirm('some/older-asset')

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        lecture = self.refresh()
        self.assertEqual(lecture.video_public_id, 'live/asset')
        self.assertEqual(lecture.video_status, 'COMPLETED')
        self.assertEqual(self.provider.destroyed, [])

    def test_missing_public_id_is_rejected(self):
        res = self.client.post(
            reverse('video_confirm', args=[self.lecture.id]), {}, format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_confirm_another_instructors_lecture(self):
        other_section = Section.objects.create(
            course=make_course(self.other_profile), title='S', order=0
        )
        other = _lecture(other_section, pending_video_public_id='new/asset')

        res = self._confirm('new/asset', lecture=other)

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        other.refresh_from_db()
        self.assertIsNone(other.video_public_id)


# --------------------------------------------------------------------------
# Delete
# --------------------------------------------------------------------------

class VideoDeleteTests(VideoTestCase):
    def _delete(self, lecture=None):
        lecture = lecture or self.lecture
        return self.client.delete(reverse('video_delete', args=[lecture.id]))

    def test_destroys_both_assets_and_resets_the_row(self):
        self.lecture.video_public_id = 'live/asset'
        self.lecture.pending_video_public_id = 'inflight/asset'
        self.lecture.video_status = 'COMPLETED'
        self.lecture.save()

        res = self._delete()

        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertCountEqual(self.provider.destroyed, ['live/asset', 'inflight/asset'])
        lecture = self.refresh()
        self.assertIsNone(lecture.video_public_id)
        self.assertIsNone(lecture.pending_video_public_id)
        self.assertEqual(lecture.video_status, 'PENDING')

    def test_leaves_instructor_owned_fields_alone(self):
        self.lecture.video_public_id = 'live/asset'
        self.lecture.video_status = 'COMPLETED'
        self.lecture.save()

        self._delete()

        lecture = self.refresh()
        self.assertEqual(lecture.duration, Decimal('4.20'))
        self.assertEqual(lecture.title, 'L')

    def test_works_while_processing(self):
        """Being mid-transcode must not strip the instructor's way out."""
        self.lecture.video_public_id = 'live/asset'
        self.lecture.video_status = 'PROCESSING'
        self.lecture.save()

        self.assertEqual(self._delete().status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.refresh().video_status, 'PENDING')

    def test_provider_failure_still_clears_the_lecture(self):
        self.provider.destroy_raises = True
        self.lecture.video_public_id = 'live/asset'
        self.lecture.video_status = 'COMPLETED'
        self.lecture.save()

        res = self._delete()

        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNone(self.refresh().video_public_id)

    def test_cannot_delete_another_instructors_video(self):
        other_section = Section.objects.create(
            course=make_course(self.other_profile), title='S', order=0
        )
        other = _lecture(other_section, video_public_id='their/asset', video_status='COMPLETED')

        res = self._delete(lecture=other)

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        other.refresh_from_db()
        self.assertEqual(other.video_public_id, 'their/asset')
        self.assertEqual(self.provider.destroyed, [])


# --------------------------------------------------------------------------
# Webhook
# --------------------------------------------------------------------------

class VideoWebhookTests(VideoTestCase):
    def setUp(self):
        super().setUp()
        self.url = reverse('video_webhook')
        self.lecture.video_public_id = 'live/asset'
        self.lecture.video_status = 'PROCESSING'
        self.lecture.save()

    def _post(self, payload, **headers):
        return self.client.post(
            self.url, data=json.dumps(payload), content_type='application/json',
            HTTP_X_CLD_SIGNATURE='sig', HTTP_X_CLD_TIMESTAMP=str(int(time.time())),
            **headers,
        )

    def _eager(self, **extra):
        payload = {
            'notification_type': 'eager', 'public_id': 'live/asset',
            'version': '1', 'eager': [{'secure_url': 'x'}],
        }
        payload.update(extra)
        return payload

    def test_completed_sets_status(self):
        res = self._post(self._eager())
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.refresh().video_status, 'COMPLETED')

    def test_converts_duration_seconds_to_minutes(self):
        """The 60x bug: 260 provider-seconds is 4.33 minutes, not 260."""
        self._post(self._eager(duration=260.0))
        self.assertEqual(self.refresh().duration, Decimal('4.33'))

    def test_clamps_an_over_long_duration_instead_of_erroring(self):
        res = self._post(self._eager(duration=99999999))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.refresh().duration, Decimal('9999.99'))

    def test_missing_duration_leaves_the_instructors_value(self):
        self._post(self._eager())
        lecture = self.refresh()
        self.assertEqual(lecture.video_status, 'COMPLETED')
        self.assertEqual(lecture.duration, Decimal('4.20'))

    def test_error_payload_sets_failed(self):
        self._post(self._eager(error={'message': 'bad codec'}))
        self.assertEqual(self.refresh().video_status, 'FAILED')

    def test_invalid_signature_is_rejected(self):
        self.provider.authentic = False
        res = self._post(self._eager())
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.refresh().video_status, 'PROCESSING')

    def test_duplicate_delivery_is_applied_once(self):
        self._post(self._eager(duration=260.0))
        # A retry that would otherwise re-run the duration write.
        Lecture.objects.filter(pk=self.lecture.pk).update(duration=Decimal('4.20'))

        res = self._post(self._eager(duration=260.0))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.refresh().duration, Decimal('4.20'))  # untouched second time
        self.assertEqual(
            ProcessedWebhookEvent.objects.filter(gateway='cloudinary_video').count(), 1
        )

    def test_non_decisive_notification_does_not_touch_status(self):
        res = self._post({
            'notification_type': 'upload', 'public_id': 'live/asset', 'version': '1',
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.refresh().video_status, 'PROCESSING')

    def test_out_of_order_notification_cannot_undo_completed(self):
        """A late upload-ack must never walk a finished lecture backwards."""
        self._post(self._eager())
        self.assertEqual(self.refresh().video_status, 'COMPLETED')

        self._post({
            'notification_type': 'upload', 'public_id': 'live/asset', 'version': '2',
        })

        self.assertEqual(self.refresh().video_status, 'COMPLETED')

    def test_late_eager_cannot_reopen_a_completed_lecture(self):
        self._post(self._eager())
        self._post(self._eager(version='2', error={'message': 'late failure'}))
        self.assertEqual(self.refresh().video_status, 'COMPLETED')

    def test_untracked_asset_is_ignored_without_error(self):
        res = self._post(self._eager(public_id='someone/else', version='9'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(self.refresh().video_status, 'PROCESSING')

    def test_promotes_from_pending_when_confirm_never_arrived(self):
        """The client is an optimisation; the webhook is the backstop."""
        self.lecture.video_public_id = None
        self.lecture.video_status = 'PENDING'
        self.lecture.pending_video_public_id = 'inflight/asset'
        self.lecture.save()

        res = self._post(self._eager(public_id='inflight/asset', duration=120.0))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        lecture = self.refresh()
        self.assertEqual(lecture.video_public_id, 'inflight/asset')
        self.assertIsNone(lecture.pending_video_public_id)
        self.assertEqual(lecture.video_status, 'COMPLETED')
        self.assertEqual(lecture.duration, Decimal('2.00'))

    def test_unparseable_body_is_swallowed(self):
        res = self.client.post(
            self.url, data='not json', content_type='application/json',
            HTTP_X_CLD_SIGNATURE='sig', HTTP_X_CLD_TIMESTAMP='1',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)


# --------------------------------------------------------------------------
# Deletion cleanup
# --------------------------------------------------------------------------

class VideoCleanupOnDeleteTests(VideoTestCase):
    def setUp(self):
        super().setUp()
        self.lecture.video_public_id = 'live/asset'
        self.lecture.pending_video_public_id = 'inflight/asset'
        self.lecture.video_status = 'COMPLETED'
        self.lecture.save()

    def test_deleting_a_lecture_destroys_its_assets(self):
        self.lecture.delete()
        self.assertCountEqual(self.provider.destroyed, ['live/asset', 'inflight/asset'])

    def test_deleting_a_section_destroys_its_lectures_assets(self):
        self.section.delete()
        self.assertCountEqual(self.provider.destroyed, ['live/asset', 'inflight/asset'])

    def test_deleting_a_course_destroys_all_nested_assets(self):
        self.course.delete()
        self.assertCountEqual(self.provider.destroyed, ['live/asset', 'inflight/asset'])

    def test_delete_survives_a_provider_failure(self):
        self.provider.destroy_raises = True
        self.lecture.delete()
        self.assertFalse(Lecture.objects.filter(pk=self.lecture.pk).exists())

    def test_lecture_without_video_needs_no_teardown(self):
        bare = _lecture(self.section, order=1)
        bare.delete()
        self.assertEqual(self.provider.destroyed, [])


# --------------------------------------------------------------------------
# Unit-level: conversion and the ordering guard
# --------------------------------------------------------------------------

class DurationConversionTests(APITestCase):
    def test_converts_and_rounds(self):
        self.assertEqual(seconds_to_minutes(260), Decimal('4.33'))
        self.assertEqual(seconds_to_minutes(120), Decimal('2.00'))
        self.assertEqual(seconds_to_minutes(7384.2), Decimal('123.07'))

    def test_clamps_both_ends(self):
        self.assertEqual(seconds_to_minutes(99999999), Decimal('9999.99'))
        self.assertEqual(seconds_to_minutes(0), Decimal('0.01'))

    def test_returns_none_for_missing_or_junk(self):
        self.assertIsNone(seconds_to_minutes(None))
        self.assertIsNone(seconds_to_minutes('abc'))


class StatusGuardTests(APITestCase):
    def test_forward_transitions_allowed(self):
        may = VideoWebhookService._may_advance
        self.assertTrue(may('PENDING', 'PROCESSING'))
        self.assertTrue(may('PROCESSING', 'COMPLETED'))
        self.assertTrue(may('PROCESSING', 'FAILED'))

    def test_completed_is_terminal_for_notifications(self):
        may = VideoWebhookService._may_advance
        self.assertFalse(may('COMPLETED', 'PROCESSING'))
        self.assertFalse(may('COMPLETED', 'PENDING'))
        self.assertFalse(may('COMPLETED', 'FAILED'))

    def test_no_sideways_or_backwards_moves(self):
        may = VideoWebhookService._may_advance
        self.assertFalse(may('PROCESSING', 'PROCESSING'))
        self.assertFalse(may('PROCESSING', 'PENDING'))


class PromoteServiceTests(VideoTestCase):
    def test_mismatched_id_raises(self):
        self.lecture.pending_video_public_id = 'a'
        self.lecture.save()
        with self.assertRaises(VideoAssetError):
            VideoLifecycleService(self.provider).promote(self.lecture, 'b')

    def test_reserve_then_promote_round_trip(self):
        credentials = VideoUploadService(self.provider).credentials_for(self.lecture)
        VideoLifecycleService(self.provider).promote(self.lecture, credentials.public_id)

        lecture = self.refresh()
        self.assertEqual(lecture.video_public_id, credentials.public_id)
        self.assertEqual(lecture.video_status, 'PROCESSING')
