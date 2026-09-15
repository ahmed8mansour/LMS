# FIX: `from models import ...` only works if `models` were a top-level module;
# inside this package it raised ModuleNotFoundError on import.
from apps.course.models import Course, Quiz
from .dto import ReadinessReport, ReadinessItem


class PublishReadinessService:

    def evaluate(self, course: Course) -> ReadinessReport:
        # FIX: the lists are reset on every call instead of being passed into
        # __init__. One instance can evaluate many courses (the My Courses list)
        # or the same course twice (CoursePublishingService, before and after the
        # flip), so blockers must never carry over between calls. Rebind — don't
        # .clear() — so a report already returned keeps its own copy.
        self.blockers = []
        self.advisories = []

        # FIX: both helpers need the course passed in.
        self._find_blockers(course)
        self._find_advisories(course)

        # FIX: was inverted (`if not self.blockers: is_publishable = False`).
        # Publishable means exactly "no blockers".
        is_publishable = not self.blockers
        status = 'published' if course.is_published else 'draft'

        # FIX: evaluate() returned None; it must return the report.
        return ReadinessReport(
            status=status,
            is_publishable=is_publishable,
            needs_attention=status == 'published' and not is_publishable,
            blockers=tuple(self.blockers),
            advisories=tuple(self.advisories),
        )

    def _find_blockers(self, course: Course):

        # --------------------------------------------------
        # Course-level checks
        # --------------------------------------------------

        if not course.thumbnail:
            self.blockers.append(
                ReadinessItem(
                    code="missing_thumbnail",
                    severity="blocking",
                    message="You should attach a thumbnail before publishing the course.",
                    target={
                        "kind": "course",
                        "id": course.id,
                    },
                )
            )

        # --------------------------------------------------
        # Section / Lecture / Quiz checks
        # --------------------------------------------------

        # FIX: read through the course instead of Section.objects.filter(...).
        # InstructorCourseViewSet.get_queryset() already prefetches exactly these
        # relations, so this costs no extra queries — a fresh .filter() here would
        # bypass that prefetch and run ~4 queries per course on the My Courses
        # list. Wrapped in list() so the query runs once, not for .exists() and
        # again for the loop.
        sections = list(course.section_set.all())

        if not sections:
            self.blockers.append(
                ReadinessItem(
                    code="no_sections",
                    severity="blocking",
                    message="The course has no sections.",
                    target={
                        "kind": "course",
                        "id": course.id,
                    },
                )
            )

        quizzes_num = 0

        for section in sections:

            # ----------------------------------------------
            # Section: lectures
            # ----------------------------------------------

            lectures = section.lectures.all()

            # FIX (all messages below): name the specific item. With three
            # lectures missing video, three identical "This lecture has no video
            # attached." lines don't tell the instructor which is which (FR-015).
            if not lectures:
                self.blockers.append(
                    ReadinessItem(
                        code="empty_section",
                        severity="blocking",
                        message=f"The section “{section.title}” has no lectures.",
                        target={
                            "kind": "section",
                            "id": section.id,
                        },
                    )
                )

            for lecture in lectures:

                if lecture.video_status == "PENDING":
                    self.blockers.append(
                        ReadinessItem(
                            code="lecture_video_missing",
                            severity="blocking",
                            message=f"The lecture “{lecture.title}” has no video attached.",
                            target={
                                "kind": "lecture",
                                "id": lecture.id,
                                "section_id": section.id,
                            },
                        )
                    )

                elif lecture.video_status == "PROCESSING":
                    self.blockers.append(
                        ReadinessItem(
                            code="lecture_video_processing",
                            severity="blocking",
                            message=f"The lecture “{lecture.title}” video is still processing.",
                            target={
                                "kind": "lecture",
                                "id": lecture.id,
                                "section_id": section.id,
                            },
                        )
                    )

                elif lecture.video_status == "FAILED":
                    self.blockers.append(
                        ReadinessItem(
                            code="lecture_video_failed",
                            severity="blocking",
                            message=f"The lecture “{lecture.title}” video processing failed.",
                            target={
                                "kind": "lecture",
                                "id": lecture.id,
                                "section_id": section.id,
                            },
                        )
                    )

            # ----------------------------------------------
            # Section: quiz
            # ----------------------------------------------

            try:
                quiz = section.quiz
                quizzes_num += 1
            except Quiz.DoesNotExist:
                quiz = None

            if quiz:
                questions = quiz.question.all()

                # quiz_no_questions
                if not questions:
                    self.blockers.append(
                        ReadinessItem(
                            code="quiz_no_questions",
                            severity="blocking",
                            message=f"The quiz “{quiz.title}” has no questions.",
                            target={
                                "kind": "quiz",
                                "id": quiz.id,
                                "section_id": section.id,
                            },
                        )
                    )

                # quiz_incomplete_question
                # FIX: a question is complete only with text, AT LEAST TWO choices,
                # and EXACTLY ONE marked correct (005 FR-010). The old check
                # (blank text or no choices) passed a question with one choice,
                # with nothing marked correct, or with two marked correct — each
                # one a quiz a student can't pass.
                # Keep in step with isQuestionComplete() in
                # front-end/src/featuers/instructor-curriculum/types/instructorCurriculum.types.ts.
                # This copy is the publish gate; the client copy only drives the
                # quiz editor's badge.
                incomplete_questions_count = sum(
                    1
                    for question in questions
                    if not question.text.strip()
                    or len(question.choice.all()) < 2
                    or sum(1 for choice in question.choice.all() if choice.is_correct) != 1
                )

                if incomplete_questions_count > 0:
                    self.blockers.append(
                        ReadinessItem(
                            code="quiz_incomplete_question",
                            severity="blocking",
                            message=(
                                f"The quiz “{quiz.title}” has "
                                f"{incomplete_questions_count} incomplete question(s)."
                            ),
                            target={
                                "kind": "quiz",
                                "id": quiz.id,
                                "section_id": section.id,
                            },
                        )
                    )

        # FIX: only suggest quizzes once there are sections to attach them to —
        # with none, the no_sections blocker already says what to do next.
        if sections and quizzes_num == 0:
            self.advisories.append(
                ReadinessItem(
                    code='no_quizzes',
                    severity='advisory',
                    message="tip: you can provide a quiz for your sections",
                    # FIX: `target` is a required field on ReadinessItem, so the
                    # advisories raised TypeError without it.
                    target={
                        "kind": "course",
                        "id": course.id,
                    },
                )
            )

    def _find_advisories(self, course: Course):

        if not course.language:
            self.advisories.append(
                ReadinessItem(
                    code='no_language',
                    severity='advisory',
                    message="tip: you can provide a language for this course",
                    target={
                        "kind": "course",
                        "id": course.id,
                    },
                )
            )

        if not course.goals_list:
            self.advisories.append(
                ReadinessItem(
                    code='no_goals',
                    severity='advisory',
                    message="tip: you can provide a goal list for this course",
                    target={
                        "kind": "course",
                        "id": course.id,
                    },
                )
            )
