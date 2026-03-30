from django.contrib import admin
from .models import LectureProgress , QuizAttempt , QuizAttemptAnswer
# Register your models here.
admin.site.register(LectureProgress)
admin.site.register(QuizAttempt)
admin.site.register(QuizAttemptAnswer)