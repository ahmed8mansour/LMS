from django.urls import path
from .views import  StudentDashboardOverviewView ,QuizEnrolledStudentView, SubmitQuizView , MarkLectureCompleteView ,EnrolledSectionDetialView ,StudentDashboardCourses , EnrolledCourseDetailView , EnrolledLectureDetailView
urlpatterns = [
    path('student/overview/' , StudentDashboardOverviewView.as_view(), name="student_overview"),
    path('student/courses/' , StudentDashboardCourses.as_view(), name="student_courses"),
    path('student/learn/course/<int:course_id>/' , EnrolledCourseDetailView.as_view(), name="enrolled_course_detail"),
    path('student/learn/section/<int:section_id>/' , EnrolledSectionDetialView.as_view(), name="enrolled_section_detail"),
    path('student/learn/lecture/<int:lecture_id>/' , EnrolledLectureDetailView.as_view(), name="get_lecture_detail"),
    path('student/learn/lecture/markcomplete/' ,MarkLectureCompleteView.as_view() , name="mark_lecture_complete" ),
    path('student/learn/quiz/makeattempt/' ,SubmitQuizView.as_view() , name="submit_quiz" ),
    path('student/learn/quiz/<int:quiz_id>/' ,QuizEnrolledStudentView.as_view() , name="get_quiz_question" ),
]

