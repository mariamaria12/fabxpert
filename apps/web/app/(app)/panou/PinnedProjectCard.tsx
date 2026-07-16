'use client';

import type { PinnedProjectSummaryRow, ProjectDto } from '@fabxpert/shared';
import { updateProject } from '@fabxpert/shared';
import { useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import { panouAccentTint } from './panouColors';
import { PanouProjectCard } from './PanouProjectCard';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
  formatProjectTimelineRange,
  getProjectDaysRemainingLabel,
  getProjectTimelineDates,
  isProjectTimelineOverdue,
} from './panouProjectTimeline';
import { ProjectVisibleForCardMeta } from './panouProjectVisibility';

export type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
};

function PinnedProjectPinButton({
  project,
  onUnpinned,
}: {
  project: Pick<PinnedProjectSummaryRow, 'id' | 'color'>;
  onUnpinned: (updated: ProjectDto) => void;
}) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const color = project.color ?? '#8c8a80';

  async function handleClick() {
    if (pending) {
      return;
    }

    setPending(true);
    try {
      const updated = await updateProject(project.id, { isPinned: false });
      onUnpinned(updated);
      showToast('Fixare anulată', 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      aria-label="Anulează fixarea"
      aria-pressed={true}
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
      style={{
        backgroundColor: panouAccentTint(project.color, '24%'),
        color,
      }}
    >
      <i className="ti ti-pinned text-base" aria-hidden="true" />
    </button>
  );
}

function PinnedProjectEditButton({ onEdit }: { onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label="Editează proiectul"
      className="flex size-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary"
    >
      <i className="ti ti-pencil text-sm" aria-hidden="true" />
    </button>
  );
}

export function PinnedProjectCard({
  project,
  expanded,
  onToggle,
  onUnpinned,
  onEdit,
  dragHandleProps,
}: {
  project: PinnedProjectSummaryRow;
  expanded: boolean;
  onToggle: () => void;
  onUnpinned: (updated: ProjectDto) => void;
  onEdit: () => void;
  dragHandleProps?: DragHandleProps;
}) {
  const timelineDates = getProjectTimelineDates(project.startDate, project.dueDate);
  const timeline = timelineDates
    ? (() => {
        const { startDate, dueDate } = timelineDates;
        const daysLabel = getProjectDaysRemainingLabel(dueDate);
        const overdue = isProjectTimelineOverdue(dueDate);
        return {
          daysText: daysLabel.text,
          daysClassName: daysLabel.className,
          dateRange: formatProjectTimelineRange(startDate, dueDate),
          overdue,
        };
      })()
    : null;

  return (
    <PanouProjectCard
      accentColor={project.color}
      title={project.code}
      status={project.status}
      subtitle={project.company.name}
      metaContent={<ProjectVisibleForCardMeta roles={project.visibleForRoles} />}
      timeline={timeline}
      totalMinutes={project.totalMinutes}
      expanded={expanded}
      onToggle={onToggle}
      leadingSlot={
        <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
          {dragHandleProps && (
            <button
              type="button"
              className="flex size-8 cursor-grab items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary active:cursor-grabbing"
              aria-label="Reordonează proiectul"
              {...dragHandleProps.attributes}
              {...dragHandleProps.listeners}
            >
              <i className="ti ti-grip-vertical text-base" aria-hidden="true" />
            </button>
          )}
          <PinnedProjectPinButton
            project={project}
            onUnpinned={(updated) => {
              if (!updated.isPinned) {
                onUnpinned(updated);
              }
            }}
          />
        </div>
      }
      durationTopActions={<PinnedProjectEditButton onEdit={onEdit} />}
      expandedContent={
        project.activities.length > 0 ? (
          <ActivityBreakdownRows activities={project.activities} />
        ) : (
          <p className="text-sm text-text-muted">
            {formatDurationMinutes(project.totalMinutes)} total logat
          </p>
        )
      }
    />
  );
}
