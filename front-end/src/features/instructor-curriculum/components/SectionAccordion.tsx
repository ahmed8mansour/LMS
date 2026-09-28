'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, GripVertical, Pencil, Plus, Trash2, FileQuestion } from 'lucide-react';
import { Section } from '../types/instructorCurriculum.types';
import { Input } from '@/components/atoms/input';
import { Button } from '@/components/atoms/button';
import { DragHandleProps, SortableList } from './SortableList';
import { LectureRow } from './LectureRow';
import { AddLectureForm } from './AddLectureForm';
import { DeleteCurriculumItemDialog } from './DeleteCurriculumItemDialog';
import { useLectureMutations } from '../hooks/useLectureMutations';
import { useQuizMutations } from '../hooks/useQuizMutations';
import { useCurriculumUi } from '../store/instructorCurriculum.store';

interface SectionAccordionProps {
    section: Section;
    courseId: number;
    hasEnrollments: boolean;
    handleProps: DragHandleProps;
    onRename: (title: string) => Promise<unknown>;
    onDelete: () => Promise<unknown>;
}

export function SectionAccordion({
    section,
    courseId,
    hasEnrollments,
    handleProps,
    onRename,
    onDelete,
}: SectionAccordionProps) {
    const lectures = useLectureMutations(courseId);
    const quiz = useQuizMutations(courseId);
    const { isExpanded, toggleSection } = useCurriculumUi();
    const open = isExpanded(section.id);

    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(section.title);

    const saveTitle = async () => {
        const trimmed = title.trim();
        if (trimmed && trimmed !== section.title) await onRename(trimmed);
        setEditing(false);
    };

    const sortedLectures = section.lectures.slice().sort((a, b) => a.order - b.order);

    return (
        <div className="rounded-lg border border-graytext/20 bg-white">
            {/* header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                    type="button"
                    {...handleProps}
                    aria-label="Reorder section"
                    className="cursor-grab text-graytext2 hover:text-darktext focus:outline-none focus-visible:ring-2 focus-visible:ring-darkmint"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-label={open ? 'Collapse section' : 'Expand section'}
                    className="text-graytext2 hover:text-darktext"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? '' : '-rotate-90'}`} />
                </button>

                {editing ? (
                    <Input
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                saveTitle();
                            }
                            if (e.key === 'Escape') {
                                setTitle(section.title);
                                setEditing(false);
                            }
                        }}
                        className="h-8 flex-1"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-darktext"
                    >
                        {section.title}
                        <Pencil className="h-3.5 w-3.5 text-graytext2" />
                    </button>
                )}

                <DeleteCurriculumItemDialog
                    kind="section"
                    label={section.title}
                    hasEnrollments={hasEnrollments}
                    onConfirm={onDelete}
                    trigger={
                        <button
                            type="button"
                            aria-label="Delete section"
                            className="text-graytext2 transition-colors hover:text-red-500"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    }
                />
            </div>

            {/* body */}
            {open && (
                <div className="flex flex-col gap-2 border-t border-graytext/15 px-4 py-3">
                    {sortedLectures.length > 0 ? (
                        <SortableList
                            items={sortedLectures}
                            onReorder={(_ids, moved) => lectures.reorder.mutate(moved)}
                            renderItem={(lecture, hp) => (
                                <LectureRow
                                    lecture={lecture}
                                    courseId={courseId}
                                    hasEnrollments={hasEnrollments}
                                    handleProps={hp}
                                    onDelete={() => lectures.remove.mutateAsync(lecture.id)}
                                />
                            )}
                        />
                    ) : (
                        <p className="text-sm text-graytext2">No lectures yet. Add your first one below.</p>
                    )}

                    <AddLectureForm
                        pending={lectures.create.isPending}
                        onAdd={(t, d) =>
                            lectures.create.mutateAsync({ sectionId: section.id, title: t, duration: d })
                        }
                    />

                    {/* quiz row: at most one quiz per section */}
                    <div className="mt-2 flex items-center gap-2 rounded-md bg-lightbg/50 px-3 py-2">
                        <FileQuestion className="h-4 w-4 text-graytext2" />
                        {section.quiz ? (
                            <>
                                <span className="flex-1 text-sm text-darktext">
                                    Quiz · {section.quiz.questions_count} question
                                    {section.quiz.questions_count === 1 ? '' : 's'}
                                </span>
                                <Link
                                    href={`/instructor/courses/${courseId}/quizzes/${section.quiz.id}`}
                                    className="text-sm font-semibold text-darkmint hover:underline"
                                >
                                    Edit quiz
                                </Link>
                                <DeleteCurriculumItemDialog
                                    kind="quiz"
                                    hasEnrollments={hasEnrollments}
                                    onConfirm={() => quiz.remove.mutateAsync(section.quiz!.id)}
                                    trigger={
                                        <button
                                            type="button"
                                            aria-label="Delete quiz"
                                            className="text-graytext2 transition-colors hover:text-red-500"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    }
                                />
                            </>
                        ) : (
                            <>
                                <span className="flex-1 text-sm text-graytext2">No quiz yet</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={quiz.create.isPending}
                                    onClick={() =>
                                        quiz.create.mutate({ sectionId: section.id, title: 'Section quiz' })
                                    }
                                >
                                    <Plus className="mr-1 h-4 w-4" />
                                    Quiz
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
