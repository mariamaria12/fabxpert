'use client';

import type { PinnedProjectSummaryRow, ProjectDto } from '@fabxpert/shared';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import {
  formatProjectTimelineRange,
  getProjectDaysRemainingLabel,
  getProjectTimelineDates,
  getProjectTimelineProgress,
  isProjectTimelineOverdue,
} from './panouProjectTimeline';
import { ProjectHoursCardHeader } from './ProjectHoursCard';
import { ProjectPinButton } from './ProjectPinButton';

function ProjectTimelineMeta({ project }: { project: PinnedProjectSummaryRow }) {
  const timeline = getProjectTimelineDates(project.startDate, project.dueDate);
  if (!timeline) {
    return null;
  }

  const { startDate, dueDate } = timeline;
  const daysLabel = getProjectDaysRemainingLabel(dueDate);
  const overdue = isProjectTimelineOverdue(dueDate);
  const progress = overdue ? 100 : getProjectTimelineProgress(startDate, dueDate);
  const fillColor = overdue ? 'var(--color-danger)' : (project.color ?? 'var(--color-accent)');

  return (
    <div className="mt-3 space-y-2">
      <p className={`text-xs ${daysLabel.className}`}>{daysLabel.text}</p>
      <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${progress}%`, backgroundColor: fillColor }}
          />
        </div>
        <p className="text-[11px] text-text-muted">
          {formatProjectTimelineRange(startDate, dueDate)}
        </p>
      </div>
    </div>
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
  const showTimelineInHeader = getProjectTimelineDates(project.startDate, project.dueDate) !== null;

  function handlePinToggled(updated: ProjectDto) {
    if (!updated.isPinned) {
      onUnpinned(updated);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border-subtle bg-surface">
      <div className="flex items-stretch">
        <span
          className="w-1.5 shrink-0 self-stretch"
          style={{ background: project.color ?? 'var(--color-border-subtle)' }}
          aria-hidden="true"
        />
        <div className="flex w-11 shrink-0 items-center justify-center">
          <ProjectPinButton
            project={{ id: project.id, isPinned: true }}
            onToggled={handlePinToggled}
          />
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 flex-col px-4 py-3 text-left transition-colors hover:bg-surface-raised"
        >
          <div className="flex w-full items-center gap-3">
            <ProjectHoursCardHeader
              project={{
                name: project.name,
                code: project.code,
                color: project.color,
                company: project.company,
                totalMinutes: project.totalMinutes,
              }}
              expanded={expanded}
              showAccentBar={false}
            />
          </div>
          {showTimelineInHeader && <ProjectTimelineMeta project={project} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border-subtle px-4 py-3">
          {project.activities.length > 0 ? (
            <ActivityBreakdownRows activities={project.activities} />
          ) : (
            <p className="text-sm text-text-muted">
              {formatDurationMinutes(project.totalMinutes)} total logat
            </p>
          )}
        </div>
      )}
    </div>
  );
}
