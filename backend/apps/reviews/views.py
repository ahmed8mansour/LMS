from rest_framework.response import Response
from rest_framework import status, mixins, viewsets
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import get_object_or_404 , ListAPIView
from django.db import transaction

from apps.authentication.utils import CookieJWTAuthentication
from apps.authentication.models import StudentProfile
from apps.course.models import Course
from apps.enrollment.models import Enrollment
from apps.course.permissions import isAdmin

from .models import Review
from .serializers import ReviewSerializer, ReviewableCourseSerializer , PublicReviewSerializer
from .utils import RatingComputing, StudentCoursesRating
from .pagination import ReviewPageNumberPagination

class StudentReviewViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CookieJWTAuthentication]

    def get_queryset(self):
        student_profile = get_object_or_404(StudentProfile, user=self.request.user)
        return Review.objects.filter(user=student_profile).select_related('course')

    def perform_update(self, serializer):
        instance = serializer.save()
        RatingComputing(instance.course).update_course_rating()

    def perform_destroy(self, instance):
        course = instance.course
        instance.delete()
        RatingComputing(course).update_course_rating()

    def create(self, request, *args, **kwargs):
        course_id = request.data.get('course_id')
        if not course_id:
            return Response({"course_id": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST)

        course = get_object_or_404(Course, pk=course_id)

        try:
            student_profile = StudentProfile.objects.get(user=request.user)
        except StudentProfile.DoesNotExist:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        if not Enrollment.objects.filter(user=request.user, course=course, is_active=True).exists():
            return Response({"error": "You are not enrolled in this course."}, status=status.HTTP_403_FORBIDDEN)

        if not StudentCoursesRating(student_profile, course).has_completed_course():
            return Response({"error": "Finish the course before reviewing it."}, status=status.HTTP_403_FORBIDDEN)

        if hasattr(request.user, 'instructor_profile') and course.instructor_id == request.user.instructor_profile.id:
            return Response({"error": "You cannot review your own course."}, status=status.HTTP_403_FORBIDDEN)

        existing_review = Review.objects.filter(user=student_profile, course=course).first()
        if existing_review:
            return Response(
                {"error": "You already reviewed this course.", "review_id": existing_review.id},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            serializer.save(user=student_profile, course=course)
            RatingComputing(course).update_course_rating()

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class ReviewableCoursesView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            student_profile = StudentProfile.objects.get(user=request.user)
        except StudentProfile.DoesNotExist:
            return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)

        enrolled_course_ids = Enrollment.objects.filter(
            user=request.user, is_active=True
        ).values_list('course_id', flat=True)

        reviewed_course_ids = Review.objects.filter(
            user=student_profile
        ).values_list('course_id', flat=True)

        candidate_courses = Course.objects.filter(
            id__in=list(enrolled_course_ids)
        ).exclude(id__in=list(reviewed_course_ids)).select_related('instructor__user')

        reviewable = [
            course for course in candidate_courses
            if StudentCoursesRating(student_profile, course).has_completed_course()
        ]

        serializer = ReviewableCourseSerializer(reviewable, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

class CourseReviewsView(ListAPIView):
    pagination_class = ReviewPageNumberPagination
    serializer_class = PublicReviewSerializer

    # no need to add the average
    # because already this data will be read from the course data (rating , reviews_count)

    def get_queryset(self):
        course_id = self.kwargs['course_id']
        course = get_object_or_404(Course, id=course_id)
        return Review.objects.filter(course=course)


class AdminReviewDeleteView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated, isAdmin]

    def delete(self, request, pk):
        review = get_object_or_404(Review, pk=pk)
        course = review.course
        review.delete()
        RatingComputing(course).update_course_rating()
        return Response(status=status.HTTP_204_NO_CONTENT)

