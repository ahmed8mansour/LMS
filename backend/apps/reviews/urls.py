from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StudentReviewViewSet,
    ReviewableCoursesView,
    CourseReviewsView,
    AdminReviewDeleteView,
    InstructorReviewsView,
)

router = DefaultRouter()
router.register('student/reviews', StudentReviewViewSet, basename='student_reviews')

urlpatterns = [
    path('', include(router.urls)),
    path('student/reviewable-courses/', ReviewableCoursesView.as_view(), name='reviewable_courses'),
    path('course/<int:course_id>/', CourseReviewsView.as_view(), name='CourseReviewsView'),
    path('admin/reviews/<int:pk>/', AdminReviewDeleteView.as_view(), name='admin_review_delete'),
    # 012 — the instructor feed. One endpoint, two scopes: `?course=<id>` is the course
    # workspace's Reviews tab, no `course` parameter is the sidebar Reviews page.
    # A plain path(), not the router: this is an APIView, not a viewset.
    path('instructor/reviews/', InstructorReviewsView.as_view(), name='instructor_reviews'),
]
