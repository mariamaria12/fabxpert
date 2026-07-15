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
import {
  formatProjectTimelineRange,
  getProjectDaysRemainingLabel,
  getProjectTimelineDates,
  isProjectTimelineOverdue,
} from './panouProjectTimeline';

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

export function PinnedProjectCard({
  project,
  expanded,
  onToggle,
  onUnpinned,
}: {
  project: PinnedProjectSummaryRow;
  expanded: boolean;
  onToggle: () => void;
  onUnpinned: (updated: ProjectDto) => void;
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
      title={project.name}
      status={project.status}
      subtitle={`${project.code} · ${project.company.name}`}
      timeline={timeline}
      totalMinutes={project.totalMinutes}
      expanded={expanded}
      onToggle={onToggle}
      leadingSlot={
        <PinnedProjectPinButton
          project={project}
          onUnpinned={(updated) => {
            if (!updated.isPinned) {
              onUnpinned(updated);
            }
          }}
        />
      }
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
