from django.urls import path
from .views import  StudentDashboardOverviewView ,QuizEnrolledStudentView, SubmitQuizView , MarkLectureCompleteView ,EnrolledSectionDetialView ,StudentDashboardCourses , EnrolledCourseDetailView
urlpatterns = [
    path('student/overview/' , StudentDashboardOverviewView.as_view(), name="homepage"),
    path('student/courses/' , StudentDashboardCourses.as_view(), name="homepage"),
    path('student/learn/course/<int:course_id>/' , EnrolledCourseDetailView.as_view(), name="homepage"),
    path('student/learn/section/<int:section_id>/' , EnrolledSectionDetialView.as_view(), name="homepage"),
    path('student/learn/lecture/markcomplete/' ,MarkLectureCompleteView.as_view() , name="mark_lecture_complete" ),
    path('student/learn/quiz/makeattempt/' ,SubmitQuizView.as_view() , name="mark_lecture_complete" ),
    path('student/learn/quiz/<int:quiz_id>/' ,QuizEnrolledStudentView.as_view() , name="get_quiz_question" ),
    
]

