'use client';

import { ReactNode } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Props spread onto a drag handle element (grip). Includes keyboard support via
// dnd-kit's KeyboardSensor so reordering is accessible without a mouse.
export type DragHandleProps = Record<string, unknown>;

interface SortableListProps<T extends { id: number }> {
    items: T[];
    /**
     * Called after a drag with the full new id order plus the single moved item
     * and its target index. Backend reorder renumbers the whole parent from one
     * item's new position, so `moved` is enough to persist the change.
     */
    onReorder: (orderedIds: number[], moved: { id: number; newIndex: number }) => void;
    renderItem: (item: T, handleProps: DragHandleProps) => ReactNode;
}

function SortableRow<T extends { id: number }>({
    item,
    renderItem,
}: {
    item: T;
    renderItem: SortableListProps<T>['renderItem'];
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
    };
    return (
        <div ref={setNodeRef} style={style}>
            {renderItem(item, { ...attributes, ...listeners })}
        </div>
    );
}

export function SortableList<T extends { id: number }>({
    items,
    onReorder,
    renderItem,
}: SortableListProps<T>) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        onReorder(arrayMove(items, oldIndex, newIndex).map((i) => i.id), {
            id: Number(active.id),
            newIndex,
        });
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {items.map((item) => (
                    <SortableRow key={item.id} item={item} renderItem={renderItem} />
                ))}
            </SortableContext>
        </DndContext>
    );
}
