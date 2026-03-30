from apps.course.models import Course , Lecture , Section
from apps.authentication.models import  StudentProfile
from .models import LectureProgress ,QuizAttempt


def is_section_unlocked(user_profile, section):
    if section.order == 1:
        return True

    prev_section = Section.objects.filter(
        course=section.course, order=section.order - 1
    ).first()

    if not prev_section:
        return True

    prev_section_lecture_ids = set(
        Lecture.objects.filter(section=prev_section).values_list('id', flat=True)
    )
    prev_section_completed_ids = set(
        LectureProgress.objects.filter(
            user=user_profile,
            is_completed=True,
            lecture__section=prev_section
        ).values_list('lecture_id', flat=True)
    )

    return len(prev_section_lecture_ids) > 0 and prev_section_lecture_ids.issubset(prev_section_completed_ids)


def is_lecture_unlocked(user_profile, lecture):
    if not is_section_unlocked(user_profile, lecture.section):
        return False

    if lecture.order == 1:
        return True

    prev_lecture = Lecture.objects.filter(
        section=lecture.section, order=lecture.order - 1
    ).first()

    if not prev_lecture:
        return True

    return LectureProgress.objects.filter(
        user=user_profile, lecture=prev_lecture, is_completed=True
    ).exists()


def is_quiz_unlocked(user_profile, quiz):
    section = quiz.section
    if not is_section_unlocked(user_profile, section):
        return False

    section_lecture_ids = set(
        Lecture.objects.filter(section=section).values_list('id', flat=True)
    )
    completed_ids = set(
        LectureProgress.objects.filter(
            user=user_profile,
            is_completed=True,
            lecture__section=section
        ).values_list('lecture_id', flat=True)
    )

    return len(section_lecture_ids) > 0 and section_lecture_ids.issubset(completed_ids)


def get_section_progress(user_profile, sections):
    """
    sections: queryset or list of Section objects (ممكن section واحد أو عدة)
    """

    # لو جاي section واحد نحوله list
    if not hasattr(sections, '__iter__'):
        sections = [sections]

    course_ids = {section.course for section in sections}

    completed_lecture_ids = set(
        LectureProgress.objects.filter(
            user=user_profile,
            is_completed=True,
            lecture__section__course__in=course_ids
        ).values_list('lecture_id', flat=True)
    )

    passed_quiz_ids = set(
        QuizAttempt.objects.filter(
            user=user_profile,
            passed=True,
            quiz__section__course__in=course_ids
        ).values_list('quiz_id', flat=True)
    )

    unlocked_lecture_ids = {
        lecture.id
        for section in sections
        for lecture in section.lectures.all()
        if is_lecture_unlocked(user_profile, lecture)
    }

    unlocked_section_ids = {
        section.id
        for section in sections
        if is_section_unlocked(user_profile, section)
    }

    return {
        'completed_lecture_ids': completed_lecture_ids,
        'unlocked_lecture_ids': unlocked_lecture_ids,
        'passed_quiz_ids': passed_quiz_ids,
        'unlocked_section_ids': unlocked_section_ids,
    }


def get_student_sorted_courses(user, enrollments, completed_lectures):

    courses_data = []

    for enrollment in enrollments:
        course = enrollment.course

        total_count = Lecture.objects.filter(
            section__course=course
        ).count()

        completed_count = completed_lectures.filter(
            lecture__section__course=course
        ).count()

        progress = round((completed_count / total_count * 100), 1) if total_count > 0 else 0

        courses_data.append({
            'course'  : course,
            'progress': progress,
        })

    return sorted(
        courses_data,
        key=lambda x: (x['progress'] == 100, -x['progress'])
    )