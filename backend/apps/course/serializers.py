from rest_framework import serializers
from .models import Course , Section ,Lecture , Quiz 
from apps.authentication.models import CustomUser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import authenticate
from rest_framework import status
from django.forms.models import model_to_dict

from apps.authentication.serializers import UserDataSerializer

class LectureSerializer(serializers.ModelSerializer):

    class Meta:
        model = Lecture
        exclude = ['section']
    



class QuizSerializer(serializers.ModelSerializer):

    class Meta:
        model = Quiz
        exclude = ['section']
    


class SectionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Section
        exclude = ['course']

    def to_representation(self, instance):
        lectures = Lecture.objects.filter(section=instance).order_by('order')
        quiz = Quiz.objects.filter(section=instance).first()

        section_data = super().to_representation(instance)
        section_data['lectures'] = LectureSerializer(lectures, many=True).data
        section_data['quiz'] = QuizSerializer(quiz).data if quiz else None    

        return section_data

class CourseSerializer(serializers.ModelSerializer):
    instructor_profile = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()


    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'thumbnail',
            'category', 'level', 'price', 'rating',
            'subscribers_count', 'reviews_count', 'is_published',
            'last_updated', 'goals_list',
            'instructor_profile', 'sections',        
        ]

    def get_instructor_profile(self , obj):
        try : 
            instructor = obj.instructor.user
            
            return UserDataSerializer(instructor).data
        except CustomUser.DoesNotExist:
            return None
    def get_sections(self, obj):
        sections = Section.objects.filter(course=obj)  
        if not sections.exists():
            return []
        return SectionSerializer(sections, many=True, context = self.context).data

    def to_representation(self, instance):
        return super().to_representation(instance)



