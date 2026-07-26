from rest_framework import serializers

from apps.course.models import Lecture , Section , Quiz , Question , Choice , Course
from apps.course.video.factory import get_video_provider

from apps.authentication.models import CustomUser
from apps.authentication.serializers import UserDataSerializer


# ==================================================
# 1- urls: 
# progress/student/overview/
# progress/student/courses/

class CourseOverviewSerializer(serializers.Serializer):
    id     = serializers.CharField(source='course.id')
    title     = serializers.CharField(source='course.title')
    thumbnail = serializers.ImageField(source='course.thumbnail')
    category  = serializers.CharField(source='course.category')
    progress  = serializers.FloatField()
    instructor_firstname = serializers.CharField(source='course.instructor.user.first_name')
    instructor_lastname = serializers.CharField(source='course.instructor.user.last_name')
    instructor_avatar = serializers.ImageField(source='course.instructor.user.profile_picture')
    total_lectures = serializers.IntegerField()
    lectures_completed = serializers.IntegerField()



class StudentDashboardOverviewSerializer(serializers.Serializer):
    stats = serializers.DictField()
    courses = CourseOverviewSerializer(many=True)


# ==================================================
# ==================================================
# ==================================================
# urls : 
# specific course student dashboard /
# prorgess/student/learn/course/id/





class LectureProgressSerializer(serializers.ModelSerializer):
    is_completed = serializers.SerializerMethodField()
    is_unlocked = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()

    class Meta :
        model = Lecture
        fields = ['id' , 'title' , 'duration' , 'order' , 'video_url' , 'video_status' , 'is_completed' , 'is_unlocked' ]

    def get_is_completed(self, obj):
        completed_ids = self.context.get('completed_lecture_ids', set())
        return obj.id in completed_ids

    def get_is_unlocked(self, obj):
        unlocked_ids = self.context.get('unlocked_lecture_ids', set())
        return obj.id in unlocked_ids

    def get_video_url(self, obj):
        # Enrollment + unlock access is already enforced by the view before this
        # serializer runs; here we only decide whether the asset is playable yet.
        if not obj.video_public_id or obj.video_status != 'COMPLETED':
            return None
        return get_video_provider().build_streaming_url(obj.video_public_id)

class QuizProgressSerializer(serializers.ModelSerializer):
    is_passed   = serializers.SerializerMethodField()
    is_unlocked = serializers.SerializerMethodField()

    class Meta:
        model = Quiz
        fields = ['id', 'title', 'is_passed', 'is_unlocked']

    def get_is_passed(self, obj):
        return self.context.get('is_passed', False)

    def get_is_unlocked(self, obj):
        return self.context.get('is_unlocked', False)

class SectionProgressSerializer(serializers.ModelSerializer):
    is_completed = serializers.SerializerMethodField()
    is_unlocked  = serializers.SerializerMethodField()
    lectures     = serializers.SerializerMethodField()
    quiz         = serializers.SerializerMethodField()

    class Meta : 
        model = Section
        fields = ['id' , 'title' , 'order' ,'is_completed' , 'is_unlocked'  ,  'lectures' , 'quiz' ]

    def get_is_completed(self, obj):
        completed_ids = self.context.get('completed_lecture_ids', set())
        section_lecture_ids = set(obj.lectures.values_list('id', flat=True))
        return section_lecture_ids.issubset(completed_ids) and len(section_lecture_ids) > 0

    def get_is_unlocked(self, obj):
        unlocked_section_ids = self.context.get('unlocked_section_ids', set())
        return obj.id in unlocked_section_ids
    
    def get_lectures(self, obj):
        return LectureProgressSerializer(
            obj.lectures.all(),
            many=True,
            context=self.context  
        ).data

    def get_quiz(self, obj):
        quiz = getattr(obj, 'quiz', None)
        if not quiz:
            return None
        passed_quiz_ids = self.context.get('passed_quiz_ids', set())
        unlocked_quiz_ids = self.context.get('unlocked_quiz_ids', set())
        return QuizProgressSerializer(quiz, context={
            'is_passed': quiz.id in passed_quiz_ids,
            'is_unlocked': quiz.id in unlocked_quiz_ids,
        }).data
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        for lecture in data['lectures']:
            if not lecture['is_unlocked']:
                del lecture['video_url']
        return data




class EnrolledCourseDataSerializer(serializers.ModelSerializer):
    instructor_profile = serializers.SerializerMethodField()


    class Meta:
        model = Course
        fields = [
            'id', 'title', 'description', 'thumbnail',
            'category', 'level', 'price', 'rating',
            'subscribers_count', 'reviews_count', 'is_published','language',
            'last_updated', 'goals_list',
            'instructor_profile',   
            
        ]

    def get_instructor_profile(self , obj):
        try : 
            instructor = obj.instructor.user
            return UserDataSerializer(instructor).data
        except CustomUser.DoesNotExist:
            return None



class EnrolledCourseSerializer(serializers.Serializer):
    course = EnrolledCourseDataSerializer()
    progress = serializers.CharField()
    sections = serializers.ListField()














# ─── Write Endpoint Serializers ─────────────────────────────

class LectureCompleteResponseSerializer(serializers.Serializer):
    lecture_id        = serializers.IntegerField()
    is_completed      = serializers.BooleanField()
    completed_at      = serializers.DateTimeField()
    already_completed = serializers.BooleanField()


class AnswerSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    choice_id   = serializers.IntegerField()


class MarkLectureCompleteSerializer(serializers.Serializer):
    lecture_id = serializers.IntegerField()


class QuizSubmitSerializer(serializers.Serializer):
    quiz_id = serializers.IntegerField()
    answers = AnswerSerializer(many=True)


class QuizResultItemSerializer(serializers.Serializer):
    question_id        = serializers.IntegerField()
    selected_choice_id = serializers.IntegerField()
    is_correct         = serializers.BooleanField()


class QuizSubmitResponseSerializer(serializers.Serializer):
    quiz_id         = serializers.IntegerField()
    score           = serializers.DecimalField(max_digits=5, decimal_places=2)
    passed          = serializers.BooleanField()
    total_questions = serializers.IntegerField()
    correct_answers = serializers.IntegerField()
    results         = QuizResultItemSerializer(many=True)


# =========================================
# =========================================
# =========================================
# =========================================
class ChoiceDataSerializer(serializers.ModelSerializer):
    selected = serializers.SerializerMethodField()
    correct = serializers.SerializerMethodField()

    class Meta:
        model = Choice
        fields = ['id', 'text', 'selected', 'correct']

    def get_selected(self, obj):
        if not self.context.get('passed'):
            return None

        answers_map = self.context.get('answers_map', {})
        return answers_map.get(obj.question_id) == obj.id

    def get_correct(self, obj):
        if not self.context.get('passed'):
            return None

        return obj.is_correct

class QuestionDataSerializer(serializers.ModelSerializer):
    choices = serializers.SerializerMethodField()
    
    class Meta:
        model = Question
        fields=['id', 'text','order' , 'choices']
    
    def get_choices(self , obj ):
        choices = obj.choice.all()
        choices_serializer = ChoiceDataSerializer(choices , many=True , context = self.context)
        return choices_serializer.data


class QuizDataSerializer(serializers.ModelSerializer):
    questions = serializers.SerializerMethodField()
    passed = serializers.SerializerMethodField()
    
    class Meta:
        model = Quiz
        fields=['title' , 'questions_count' , 'passed', 'questions' ]
    
    def get_questions(self , obj):
        questions = obj.question.all()
        questions_serializer = QuestionDataSerializer( questions,many=True , context = self.context)
        return questions_serializer.data
    
    def get_passed(self , obj):
        return self.context['passed']

