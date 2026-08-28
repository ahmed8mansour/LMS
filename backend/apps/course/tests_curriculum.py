"""005 — Curriculum builder API tests: sections, lectures, quizzes, questions, choices.

Reuses the instructor/course helpers from apps.course.tests.
"""
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.course.models import Section, Lecture, Quiz, Question, Choice
from apps.course.tests import make_instructor, make_course


def _section(course, order, title='S'):
    return Section.objects.create(course=course, title=title, order=order)


def _lecture(section, order, title='L', duration=Decimal('4.20')):
    return Lecture.objects.create(section=section, title=title, duration=duration, order=order)


class CurriculumSectionTests(APITestCase):
    def setUp(self):
        self.user, self.profile = make_instructor('sa@test.com', 'sec_a')
        self.other, self.other_profile = make_instructor('sb@test.com', 'sec_b')
        self.course = make_course(self.profile)
        self.client.force_authenticate(user=self.user)

    def test_create_auto_assigns_order_to_end(self):
        url = reverse('instructor_sections-list')
        r1 = self.client.post(url, {'course': self.course.id, 'title': 'One'}, format='json')
        r2 = self.client.post(url, {'course': self.course.id, 'title': 'Two'}, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED, r1.data)
        self.assertEqual(r1.data['order'], 0)
        self.assertEqual(r2.data['order'], 1)

    def test_reorder_stays_unique_and_gapfree(self):
        _section(self.course, 0, 'A')
        _section(self.course, 1, 'B')
        c = _section(self.course, 2, 'C')
        url = reverse('instructor_sections-detail', args=[c.id])
        res = self.client.patch(url, {'order': 0}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        orders = list(
            Section.objects.filter(course=self.course).order_by('order').values_list('id', 'order')
        )
        self.assertEqual([o for _, o in orders], [0, 1, 2])  # gap-free, unique
        self.assertEqual(orders[0][0], c.id)  # C moved to the front

    def test_cannot_touch_another_instructors_section(self):
        other_course = make_course(self.other_profile)
        other_section = _section(other_course, 0)
        url = reverse('instructor_sections-detail', args=[other_section.id])
        self.assertEqual(
            self.client.patch(url, {'title': 'x'}, format='json').status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_cascades_to_lectures(self):
        s = _section(self.course, 0)
        _lecture(s, 0)
        res = self.client.delete(reverse('instructor_sections-detail', args=[s.id]))
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Lecture.objects.filter(section_id=s.id).exists())


class CurriculumLectureTests(APITestCase):
    def setUp(self):
        self.user, self.profile = make_instructor('la@test.com', 'lec_a')
        self.course = make_course(self.profile)
        self.section = _section(self.course, 0)
        self.section2 = _section(self.course, 1)
        self.client.force_authenticate(user=self.user)

    def test_create_auto_order_and_defaults(self):
        url = reverse('instructor_lectures-list')
        ok = self.client.post(
            url, {'section': self.section.id, 'title': 'L1', 'duration': '5.00'}, format='json'
        )
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)
        self.assertEqual(ok.data['order'], 0)
        self.assertEqual(ok.data['video_status'], 'PENDING')

    def test_reorder_within_section(self):
        _lecture(self.section, 0, 'A')
        b = _lecture(self.section, 1, 'B')
        res = self.client.patch(
            reverse('instructor_lectures-detail', args=[b.id]), {'order': 0}, format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        orders = list(
            Lecture.objects.filter(section=self.section).order_by('order').values_list('id', 'order')
        )
        self.assertEqual([o for _, o in orders], [0, 1])
        self.assertEqual(orders[0][0], b.id)

    def test_cross_section_move_is_rejected(self):
        lec = _lecture(self.section, 0)
        res = self.client.patch(
            reverse('instructor_lectures-detail', args=[lec.id]),
            {'section': self.section2.id},
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST, res.data)


class CurriculumQuizTests(APITestCase):
    def setUp(self):
        self.user, self.profile = make_instructor('qa@test.com', 'quiz_a')
        self.course = make_course(self.profile)
        self.section = _section(self.course, 0)
        self.client.force_authenticate(user=self.user)

    def test_second_quiz_on_section_returns_400_not_500(self):
        url = reverse('instructor_quizzes-list')
        r1 = self.client.post(url, {'section': self.section.id, 'title': 'Q'}, format='json')
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED, r1.data)
        self.assertEqual(r1.data['questions_count'], 0)
        r2 = self.client.post(url, {'section': self.section.id, 'title': 'Dup'}, format='json')
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', r2.data)

    def test_questions_count_is_read_only(self):
        url = reverse('instructor_quizzes-list')
        r = self.client.post(
            url, {'section': self.section.id, 'title': 'Q', 'questions_count': 99}, format='json'
        )
        self.assertEqual(r.data['questions_count'], 0)  # client value ignored


class CurriculumQuestionChoiceTests(APITestCase):
    def setUp(self):
        self.user, self.profile = make_instructor('qca@test.com', 'qc_a')
        self.other, self.other_profile = make_instructor('qcb@test.com', 'qc_b')
        self.course = make_course(self.profile)
        self.section = _section(self.course, 0)
        self.quiz = Quiz.objects.create(section=self.section, title='Q', questions_count=0)
        self.client.force_authenticate(user=self.user)

    def test_add_question_updates_count(self):
        r = self.client.post(
            reverse('instructor_questions-list'), {'quiz': self.quiz.id, 'text': 'What?'}, format='json'
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.questions_count, 1)
        self.assertEqual(r.data['choices'], [])

    def test_delete_question_updates_count(self):
        q = Question.objects.create(quiz=self.quiz, text='x', order=0)
        self.quiz.questions_count = 1
        self.quiz.save()
        self.client.delete(reverse('instructor_questions-detail', args=[q.id]))
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.questions_count, 0)

    def test_list_questions_filtered_by_quiz_with_nested_choices(self):
        q = Question.objects.create(quiz=self.quiz, text='x', order=0)
        Choice.objects.create(question=q, text='a', is_correct=True)
        res = self.client.get(reverse('instructor_questions-list'), {'quiz': self.quiz.id})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(len(res.data[0]['choices']), 1)

    def test_exactly_one_correct_choice(self):
        q = Question.objects.create(quiz=self.quiz, text='x', order=0)
        curl = reverse('instructor_choices-list')
        self.client.post(curl, {'question': q.id, 'text': 'a', 'is_correct': True}, format='json')
        c2 = self.client.post(curl, {'question': q.id, 'text': 'b', 'is_correct': True}, format='json')
        self.assertEqual(c2.status_code, status.HTTP_201_CREATED, c2.data)
        correct = list(Choice.objects.filter(question=q, is_correct=True).values_list('id', flat=True))
        self.assertEqual(correct, [c2.data['id']])  # only the latest stays correct

    def test_ownership_refused_for_other_instructors_quiz(self):
        other_course = make_course(self.other_profile)
        other_section = _section(other_course, 0)
        other_quiz = Quiz.objects.create(section=other_section, title='O', questions_count=0)
        res = self.client.post(
            reverse('instructor_questions-list'), {'quiz': other_quiz.id, 'text': 'hi'}, format='json'
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class DraftVisibilityTests(APITestCase):
    """Drafts must never surface through the student endpoints (FR-018)."""

    def setUp(self):
        self.user, self.profile = make_instructor('dv@test.com', 'draft_vis')
        self.published = make_course(self.profile, title='Live', is_published=True)
        self.draft = make_course(self.profile, title='Hidden draft', is_published=False)
        self.client.force_authenticate(user=self.user)

    def test_student_list_excludes_drafts(self):
        res = self.client.get(reverse('student_courses-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [c['id'] for c in res.data['results']]
        self.assertIn(self.published.id, ids)
        self.assertNotIn(self.draft.id, ids)

    def test_student_detail_of_draft_is_404(self):
        res = self.client.get(reverse('student_courses-detail', args=[self.draft.id]))
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_student_detail_of_published_is_ok(self):
        res = self.client.get(reverse('student_courses-detail', args=[self.published.id]))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_student_sections_exclude_draft_curriculum(self):
        _section(self.draft, 0, 'Draft section')
        _section(self.published, 0, 'Live section')
        res = self.client.get(reverse('student_sections-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        titles = [s['title'] for s in res.data]
        self.assertIn('Live section', titles)
        self.assertNotIn('Draft section', titles)
