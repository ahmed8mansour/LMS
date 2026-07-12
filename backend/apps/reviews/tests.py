from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from apps.authentication.models import CustomUser
from apps.course.models import Course, Section, Lecture
from apps.enrollment.models import Order, Enrollment
from apps.progress.models import LectureProgress

from .models import Review
from .utils import RatingComputing, StudentCoursesRating


def make_course(instructor_user, **overrides):
    defaults = dict(
        thumbnail='',
        title='Advanced UI Design Systems',
        description='Learn advanced UI design',
        price=Decimal('49.99'),
        rating=Decimal('0.0'),
        subscribers_count=0,
        reviews_count=0,
        is_published=True,
        language='english',
        category='design & UI/UX',
        level='intermediate',
        instructor=instructor_user.instructor_profile,
    )
    defaults.update(overrides)
    return Course.objects.create(**defaults)


def enroll(student_user, course):
    order = Order.objects.create(
        course=course, user=student_user, status='paid',
        amount=Decimal('49.99'), currency='USD',
        stripe_payment_intent_id='pi_test_123',
    )
    return Enrollment.objects.create(course=course, user=student_user, order=order, is_active=True)


def complete_course(student_profile, course):
    section = Section.objects.create(course=course, title='Section 1', order=1)
    lecture = Lecture.objects.create(section=section, title='Lecture 1', duration=Decimal('10.00'), video_url='https://x', order=1)
    LectureProgress.objects.create(user=student_profile, lecture=lecture, is_completed=True)
    return section, lecture


class ReviewEligibilityTests(TestCase):
    def setUp(self):
        self.instructor_user = CustomUser.objects.create_user(
            email='instructor@test.com', password='pass1234', username='instructor1',
            role='instructor', is_active=True,
        )
        self.student_user = CustomUser.objects.create_user(
            email='student@test.com', password='pass1234', username='student1',
            role='student', is_active=True,
        )
        self.course = make_course(self.instructor_user)

    def test_not_eligible_without_any_progress(self):
        section = Section.objects.create(course=self.course, title='Section 1', order=1)
        Lecture.objects.create(section=section, title='L1', duration=Decimal('5'), video_url='https://x', order=1)
        eligible = StudentCoursesRating(self.student_user.student_profile, self.course).has_completed_course()
        self.assertFalse(eligible)

    def test_not_eligible_with_no_lectures(self):
        eligible = StudentCoursesRating(self.student_user.student_profile, self.course).has_completed_course()
        self.assertFalse(eligible)

    def test_eligible_after_completing_all_lectures(self):
        complete_course(self.student_user.student_profile, self.course)
        eligible = StudentCoursesRating(self.student_user.student_profile, self.course).has_completed_course()
        self.assertTrue(eligible)

    def test_not_eligible_with_incomplete_progress_row(self):
        section = Section.objects.create(course=self.course, title='Section 1', order=1)
        lecture = Lecture.objects.create(section=section, title='L1', duration=Decimal('5'), video_url='https://x', order=1)
        LectureProgress.objects.create(user=self.student_user.student_profile, lecture=lecture, is_completed=False)
        eligible = StudentCoursesRating(self.student_user.student_profile, self.course).has_completed_course()
        self.assertFalse(eligible)


class RatingComputingTests(TestCase):
    def setUp(self):
        self.instructor_user = CustomUser.objects.create_user(
            email='instructor2@test.com', password='pass1234', username='instructor2',
            role='instructor', is_active=True,
        )
        self.course = make_course(self.instructor_user)

    def make_reviewer(self, suffix):
        return CustomUser.objects.create_user(
            email=f'student{suffix}@test.com', password='pass1234', username=f'student{suffix}',
            role='student', is_active=True,
        )

    def test_recompute_with_no_reviews_zeroes_out(self):
        RatingComputing(self.course).update_course_rating()
        self.course.refresh_from_db()
        self.assertEqual(self.course.reviews_count, 0)
        self.assertEqual(self.course.rating, Decimal('0.0'))

    def test_recompute_averages_ratings(self):
        u1 = self.make_reviewer(1)
        u2 = self.make_reviewer(2)
        Review.objects.create(user=u1.student_profile, course=self.course, rating=5)
        Review.objects.create(user=u2.student_profile, course=self.course, rating=3)

        RatingComputing(self.course).update_course_rating()
        self.course.refresh_from_db()

        self.assertEqual(self.course.reviews_count, 2)
        self.assertEqual(self.course.rating, Decimal('4.0'))


class SubmitReviewAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor_user = CustomUser.objects.create_user(
            email='instructor3@test.com', password='pass1234', username='instructor3',
            role='instructor', is_active=True,
        )
        self.course = make_course(self.instructor_user)
        self.student_user = CustomUser.objects.create_user(
            email='student3@test.com', password='pass1234', username='student3',
            role='student', is_active=True,
        )
        self.url = '/reviews/student/reviews/'

    def test_rejects_when_not_enrolled(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post(self.url, {'course_id': self.course.id, 'rating': 5})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('not enrolled', response.data['error'])

    def test_rejects_when_course_not_completed(self):
        enroll(self.student_user, self.course)
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post(self.url, {'course_id': self.course.id, 'rating': 5})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('Finish the course', response.data['error'])

    def test_instructor_account_cannot_submit_a_review_at_all(self):
        # An instructor-role account has no StudentProfile (the registration signal creates
        # exactly one profile type per role), so it can never reach the create endpoint at all.
        # This is what actually enforces FR-003 in practice for this schema; the explicit
        # instructor_profile-vs-course.instructor check in the view is defensive belt-and-braces
        # for a same-account-both-roles scenario the current model doesn't support.
        self.client.force_authenticate(user=self.instructor_user)
        response = self.client.post(self.url, {'course_id': self.course.id, 'rating': 5})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_successful_review_recomputes_course_aggregate(self):
        enroll(self.student_user, self.course)
        complete_course(self.student_user.student_profile, self.course)
        self.client.force_authenticate(user=self.student_user)

        response = self.client.post(self.url, {'course_id': self.course.id, 'rating': 4, 'comment': 'Great course'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.course.refresh_from_db()
        self.assertEqual(self.course.reviews_count, 1)
        self.assertEqual(self.course.rating, Decimal('4.0'))

    def test_duplicate_review_is_rejected_with_409(self):
        enroll(self.student_user, self.course)
        complete_course(self.student_user.student_profile, self.course)
        self.client.force_authenticate(user=self.student_user)

        first = self.client.post(self.url, {'course_id': self.course.id, 'rating': 4})
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        second = self.client.post(self.url, {'course_id': self.course.id, 'rating': 2})
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second.data['review_id'], first.data['id'])

    def test_rating_out_of_range_is_rejected(self):
        enroll(self.student_user, self.course)
        complete_course(self.student_user.student_profile, self.course)
        self.client.force_authenticate(user=self.student_user)

        response = self.client.post(self.url, {'course_id': self.course.id, 'rating': 6})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CourseReviewsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor_user = CustomUser.objects.create_user(
            email='instructor4@test.com', password='pass1234', username='instructor4',
            role='instructor', is_active=True,
        )
        self.course = make_course(self.instructor_user)
        self.url = f'/reviews/course/{self.course.id}/'

    def make_reviewer(self, suffix):
        return CustomUser.objects.create_user(
            email=f'reviewer{suffix}@test.com', password='pass1234', username=f'reviewer{suffix}',
            role='student', is_active=True,
        )

    def test_public_access_does_not_require_authentication(self):
        # no force_authenticate() here on purpose - this endpoint must be readable by anyone
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_empty_course_returns_zero_count_and_empty_results(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)
        self.assertEqual(response.data['results'], [])

    def test_page_size_is_two(self):
        for i in range(3):
            reviewer = self.make_reviewer(i)
            Review.objects.create(user=reviewer.student_profile, course=self.course, rating=5, comment=f'Review {i}')

        first_page = self.client.get(self.url)
        self.assertEqual(first_page.status_code, status.HTTP_200_OK)
        self.assertEqual(first_page.data['count'], 3)
        self.assertEqual(len(first_page.data['results']), 2)
        self.assertIsNotNone(first_page.data['next'])

        second_page = self.client.get(self.url, {'page': 2})
        self.assertEqual(second_page.status_code, status.HTTP_200_OK)
        self.assertEqual(len(second_page.data['results']), 1)
        self.assertIsNone(second_page.data['next'])

    def test_reviews_are_ordered_newest_first(self):
        reviewer1 = self.make_reviewer('a')
        reviewer2 = self.make_reviewer('b')
        older = Review.objects.create(user=reviewer1.student_profile, course=self.course, rating=3, comment='Older')
        newer = Review.objects.create(user=reviewer2.student_profile, course=self.course, rating=5, comment='Newer')

        response = self.client.get(self.url)
        ids_in_order = [r['id'] for r in response.data['results']]
        self.assertEqual(ids_in_order, [newer.id, older.id])

    def test_review_includes_student_name_and_avatar(self):
        reviewer = self.make_reviewer('c')
        reviewer.first_name = 'Jane'
        reviewer.last_name = 'Doe'
        reviewer.profile_picture = 'https://example.com/avatar.png'
        reviewer.save()
        Review.objects.create(user=reviewer.student_profile, course=self.course, rating=4, comment='Nice')

        response = self.client.get(self.url)
        review_data = response.data['results'][0]
        self.assertEqual(review_data['student_name'], 'Jane Doe')
        self.assertEqual(review_data['student_avatar'], 'https://example.com/avatar.png')

    def test_review_only_includes_reviews_for_the_requested_course(self):
        other_course = make_course(self.instructor_user, title='Other Course')
        reviewer = self.make_reviewer('d')
        Review.objects.create(user=reviewer.student_profile, course=other_course, rating=5, comment='Not this course')

        response = self.client.get(self.url)
        self.assertEqual(response.data['count'], 0)

    def test_nonexistent_course_returns_404(self):
        response = self.client.get('/reviews/course/999999/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class InstructorRatingTests(TestCase):
    def setUp(self):
        from .utils import get_instructor_rating
        self.get_instructor_rating = get_instructor_rating

        self.instructor_user = CustomUser.objects.create_user(
            email='instructor_ir@test.com', password='pass1234', username='instructor_ir',
            role='instructor', is_active=True,
        )
        self.instructor = self.instructor_user.instructor_profile

    def make_reviewer(self, suffix):
        return CustomUser.objects.create_user(
            email=f'ir_student{suffix}@test.com', password='pass1234', username=f'ir_student{suffix}',
            role='student', is_active=True,
        )

    def test_no_reviews_returns_none_avg_and_zero_count(self):
        result = self.get_instructor_rating(self.instructor)
        self.assertIsNone(result['avg_rating'])
        self.assertEqual(result['reviews_count'], 0)

    def test_aggregate_includes_only_published_courses(self):
        published = make_course(self.instructor_user, title='Published Course', is_published=True)
        unpublished = make_course(self.instructor_user, title='Unpublished Course', is_published=False)

        r1 = self.make_reviewer('1')
        r2 = self.make_reviewer('2')
        Review.objects.create(user=r1.student_profile, course=published, rating=4)
        Review.objects.create(user=r2.student_profile, course=unpublished, rating=2)

        result = self.get_instructor_rating(self.instructor)
        self.assertEqual(result['avg_rating'], 4.0)
        self.assertEqual(result['reviews_count'], 1)

    def test_aggregate_across_multiple_published_courses(self):
        course1 = make_course(self.instructor_user, title='Course A')
        course2 = make_course(self.instructor_user, title='Course B')

        r1 = self.make_reviewer('a')
        r2 = self.make_reviewer('b')
        Review.objects.create(user=r1.student_profile, course=course1, rating=5)
        Review.objects.create(user=r2.student_profile, course=course2, rating=3)

        result = self.get_instructor_rating(self.instructor)
        self.assertEqual(result['avg_rating'], 4.0)
        self.assertEqual(result['reviews_count'], 2)


class ManageReviewAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor_user = CustomUser.objects.create_user(
            email='instructor_manage@test.com', password='pass1234', username='instructor_manage',
            role='instructor', is_active=True,
        )
        self.course = make_course(self.instructor_user)
        self.student_user = CustomUser.objects.create_user(
            email='student_manage@test.com', password='pass1234', username='student_manage',
            role='student', is_active=True,
        )
        enroll(self.student_user, self.course)
        complete_course(self.student_user.student_profile, self.course)
        self.review = Review.objects.create(
            user=self.student_user.student_profile, course=self.course, rating=4, comment='Good'
        )
        RatingComputing(self.course).update_course_rating()
        self.url = f'/reviews/student/reviews/{self.review.id}/'

    def test_edit_recomputes_aggregate(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.patch(self.url, {'rating': 2})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.course.refresh_from_db()
        self.assertEqual(self.course.rating, Decimal('2.0'))

    def test_delete_removes_review_and_recomputes(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Review.objects.filter(id=self.review.id).exists())
        self.course.refresh_from_db()
        self.assertEqual(self.course.reviews_count, 0)

    def test_cannot_edit_another_users_review(self):
        other_user = CustomUser.objects.create_user(
            email='other_manage@test.com', password='pass1234', username='other_manage',
            role='student', is_active=True,
        )
        self.client.force_authenticate(user=other_user)
        response = self.client.patch(self.url, {'rating': 1})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_another_users_review(self):
        other_user = CustomUser.objects.create_user(
            email='other_manage2@test.com', password='pass1234', username='other_manage2',
            role='student', is_active=True,
        )
        self.client.force_authenticate(user=other_user)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_returns_own_reviews_with_course_fields(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/reviews/student/reviews/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        review_data = response.data[0]
        self.assertIn('course_id', review_data)
        self.assertIn('course_title', review_data)
        self.assertIn('course_thumbnail', review_data)


class AdminReviewDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.instructor_user = CustomUser.objects.create_user(
            email='instructor_admin@test.com', password='pass1234', username='instructor_admin',
            role='instructor', is_active=True,
        )
        self.course = make_course(self.instructor_user)
        self.student_user = CustomUser.objects.create_user(
            email='student_admin@test.com', password='pass1234', username='student_admin',
            role='student', is_active=True,
        )
        self.review = Review.objects.create(
            user=self.student_user.student_profile, course=self.course, rating=5, comment='Great'
        )
        RatingComputing(self.course).update_course_rating()
        self.admin_user = CustomUser.objects.create_superuser(
            email='admin@test.com', password='pass1234', username='admin_user',
        )
        self.url = f'/reviews/admin/reviews/{self.review.id}/'

    def test_admin_can_delete_any_review_and_recomputes(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Review.objects.filter(id=self.review.id).exists())
        self.course.refresh_from_db()
        self.assertEqual(self.course.reviews_count, 0)

    def test_non_admin_gets_403(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
