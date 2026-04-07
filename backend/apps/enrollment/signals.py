from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from .models import Enrollment
from apps.course.models import Course
from apps.authentication.models import InstructorProfile

@receiver(post_save, sender=Enrollment)
def update_course_subscribers_on_save(sender, instance, created, **kwargs):
    if created:
        # استخدام F expression لتجنب مشاكل التزامن (Race Conditions)
        Course.objects.filter(id=instance.course.id).update(
            subscribers_count=F('subscribers_count') + 1
        )
        InstructorProfile.objects.filter(user=instance.course.instructor.user).update(
            students_count=F('students_count') + 1
        )

@receiver(post_delete, sender=Enrollment)
def update_course_subscribers_on_delete(sender, instance, **kwargs):
    Course.objects.filter(id=instance.course.id).update(
        subscribers_count=F('subscribers_count') - 1,
    )
    InstructorProfile.objects.filter(user=instance.course.instructor.user).update(
            students_count=F('students_count') - 1
        )
