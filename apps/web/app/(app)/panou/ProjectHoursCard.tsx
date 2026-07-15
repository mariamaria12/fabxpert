'use client';

import type { ProjectSummaryActivityRow } from '@fabxpert/shared';
import type { ReactNode } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';

export type ProjectHoursCardProject = {
  id: string;
  name: string;
  code: string;
  color: string | null;
  company: { name: string };
  totalMinutes: number;
  activities: ProjectSummaryActivityRow[];
};

export function ProjectHoursCardHeader({
  project,
  expanded,
  showAccentBar = true,
}: {
  project: Pick<ProjectHoursCardProject, 'name' | 'code' | 'color' | 'company' | 'totalMinutes'>;
  expanded: boolean;
  showAccentBar?: boolean;
}) {
  return (
    <>
      {showAccentBar && (
        <span
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ background: project.color ?? 'var(--color-border-subtle)' }}
          aria-hidden="true"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text-primary">{project.name}</p>
        <p className="mt-0.5 truncate font-mono text-xs text-text-muted">
          {project.code} · {project.company.name}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="font-mono text-base font-medium text-text-primary">
            {formatDurationMinutes(project.totalMinutes)}
          </p>
          <p className="text-xs text-text-muted">total logat</p>
        </div>
        <i
          className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-base text-text-muted`}
          aria-hidden="true"
        />
      </div>
    </>
  );
}

export function ProjectHoursCard({
  project,
  expanded,
  onToggle,
  headerExtra,
  trailingAction,
}: {
  project: ProjectHoursCardProject;
  expanded: boolean;
  onToggle: () => void;
  headerExtra?: ReactNode;
  trailingAction?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border-subtle bg-surface">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
        >
          <ProjectHoursCardHeader project={project} expanded={expanded} />
        </button>
        {trailingAction}
      </div>

      {headerExtra && <div className="border-t border-border-subtle px-4 pb-3 pt-2">{headerExtra}</div>}

      {expanded && (
        <div className="border-t border-border-subtle px-4 py-3">
          <ActivityBreakdownRows activities={project.activities} />
        </div>
      )}
    </div>
  );
}
