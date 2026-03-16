from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import random
import string
import secrets


class Course(models.Model):
    thumbnail = models.ImageField(upload_to='LMS/courses/thumbnail')
    title = models.CharField(max_length=255)
    description = models.CharField(max_length=255)
    price = models.DecimalField(decimal_places=2 , max_digits=6)
    rating = models.DecimalField(decimal_places=1 , max_digits=6)
    subscribers_count = models.IntegerField()
    reviews_count = models.IntegerField()
    is_published = models.BooleanField()
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    language = models.CharField(max_length=255 ,blank=True )

    category = models.CharField(max_length=255, choices=[
        ('development', 'development'),
        ('business', 'business'),
        ('design & UI/UX', 'design & UI/UX'),
        ('marketing', 'marketing'),
    ])

    level = models.CharField(max_length=255, choices=[
        ('beginner', 'beginner'),
        ('intermediate', 'intermediate'),
        ('advanced', 'advanced'),
    ])
    instructor = models.ForeignKey('authentication.InstructorProfile' , on_delete=models.CASCADE)
    goals_list = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-created_at', 'id']

    def __str__(self):
        return f"{self.id}/ {self.title} by instructor: {self.instructor}"


class Section(models.Model):
    course = models.ForeignKey('Course' , on_delete=models.CASCADE)
    title=models.CharField( max_length=255 )
    order = models.IntegerField()

    class Meta:
        unique_together = ['course', 'order']
        ordering = ['order']  

    def __str__(self):
        return f"{self.id}/ {self.title} , the order: {self.order}"


class Lecture(models.Model):
    section = models.ForeignKey('Section' , on_delete=models.CASCADE)
    title=models.CharField( max_length=255 )    
    duration = models.DecimalField(max_digits=6 , decimal_places=2)
    video_url = models.CharField(max_length=255555)
    order = models.IntegerField()
    
    class Meta:
        unique_together = ['section', 'order']
        ordering = ['order']  

    def __str__(self):
        return f"{self.id}/  {self.title} , the order: {self.order}"


class Quiz(models.Model):
    section = models.OneToOneField('Section' , on_delete=models.CASCADE)
    title=models.CharField( max_length=255 )    
    questions_count = models.IntegerField()

    def __str__(self):
        return f"{self.id}/ {self.title}"

