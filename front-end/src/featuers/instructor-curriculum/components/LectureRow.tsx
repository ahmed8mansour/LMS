'use client';

import Link from 'next/link';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Lecture } from '../types/instructorCurriculum.types';
import { formatMinutes } from '@/lib/duration';
import { DragHandleProps } from './SortableList';
import { VideoStatusBadge } from './VideoStatusBadge';
import { DeleteCurriculumItemDialog } from './DeleteCurriculumItemDialog';

interface LectureRowProps {
    lecture: Lecture;
    courseId: number;
    hasEnrollments: boolean;
    handleProps: DragHandleProps;
    onDelete: () => Promise<unknown>;
}

export function LectureRow({ lecture, courseId, hasEnrollments, handleProps, onDelete }: LectureRowProps) {
    return (
        <div className="flex items-center gap-3 border-b border-graytext/15 py-2.5 last:border-b-0">
            <button
                type="button"
                {...handleProps}
                aria-label="Reorder lecture"
                className="cursor-grab text-graytext2 hover:text-darktext focus:outline-none focus-visible:ring-2 focus-visible:ring-darkmint"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <VideoStatusBadge status={lecture.video_status} />
            <span className="flex-1 truncate text-sm text-darktext">{lecture.title}</span>
            <span className="font-mono text-xs text-graytext2">{formatMinutes(lecture.duration)}</span>
            <Link
                href={`/instructor/courses/${courseId}/curriculum/lectures/${lecture.id}`}
                aria-label="Edit lecture"
                className="text-graytext2 transition-colors hover:text-darkmint"
            >
                <Pencil className="h-4 w-4" />
            </Link>
            <DeleteCurriculumItemDialog
                kind="lecture"
                label={lecture.title}
                hasEnrollments={hasEnrollments}
                onConfirm={onDelete}
                trigger={
                    <button
                        type="button"
                        aria-label="Delete lecture"
                        className="text-graytext2 transition-colors hover:text-red-500"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                }
            />
        </div>
    );
}
