'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PinnedProjectSummaryRow, ProjectDto } from '@fabxpert/shared';
import { PinnedProjectCard } from './PinnedProjectCard';

export function SortablePinnedProjectCard({
  project,
  expanded,
  onToggle,
  onUnpinned,
  onEdit,
}: {
  project: PinnedProjectSummaryRow;
  expanded: boolean;
  onToggle: () => void;
  onUnpinned: (updated: ProjectDto) => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
    opacity: isDragging ? 0.92 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <PinnedProjectCard
        project={project}
        expanded={expanded}
        onToggle={onToggle}
        onUnpinned={onUnpinned}
        onEdit={onEdit}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}
