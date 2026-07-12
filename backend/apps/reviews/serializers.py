from rest_framework import serializers
from .models import Review
from apps.course.models import Course

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