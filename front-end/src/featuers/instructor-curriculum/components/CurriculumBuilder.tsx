'use client';

import { Layers } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { Skeleton } from '@/components/atoms/skeleton';
import { useCurriculum } from '../hooks/useCurriculum';
import { useSectionMutations } from '../hooks/useSectionMutations';
import { SortableList } from './SortableList';
import { SectionAccordion } from './SectionAccordion';
import { AddInlineRow } from './AddInlineRow';

// The Curriculum tab: an ordered, drag-reorderable list of sections (each with
// its lectures and single quiz) plus an add-section row and an empty state.
export function CurriculumBuilder({ courseId }: { courseId: number }) {
    const { sections, hasEnrollments, isLoading, isError, refetch } = useCurriculum(courseId);
    const sectionMut = useSectionMutations(courseId);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3">
                {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-graytext/20 bg-white py-16 text-center">
                <h2 className="text-lg font-bold text-darktext">Couldn&rsquo;t load the curriculum</h2>
                <Button variant="darkmint" onClick={() => refetch()}>
                    Try again
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-darktext">Curriculum builder</h2>
                    <p className="text-sm text-graytext2">
                        Drag to reorder · sections, lectures, and quizzes
                    </p>
                </div>
            </div>

            {sections.length === 0 ? (
                <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-graytext/30 bg-white py-16 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-darkmint/10 text-darkmint">
                        <Layers className="h-7 w-7" />
                    </div>
                    <div className="flex max-w-sm flex-col gap-1.5">
                        <h3 className="text-base font-bold text-darktext">Add your first section</h3>
                        <p className="text-sm text-graytext2">
                            Sections are the backbone of your course. Add one to start building.
                        </p>
                    </div>
                    <div className="w-full max-w-md">
                        <AddInlineRow
                            placeholder="Section title, e.g. Getting started"
                            buttonLabel="Add section"
                            pending={sectionMut.create.isPending}
                            onAdd={(title) => sectionMut.create.mutateAsync(title)}
                        />
                    </div>
                </div>
            ) : (
                <>
                    <SortableList
                        items={sections}
                        onReorder={(_ids, moved) => sectionMut.reorder.mutate(moved)}
                        renderItem={(section, handleProps) => (
                            <div className="mb-3">
                                <SectionAccordion
                                    section={section}
                                    courseId={courseId}
                                    hasEnrollments={hasEnrollments}
                                    handleProps={handleProps}
                                    onRename={(title) =>
                                        sectionMut.rename.mutateAsync({ id: section.id, title })
                                    }
                                    onDelete={() => sectionMut.remove.mutateAsync(section.id)}
                                />
                            </div>
                        )}
                    />

                    <div className="max-w-md">
                        <AddInlineRow
                            placeholder="New section title"
                            buttonLabel="Add section"
                            pending={sectionMut.create.isPending}
                            onAdd={(title) => sectionMut.create.mutateAsync(title)}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
