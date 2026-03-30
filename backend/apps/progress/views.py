from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Sum

from apps.authentication.utils import CookieJWTAuthentication
from apps.authentication.models import StudentProfile
from django.utils import timezone

from apps.course.models import Lecture , Section , Quiz , Question , Choice
from apps.enrollment.models import Enrollment
from django.conf import settings


from .serializers import (
    StudentDashboardOverviewSerializer , SectionProgressSerializer ,
    CourseOverviewSerializer , EnrolledCourseSerializer ,
    LectureCompleteResponseSerializer , QuizSubmitSerializer , QuizSubmitResponseSerializer,
    QuizDataSerializer 
)
from .models import LectureProgress , QuizAttempt , QuizAttemptAnswer
from .utils import get_student_sorted_courses , is_section_unlocked , is_lecture_unlocked , is_quiz_unlocked , get_section_progress
from rest_framework.generics import RetrieveAPIView

class StudentDashboardOverviewView(APIView):
    authentication_classes =[CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self , request):
        user = request.user
        user_profile = StudentProfile.objects.get(user=user)
        user_enrollments = Enrollment.objects.filter(user=user , is_active=True).select_related('course')

        if not user_enrollments.exists():
            return Response({"error":"You didn't joined any courses yet"},status=status.HTTP_204_NO_CONTENT)


        # _____stats_____________________

        # getting : total mins_spent
        completed_lectures = LectureProgress.objects.filter(
            user=user_profile,
            is_completed=True
        ).select_related('lecture')

        total_mins_spent = completed_lectures.aggregate(
            total=Sum('lecture__duration')
        )['total'] or 0

        # _____stats_____________________

        sorted_courses = get_student_sorted_courses(user, user_enrollments, completed_lectures)

        completed_courses  = sum(1 for c in sorted_courses if c['progress'] == 100)
        inprogress_courses = sum(1 for c in sorted_courses if c['progress'] != 100)

        data = {
            'stats':{
                    'completed_courses': completed_courses,
                    'inprogress_courses': inprogress_courses,
                    'total_mins_spent': total_mins_spent,
            },
            'courses' : sorted_courses
        }

        serializer = StudentDashboardOverviewSerializer(data)

        return Response(serializer.data , status=status.HTTP_200_OK)

        
class StudentDashboardCourses(APIView):
    authentication_classes =[CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self , request):
        user = request.user
        user_profile = StudentProfile.objects.get(user=user)
        user_enrollments = Enrollment.objects.filter(user=user , is_active=True).select_related('course')

        if not user_enrollments.exists():
            return Response({"error":"You didn't joined any courses yet"},status=status.HTTP_204_NO_CONTENT)



        # getting : total mins_spent
        completed_lectures = LectureProgress.objects.filter(
            user=user_profile,
            is_completed=True
        ).select_related('lecture')



        sorted_courses = get_student_sorted_courses(user, user_enrollments, completed_lectures)


        serializer = CourseOverviewSerializer(sorted_courses , many=True)

        return Response(serializer.data , status=status.HTTP_200_OK)



# ===========================================
# ===========================================
# ===========================================


class EnrolledCourseDetailView(APIView):

    authentication_classes =[CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self , request , course_id):
        user = request.user
        user_profile = StudentProfile.objects.get(user=user)
        enrollment = Enrollment.objects.filter(user=user , is_active=True , course = course_id).select_related('course').first()

        if not enrollment:
            return Response({"error":"You are not enrolled in this course"},status=status.HTTP_403_FORBIDDEN)
        
        course = enrollment.course

        sections = Section.objects.filter(course=course).prefetch_related('lectures','quiz').order_by('order')
        
        progress_data = get_section_progress(user_profile, sections)

        total_lectures  = Lecture.objects.filter(section__course=course).count()
        completed_count = len(progress_data['completed_lecture_ids'])
        
        sections_serializer = SectionProgressSerializer(
            sections,
            many=True,
            context=progress_data
        )

        data = {
            'course': course,
            'progress': round(completed_count / total_lectures * 100, 1) if total_lectures > 0 else 0,
            'sections': sections_serializer.data,
        }

        serializer = EnrolledCourseSerializer(data)
        return Response(serializer.data , status=status.HTTP_200_OK)
    

class EnrolledSectionDetialView(APIView):
    authentication_classes =[CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self , request , section_id):
        user = request.user
        user_profile = StudentProfile.objects.get(user=user)

        section = Section.objects.filter(id=section_id).first()
        if not section:
            return Response({'error':'Section Not Found'} , status=status.HTTP_404_NOT_FOUND)

        enrollment = Enrollment.objects.filter(user=user , course=section.course , is_active=True).first()
        if not enrollment:
            return Response({"error":"You don't have access to this course"} , status=status.HTTP_403_FORBIDDEN)

        if not is_section_unlocked(user_profile, section):
            return Response({"error":"This section is locked"} , status=status.HTTP_403_FORBIDDEN)

        progress_data = get_section_progress(user_profile, section)

        serializer = SectionProgressSerializer(
            section,
            context=progress_data
        )

        return Response(serializer.data, status=status.HTTP_200_OK)



class MarkLectureCompleteView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """
        authenticated
        post : 
        body : {
        lecture : id,
        }
        """
        user_profile = StudentProfile.objects.get(user=request.user)
        data = request.data
        lecture_id = data['lecture']
        if not lecture_id :
            return Response({"error": "please provide the id of the lecture "}, status=status.HTTP_404_NOT_FOUND)
            
        lecture = Lecture.objects.select_related('section__course').filter(id=lecture_id).first()
        if not lecture:
            return Response({"error": "Lecture not found"}, status=status.HTTP_404_NOT_FOUND)

        enrollment = Enrollment.objects.filter(user=request.user, course=lecture.section.course, is_active=True).first()
        if not enrollment:
            return Response({"error": "You are not enrolled in this course"}, status=status.HTTP_403_FORBIDDEN)

        if not is_lecture_unlocked(user_profile, lecture):
            return Response({"error": "This lecture is locked"}, status=status.HTTP_403_FORBIDDEN)

        progress, created = LectureProgress.objects.get_or_create(
            user=user_profile, lecture=lecture,
            defaults={'is_completed': True}
        )

        already_completed = not created and progress.is_completed

        if not created and not progress.is_completed:
            progress.is_completed = True
            progress.save()

        serializer = LectureCompleteResponseSerializer({
            'lecture_id': lecture.id,
            'is_completed': True,
            'completed_at': progress.completed_at,
            'already_completed': already_completed,
        })
        return Response(serializer.data, status=status.HTTP_200_OK)


class SubmitQuizView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    """
        authenticated
        post :
        data : {
        quiz_id : 1, 
        answers : [
            {"question_id" : 1 , "choice_id" : 1},
            {"question_id" : 2 , "choice_id" : 2},
            {"question_id" : 3 , "choice_id" : 1},
            {"question_id" : 4 , "choice_id" : 2},
            ]
        }
    """

    def post(self, request):
        user_profile = StudentProfile.objects.get(user=request.user)
        quiz_id = request.data['quiz_id']
        if not quiz_id:
            return Response({"error": "please provide the id of the quiz"}, status=status.HTTP_404_NOT_FOUND)

        quiz = Quiz.objects.select_related('section__course').filter(id=quiz_id).first()
        if not quiz:
            return Response({"error": "Quiz not found"}, status=status.HTTP_404_NOT_FOUND)

        enrollment = Enrollment.objects.filter(user=request.user, course=quiz.section.course, is_active=True).first()
        if not enrollment:
            return Response({"error": "You are not enrolled in this course"}, status=status.HTTP_403_FORBIDDEN)

        if not is_quiz_unlocked(user_profile, quiz):
            return Response({"error": "Quiz is locked. Complete all lectures first."}, status=status.HTTP_403_FORBIDDEN)
        

        if QuizAttempt.objects.filter(user = user_profile , quiz=quiz_id , passed=True).exists():
            return Response({"error": "You are passed with this quiz"}, status=status.HTTP_208_ALREADY_REPORTED)


        serializer = QuizSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answers_data = serializer.validated_data['answers']

        questions = Question.objects.filter(quiz=quiz).prefetch_related('choice_set')
        question_map = {q.id: q for q in questions}
        question_ids = set(question_map.keys())

        submitted_question_ids = set(a['question_id'] for a in answers_data)
        if submitted_question_ids != question_ids:
            missing = question_ids - submitted_question_ids
            extra = submitted_question_ids - question_ids
            errors = {}
            if missing:
                errors['missing_questions'] = list(missing)
            if extra:
                errors['invalid_questions'] = list(extra)
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)


        choice_map = {}
        correct_choices = {}
        for question in questions:
            for choice in question.choice_set.all():
                choice_map[(question.id , choice.id)] = choice
                if choice.is_correct:
                    correct_choices[(question.id , choice.id)] = choice

        for answer in answers_data:
            if (answer['question_id'] , answer['choice_id']) not in choice_map:
                return Response(
                    {"error": f"Choice {answer['choice_id']} does not belong to question {answer['question_id']}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        correct_count = 0
        results = []
        for answer in answers_data:
            if (answer['question_id'] , answer['choice_id']) in correct_choices:
                correct_count += 1
                results.append({
                    'question_id': answer['question_id'],
                    'selected_choice_id': answer['choice_id'],
                    'is_correct': True,
                })
            else:
                results.append({
                    'question_id': answer['question_id'],
                    'selected_choice_id': answer['choice_id'],
                    'is_correct': False,
                })

        score = round(correct_count / len(questions) * 100, 2)
        passed = score >= settings.QUIZ_PASS_THRESHOLD


        with transaction.atomic():
            attempt = QuizAttempt.objects.create(
                user=user_profile, quiz=quiz, score=score, passed=passed
            )
            QuizAttemptAnswer.objects.bulk_create([
                QuizAttemptAnswer(
                    attempt=attempt,
                    question_id=r['question_id'],
                    selected_choice_id=r['selected_choice_id'],
                    is_correct=r['is_correct'],
                ) for r in results
            ])

        response_serializer = QuizSubmitResponseSerializer({
            'quiz_id': quiz.id,
            'score': score,
            'passed': passed,
            'total_questions': len(questions),
            'correct_answers': correct_count,
            'results': results,
        })
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class QuizEnrolledStudentView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]


    def get(self , request , quiz_id):
        user_profile = StudentProfile.objects.get(user=request.user)
        quiz = Quiz.objects.select_related('section__course').prefetch_related(
            'question__choice'
        ).filter(id=quiz_id).first()
        
        if not quiz:
            return Response({"error": "Quiz not found"}, status=status.HTTP_404_NOT_FOUND)

        enrollment = Enrollment.objects.filter(user=request.user, course=quiz.section.course, is_active=True).first()
        if not enrollment:
            return Response({"error": "You are not enrolled in this course"}, status=status.HTTP_403_FORBIDDEN)

        if not is_quiz_unlocked(user_profile, quiz):
            return Response({"error": "Quiz is locked. Complete all lectures first."}, status=status.HTTP_403_FORBIDDEN)
        
        passed = QuizAttempt.objects.filter(user = user_profile , quiz = quiz , passed = True).exists()
        answers_map = {}

        if passed :
            attempt = QuizAttempt.objects.filter(user=user_profile , quiz=quiz).prefetch_related('quizattemptanswer').last()
            
            answers_map = {
                ans.question_id: ans.selected_choice_id
                for ans in attempt.quizattemptanswer.all()
            }
            
            serializer = QuizDataSerializer(
                quiz,
                context={
                    'passed': passed,
                    'answers_map': answers_map
                }
            )        
        else : 
            serializer = QuizDataSerializer(quiz , context = {'passed':passed})

        return Response(serializer.data , status=status.HTTP_200_OK)