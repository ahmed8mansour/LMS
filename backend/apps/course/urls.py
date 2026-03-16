from django.urls import path, include
from .views import  AdminCourseViewSet , AdminLectureViewSet , AdminSectionViewSet , AdminQuizViewSet
from .views import InstructorCourseViewSet , InstructorLectureViewSet , InstructorSectionViewSet , InstructorQuizViewSet
from .views import StudentCourseViewSet , StudentSectionViewSet , StudentLectureViewSet , StudentQuizViewSet , StudentCourseView
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register('admin/courses' , AdminCourseViewSet , basename='admin_courses') 
router.register('admin/sections' , AdminSectionViewSet , basename='admin_sections') 
router.register('admin/lectures' , AdminLectureViewSet , basename='admin_lectures') 
router.register('admin/quizzes' , AdminQuizViewSet , basename='admin_quizzes') 




router.register('instructor/courses' , InstructorCourseViewSet , basename='instructor_courses') 
router.register('instructor/sections' , InstructorSectionViewSet , basename='instructor_sections') 
router.register('instructor/lectures' , InstructorLectureViewSet , basename='instructor_lectures') 
router.register('instructor/quizzes' , InstructorQuizViewSet , basename='instructor_quizzes') 



router.register('student/courses' , StudentCourseViewSet , basename='student_courses') 
router.register('student/sections' , StudentSectionViewSet , basename='student_sections') 
router.register('student/lectures' , StudentLectureViewSet , basename='student_lectures') 
router.register('student/quizzes' , StudentQuizViewSet , basename='student_quizzes') 



urlpatterns = [
    path('' , include(router.urls)),
    path('student/homepage/' , StudentCourseView.as_view() , name="homepage")
]







# urls already set by the viewset: 

# | Method | Endpoint | Function |
# | --- | --- | --- |
# | GET | /courses | list |
# | POST | /courses | create |
# | GET | /courses/1 | retrieve |
# | PUT | /courses/1 | update |
# | PATCH | /courses/1 | partial update |
# | DELETE | /courses/1 | delete |