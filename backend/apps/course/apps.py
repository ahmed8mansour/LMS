from django.apps import AppConfig


class CourseConfig(AppConfig):
    name = 'apps.course'

    def ready(self):
        # Registers the post_delete hook that tears down a lecture's Cloudinary
        # assets, so deleting a lecture/section/course doesn't leak paid media.
        from .video import signals  # noqa: F401
