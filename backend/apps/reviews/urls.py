from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StudentReviewViewSet, ReviewableCoursesView, CourseReviewsView, AdminReviewDeleteView

router = DefaultRouter()
router.register('student/reviews', StudentReviewViewSet, basename='student_reviews')

urlpatterns = [
    path('', include(router.urls)),
    path('student/reviewable-courses/', ReviewableCoursesView.as_view(), name='reviewable_courses'),
    path('course/<int:course_id>/', CourseReviewsView.as_view(), name='CourseReviewsView'),
    path('admin/reviews/<int:pk>/', AdminReviewDeleteView.as_view(), name='admin_review_delete'),
]
