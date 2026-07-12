from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.authentication.models import StudentProfile
from apps.course.models import Course

# Create your models here.
class Review(models.Model):
    user = models.ForeignKey(StudentProfile, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="reviews" , db_index=True)
    rating = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'course']  
        ordering = ['-created_at']