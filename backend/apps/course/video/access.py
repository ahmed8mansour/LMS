def can_access_lecture_video(request, course) -> bool:
    """
    Whether the requesting user may receive the streaming URL for a lecture
    belonging to `course`: the course owner (instructor), any admin, or an
    actively enrolled student.

    Memoizes per-course on the request object, since a section/course response
    renders many lectures in one call and would otherwise repeat the same
    enrollment query for every lecture.
    """
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    cache = getattr(request, '_video_access_cache', None)
    if cache is None:
        cache = {}
        request._video_access_cache = cache

    if course.id in cache:
        return cache[course.id]

    is_owner = course.instructor.user_id == user.id

    if is_owner:
        cache[course.id] = True
        return True

    from apps.enrollment.models import Enrollment
    enrolled = Enrollment.objects.filter(user=user, course=course, is_active=True).exists()
    cache[course.id] = enrolled
    return enrolled
