from datetime import timezone as dt_timezone

from rest_framework import serializers
from .models import Review
from apps.course.models import Course
from apps.course.dashboard import person_name
class ReviewSerializer(serializers.ModelSerializer):
    course_id = serializers.IntegerField(source='course.id', read_only=True)
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_thumbnail = serializers.ImageField(source='course.thumbnail', read_only=True)
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    class Meta:
        model = Review
        fields = ['id' , 'rating' , 'comment' , 'created_at' , 'updated_at' , 'course_id' , 'course_title' , 'course_thumbnail']
        read_only_fields = ['id', 'created_at', 'updated_at']

class ReviewableCourseSerializer(serializers.ModelSerializer):
    instructor_name = serializers.SerializerMethodField()
    course_id = serializers.IntegerField(source = 'id')


    class Meta:
        model = Course
        fields = ['course_id' , 'title' , 'thumbnail' , 'instructor_name' ]
    
    def get_instructor_name(self, obj):
        user = obj.instructor.user
        return f"{user.first_name} {user.last_name}"
    
class PublicReviewSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_avatar = serializers.SerializerMethodField()


    class Meta:
        model = Review
        fields = ['id' , 'rating' , 'comment' , 'created_at' , 'updated_at' ,'student_name' ,'student_avatar']
    
    def get_student_name(self, obj):
        user = obj.user.user
        return f"{user.first_name} {user.last_name}"
    
    def get_student_avatar(self, obj):
        pfp = obj.user.user.profile_picture
        return pfp


class ReviewCourseRefSerializer(serializers.ModelSerializer):

    class Meta:
        model = Course
        fields = ['id' , 'title']


class ReviewerRefSerializer(serializers.Serializer):
    """The `{name, avatar}` shape 008 already ships as `PersonRef`.

    A plain Serializer, not a ModelSerializer: it carries only method fields, and it is
    fed the whole Review via `source='*'` rather than a model instance of its own.
    """

    name = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    # `obj` is the Review, not the reviewer — see `source='*'` below. Review.user is a
    # StudentProfile, so the person is one relation further on: obj.user.user.
    def get_name(self, obj):
        # Imported from 008 rather than restated, so the displayed name and its username
        # fallback are derived in exactly one place across 008, 010 and 012 (FR-015).
        return person_name(obj.user.user)

    def get_avatar(self, obj):
        # `or None` so '' and NULL both become null and the client has one absent case
        # to handle (FR-016).
        return obj.user.user.profile_picture or None


class InstructorReviewSerializer(serializers.ModelSerializer):
    """One row of the instructor reviews feed (spec 012).

    Nothing may be added to `fields`. FR-039 and SC-007 restrict a row to the six fields
    the instructor asked for, and PrivacyTests asserts the exact key set over the raw
    response body — so a convenient extra field here fails a test rather than quietly
    exposing a student's email, orders, progress or quiz results.
    """

    # `source='*'` hands the whole Review to the nested serializer. Without it DRF looks
    # for `review.reviewer`, which does not exist — the model's field is `user`.
    reviewer = ReviewerRefSerializer(source='*', read_only=True)
    course = ReviewCourseRefSerializer(read_only=True)
    updated_at = serializers.SerializerMethodField()

    class Meta:
        model = Review
        # `id` is the REVIEW id. Review is unique per (user, course), so unlike 010's
        # roster nothing repeats across rows in either scope.
        fields = ['id' , 'rating' , 'comment' , 'updated_at', 'reviewer','course']

    def get_updated_at(self, obj):
        # A date, never a timestamp. DRF's DateField refuses a datetime outright ("Use a
        # custom read-only field and deal with timezone issues explicitly") precisely
        # because narrowing one silently picks a timezone — so the conversion is spelled
        # out here: to UTC, then to a date. FR-019 names UTC, not the project timezone.
        #
        # This is the one place 012 deviates from 008, which returns a full ISO datetime
        # for its recent-reviews list.
        return obj.updated_at.astimezone(dt_timezone.utc).date().isoformat()



