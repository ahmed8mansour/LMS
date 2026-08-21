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
from .video.factory import get_video_provider
from .video.access import can_access_lecture_video

class LectureSerializer(serializers.ModelSerializer):
    video_url = serializers.SerializerMethodField()

    class Meta:
        model = Lecture
        # video_public_id is managed by the video subsystem (assigned at
        # signature time, updated by the webhook), never written by clients.
        fields = ['id', 'section', 'title', 'duration', 'order', 'video_status', 'video_url']
        read_only_fields = ['video_status']

    def get_video_url(self, obj):
        if not obj.video_public_id or obj.video_status != 'COMPLETED':
            return None

        request = self.context.get('request')
        if not request or not can_access_lecture_video(request, obj.section.course):
            return None

        return get_video_provider().build_streaming_url(obj.video_public_id)





class QuizSerializer(serializers.ModelSerializer):

    class Meta:
        model = Quiz
        fields='__all__'
        # exclude = ['section']
    


class SectionSerializer(serializers.ModelSerializer):

    class Meta:
        model = Section
        fields='__all__'
        # exclude = ['course']

    def to_representation(self, instance):
        lectures = Lecture.objects.filter(section=instance).order_by('order')
        quiz = Quiz.objects.filter(section=instance).first()

        section_data = super().to_representation(instance)
        section_data['lectures'] = LectureSerializer(lectures, many=True, context=self.context).data
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
            'subscribers_count', 'reviews_count', 'is_published','language',
            'last_updated', 'goals_list',
            'instructor_profile', 'sections',   
            
        ]

    def get_instructor_profile(self , obj):
        try :
            instructor = obj.instructor.user
            profile_data = UserDataSerializer(instructor).data

            from apps.reviews.utils import get_instructor_rating
            rating_data = get_instructor_rating(obj.instructor)
            profile_data['avg_rating'] = rating_data['avg_rating']
            profile_data['reviews_count'] = rating_data['reviews_count']

            return profile_data
        except CustomUser.DoesNotExist:
            return None
    def get_sections(self, obj):
        sections = Section.objects.filter(course=obj)  
        if not sections.exists():
            return []
        return SectionSerializer(sections, many=True, context = self.context).data

    def to_representation(self, instance):
        return super().to_representation(instance)



class InstructorCourseSerializer(serializers.ModelSerializer):
    instructor_profile = serializers.SerializerMethodField()
    sections = serializers.SerializerMethodField()


    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'thumbnail',
            'category', 'level', 'price', 'rating',
            'subscribers_count', 'reviews_count', 'is_published','language',
            'last_updated', 'goals_list',
            'instructor_profile', 'sections',   
            
        ]
        read_only_fields = ['rating' , 'subscribers_count', 'is_published' , 'reviews_count']
        

    def get_instructor_profile(self , obj):
        try :
            instructor = obj.instructor.user
            profile_data = UserDataSerializer(instructor).data

            from apps.reviews.utils import get_instructor_rating
            rating_data = get_instructor_rating(obj.instructor)
            profile_data['avg_rating'] = rating_data['avg_rating']
            profile_data['reviews_count'] = rating_data['reviews_count']

            return profile_data
        except CustomUser.DoesNotExist:
            return None
    def get_sections(self, obj):
        sections = Section.objects.filter(course=obj)  
        if not sections.exists():
            return []
        return SectionSerializer(sections, many=True, context = self.context).data

    def to_representation(self, instance):
        return super().to_representation(instance)

