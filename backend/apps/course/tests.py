from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import CustomUser, InstructorProfile
from apps.course.models import Course

LIST_URL = reverse('instructor_courses-list')


def detail_url(course_id):
    return reverse('instructor_courses-detail', args=[course_id])


def make_instructor(email, username):
    user = CustomUser.objects.create_instructor(
        email=email,
        password='pass1234',
        username=username,
        role='instructor',
        is_active=True,
    )
    # An InstructorProfile is auto-created for instructor users; fetch it.
    profile, _ = InstructorProfile.objects.get_or_create(user=user)
    return user, profile


def make_course(instructor, **overrides):
    data = dict(
        title='Existing course',
        description='desc',
        price=Decimal('10.00'),
        rating=0,
        subscribers_count=0,
        reviews_count=0,
        is_published=False,
        category='development',
        level='beginner',
        instructor=instructor,
        goals_list=[],
    )
    data.update(overrides)
    return Course.objects.create(**data)


class InstructorCourseCreateTests(APITestCase):
    def setUp(self):
        self.user, self.profile = make_instructor('a@test.com', 'instructor_a')
        self.client.force_authenticate(user=self.user)

    def test_create_with_required_metadata_defaults_server_fields(self):
        payload = {
            'title': 'Django for Beginners',
            'description': 'Learn Django',
            'price': '49.99',
            'category': 'development',
            'level': 'beginner',
            'goals_list': ['Build an app'],
        }
        res = self.client.post(LIST_URL, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        course = Course.objects.get(id=res.data['id'])
        self.assertFalse(course.is_published)
        self.assertEqual(course.rating, 0)
        self.assertEqual(course.subscribers_count, 0)
        self.assertEqual(course.reviews_count, 0)
        self.assertEqual(course.instructor, self.profile)

    def test_server_managed_fields_are_ignored_if_sent(self):
        payload = {
            'title': 'Sneaky',
            'description': 'desc',
            'price': '0',
            'category': 'business',
            'level': 'advanced',
            'goals_list': ['x'],
            'is_published': True,
            'rating': 5,
            'subscribers_count': 999,
        }
        res = self.client.post(LIST_URL, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        course = Course.objects.get(id=res.data['id'])
        self.assertFalse(course.is_published)
        self.assertEqual(course.rating, 0)
        self.assertEqual(course.subscribers_count, 0)

    def test_create_without_thumbnail_succeeds(self):
        payload = {
            'title': 'No thumb',
            'description': 'desc',
            'price': '5',
            'category': 'marketing',
            'level': 'intermediate',
            'goals_list': ['x'],
        }
        res = self.client.post(LIST_URL, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertIn(res.data['thumbnail'], (None, ''))

    def test_create_with_thumbnail_url_is_stored(self):
        url = 'https://res.cloudinary.com/demo/image/upload/v1/course.jpg'
        payload = {
            'title': 'With thumb',
            'description': 'desc',
            'price': '5',
            'category': 'development',
            'level': 'beginner',
            'goals_list': ['x'],
            'thumbnail': url,
        }
        res = self.client.post(LIST_URL, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['thumbnail'], url)


class InstructorCourseOwnershipTests(APITestCase):
    def setUp(self):
        self.user_a, self.profile_a = make_instructor('a@test.com', 'instructor_a')
        self.user_b, self.profile_b = make_instructor('b@test.com', 'instructor_b')
        self.course_b = make_course(self.profile_b, title='B owns this')
        self.client.force_authenticate(user=self.user_a)

    def test_list_is_scoped_to_owner(self):
        make_course(self.profile_a, title='A owns this')
        res = self.client.get(LIST_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        titles = [c['title'] for c in res.data]
        self.assertIn('A owns this', titles)
        self.assertNotIn('B owns this', titles)

    def test_cannot_retrieve_other_instructors_course(self):
        res = self.client.get(detail_url(self.course_b.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_patch_other_instructors_course(self):
        res = self.client.patch(detail_url(self.course_b.id), {'title': 'hacked'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cannot_delete_other_instructors_course(self):
        res = self.client.delete(detail_url(self.course_b.id))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Course.objects.filter(id=self.course_b.id).exists())


class InstructorCourseUpdateTests(APITestCase):
    def setUp(self):
        self.user, self.profile = make_instructor('a@test.com', 'instructor_a')
        self.course = make_course(
            self.profile,
            thumbnail='https://res.cloudinary.com/demo/image/upload/v1/old.jpg',
        )
        self.client.force_authenticate(user=self.user)

    def test_patch_without_thumbnail_preserves_existing(self):
        res = self.client.patch(detail_url(self.course.id), {'title': 'Renamed'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.course.refresh_from_db()
        self.assertEqual(self.course.title, 'Renamed')
        self.assertEqual(self.course.thumbnail, 'https://res.cloudinary.com/demo/image/upload/v1/old.jpg')

    def test_patch_with_new_thumbnail_replaces_it(self):
        new_url = 'https://res.cloudinary.com/demo/image/upload/v1/new.jpg'
        res = self.client.patch(detail_url(self.course.id), {'thumbnail': new_url}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.course.refresh_from_db()
        self.assertEqual(self.course.thumbnail, new_url)


class InstructorWithoutProfileTests(APITestCase):
    def test_staff_without_instructor_profile_gets_empty_list(self):
        user = CustomUser.objects.create_instructor(
            email='noprofile@test.com',
            password='pass1234',
            username='noprofile',
            role='instructor',
            is_active=True,
        )
        # Remove the auto-created profile so this account has no InstructorProfile.
        InstructorProfile.objects.filter(user=user).delete()
        self.client.force_authenticate(user=user)
        res = self.client.get(LIST_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(list(res.data), [])
