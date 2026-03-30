from django.db import models

from apps.authentication.models import StudentProfile
from apps.course.models import Course , Lecture , Quiz , Question , Choice
# Create your models here.

class LectureProgress(models.Model):
    user           = models.ForeignKey(StudentProfile, on_delete=models.CASCADE)
    lecture        = models.ForeignKey(Lecture, on_delete=models.CASCADE)
    is_completed   = models.BooleanField(default=False)
    completed_at   = models.DateTimeField(null=True, blank=True , auto_now_add=True)

    class Meta:
        unique_together = ['user', 'lecture']  
    
    def __str__(self):
        return f"{self.lecture}"

class QuizAttempt(models.Model):
    user       = models.ForeignKey(StudentProfile, on_delete=models.CASCADE)
    quiz       = models.ForeignKey(Quiz, on_delete=models.CASCADE , related_name="quizattempt")
    score      = models.DecimalField(max_digits=5, decimal_places=2)
    passed     = models.BooleanField(default=False)
    attempted_at = models.DateTimeField(auto_now_add=True)


class QuizAttemptAnswer(models.Model):
    attempt          = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE , related_name="quizattemptanswer")
    question         = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_choice  = models.ForeignKey(Choice, on_delete=models.CASCADE)
    is_correct       = models.BooleanField()