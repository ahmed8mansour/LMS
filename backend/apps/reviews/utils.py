from apps.course.models import Course , Lecture
from apps.authentication.models import StudentProfile, InstructorProfile
from apps.progress.models import LectureProgress
from .models import Review
from django.db.models import Avg, Count
from django.db import transaction

class RatingComputing:

    def __init__(self , course : Course):
        self.course = course

    def __recalculate_course_rating(self) -> dict:
        reviews_stats = Review.objects.filter(course = self.course).aggregate(avg_rating=Avg('rating') , reviews_count=Count('id'))
        return reviews_stats
    
    def update_course_rating(self) :
        reviews_stats = self.__recalculate_course_rating()
        avg_rating , reviews_count = reviews_stats.values()

        with transaction.atomic():
            self.course.rating = round(avg_rating , 1) if avg_rating is not None else 0.0
            self.course.reviews_count = reviews_count
            self.course.save(update_fields=["reviews_count" , "rating"])

class StudentCoursesRating:
    def __init__(self , student_profile : StudentProfile , course : Course):
        self.student_profile = student_profile
        self.course = course

    def has_completed_course(self) -> bool :
        total = Lecture.objects.filter(section__course = self.course).aggregate(total_lectures= Count('id'))
        total_lectures = total['total_lectures']

        completed = LectureProgress.objects.filter(user=self.student_profile ,is_completed=True , lecture__section__course = self.course ).aggregate(completed_lectures= Count('id'))
        completed_lectures = completed['completed_lectures']

        if total_lectures > 0:
            return total_lectures == completed_lectures
        else :
            return False


def get_instructor_rating(instructor: InstructorProfile) -> dict:
    stats = Review.objects.filter(
        course__instructor=instructor,
        course__is_published=True,
    ).aggregate(avg_rating=Avg('rating'), reviews_count=Count('id'))

    avg = stats['avg_rating']
    return {
        'avg_rating': round(avg, 1) if avg is not None else None,
        'reviews_count': stats['reviews_count'],
    }