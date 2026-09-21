from datetime import timezone as dt_timezone

from rest_framework import serializers
from .models import Course , Section ,Lecture , Quiz , Question , Choice
from apps.authentication.models import CustomUser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from allauth.socialaccount.models import SocialAccount
from django.contrib.auth import authenticate
from rest_framework import status
from django.forms.models import model_to_dict

from apps.authentication.serializers import UserDataSerializer
from apps.enrollment.models import Enrollment
from .video.factory import get_video_provider
from .video.access import can_access_lecture_video
from .publishing import PublishReadinessService
from .dashboard.service import person_name

class LectureSerializer(serializers.ModelSerializer):
    video_url = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()

    class Meta:
        model = Lecture
        # video_public_id is managed by the video subsystem (assigned at
        # signature time, updated by the webhook), never written by clients.
        fields = ['id', 'section', 'title', 'duration', 'order', 'video_status', 'video_url', 'has_video']
        read_only_fields = ['video_status']

    def get_has_video(self, obj):
        # Whether a video asset is attached at all. Lets the client tell a
        # still-processing lecture (has_video + status != COMPLETED) apart from
        # an empty one, which video_url alone can't do (both are null there).
        return bool(obj.video_public_id)

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


class ChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ['id', 'question', 'text', 'is_correct']
        # A new choice defaults to incorrect; exactly-one-correct is enforced
        # server-side in the viewset when is_correct is set true.
        extra_kwargs = {'is_correct': {'required': False, 'default': False}}


class QuestionSerializer(serializers.ModelSerializer):
    # Choices are read nested so the quiz editor loads a question with its
    # answers in one call; writes to choices go through the choices endpoint.
    choices = ChoiceSerializer(many=True, read_only=True, source='choice')

    class Meta:
        model = Question
        fields = ['id', 'quiz', 'text', 'order', 'choices']
        # order is server-assigned/reordered; text may be blank mid-edit.
        extra_kwargs = {
            'order': {'required': False},
            'text': {'required': False, 'allow_blank': True},
        }


class InstructorQuizSerializer(serializers.ModelSerializer):
    # questions_count is server-managed (recomputed on question add/delete) and
    # read-only to instructors — never client-set (FR-009a). Kept separate from
    # the shared QuizSerializer so the admin/nested-read shapes are untouched.
    class Meta:
        model = Quiz
        fields = ['id', 'section', 'title', 'questions_count']
        read_only_fields = ['questions_count']
        # Drop the auto OneToOne uniqueness validator (both the serializer-level
        # and the field-level one on `section`) so a duplicate quiz is reported
        # as a clean {"error": ...} by the viewset instead of a field-level 400.
        validators = []
        extra_kwargs = {'section': {'validators': []}}


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


class InstructorSectionSerializer(SectionSerializer):
    # Ordering is managed server-side (auto-assign on create, atomic reorder on
    # update), so the DRF unique_together validator is dropped and `order` is
    # optional; the DB unique_together constraint remains the real guard.
    class Meta(SectionSerializer.Meta):
        validators = []
        extra_kwargs = {'order': {'required': False}}


class InstructorLectureSerializer(LectureSerializer):
    class Meta(LectureSerializer.Meta):
        validators = []
        extra_kwargs = {'order': {'required': False}}


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
    # Readiness verdict (spec 007). Instructor-only on purpose — the student
    # CourseSerializer does not carry these. Booleans only: the itemized report is
    # the readiness action's job; My Courses just needs a badge (research R6).
    is_publishable = serializers.SerializerMethodField()
    needs_attention = serializers.SerializerMethodField()


    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'thumbnail',
            'category', 'level', 'price', 'rating',
            'subscribers_count', 'reviews_count', 'is_published','language',
            'last_updated', 'goals_list',
            'instructor_profile', 'sections',
            'is_publishable', 'needs_attention',
        ]
        # is_published stays read-only: publishing is its own action and must never
        # be reachable through a metadata save (FR-003).
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

    def get_is_publishable(self, obj):
        return self._readiness.is_publishable

    def get_needs_attention(self, obj):
        return self._readiness.needs_attention

    def to_representation(self, instance):
        # Evaluate once per course and let both fields read that one verdict.
        # With many=True DRF reuses this child serializer for every item, but
        # this runs immediately before that item's fields are read, so each
        # course gets its own report.
        self._readiness = PublishReadinessService().evaluate(instance)
        return super().to_representation(instance)



class RosterCourseSerializer(serializers.ModelSerializer):
    """The course a roster row belongs to. Same shape as 008's CourseRef."""

    class Meta:
        model = Course
        fields = ['id', 'title']


class InstructorStudentSerializer(serializers.ModelSerializer):
    """One row of the instructor student roster (spec 010).

    Nothing may be added to `fields`. FR-033 and SC-005 restrict a roster to the four
    columns the instructor asked for plus the course, and RosterPrivacyTests asserts the
    exact key set over the raw response body — so a convenient extra field here fails a
    test rather than quietly exposing a student's email, orders or quiz results.
    """

    name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    enrolled_at = serializers.SerializerMethodField()
    course = RosterCourseSerializer(read_only=True)

    class Meta:
        model = Enrollment
        # `id` is the ENROLMENT id, not the student's. In the all-courses scope a student
        # enrolled in two courses produces two rows, so a student id would repeat —
        # duplicate React keys, and a client-side dedupe would silently drop a row. The
        # enrolment is the row's real identity, and it keeps the user id out of the body.
        fields = ['id', 'name', 'avatar', 'enrolled_at', 'progress', 'course']

    def get_name(self, obj):
        # Imported from the dashboard rather than restated, so the displayed name and its
        # username fallback are derived in exactly one place across 008 and 010 (FR-007).
        return person_name(obj.user)

    def get_avatar(self, obj):
        # '' and NULL both become null, so the client has one absent case to handle.
        return obj.user.profile_picture or None

    def get_enrolled_at(self, obj):
        # A date, never a timestamp. DRF's DateField refuses a datetime outright ("Use a
        # custom read-only field and deal with timezone issues explicitly") precisely
        # because narrowing one silently picks a timezone — so the conversion is spelled
        # out here: to UTC, then to a date. FR-009 names UTC, not the project timezone,
        # so this stays correct even if settings.TIME_ZONE ever changes.
        return obj.enrolled_at.astimezone(dt_timezone.utc).date().isoformat()

    def get_progress(self, obj):
        # .get() with no default: a pair missing from the map is None, which is the "no
        # lectures yet" case the client renders as an em dash. Never 0 (FR-011, SC-007).
        return self.context['progress'].get((obj.user_id, obj.course_id))
