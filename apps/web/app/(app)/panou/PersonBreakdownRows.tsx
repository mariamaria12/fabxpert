'use client';

import type { PersonSummaryActivityRow } from '@fabxpert/shared';
import {
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  PROJECT_TERMINAL_STATUSES,
} from '@fabxpert/shared';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';

export function PersonBreakdownRows({
  activities,
}: {
  activities: PersonSummaryActivityRow[];
}) {
  const maxMinutes = Math.max(...activities.map((entry) => entry.minutes), 1);

  return (
    <div className="space-y-3">
      {activities.map((entry) => (
        <div key={`${entry.projectId}-${entry.activityId ?? 'none'}`} className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{
                    background: entry.projectColor ?? 'var(--color-border-subtle)',
                  }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium text-text-primary">
                  {entry.projectName}
                </span>
                {PROJECT_TERMINAL_STATUSES.includes(entry.projectStatus) && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${getProjectStatusBadgeClassName(entry.projectStatus)}`}
                  >
                    {getProjectStatusLabel(entry.projectStatus)}
                  </span>
                )}
                <span className="shrink-0 font-mono text-xs text-text-muted">
                  {entry.projectCode}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 pl-[18px]">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: entry.activityColor ?? 'var(--color-border-subtle)',
                  }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm text-text-secondary">{entry.activityName}</span>
              </div>
            </div>
            <span className="shrink-0 font-mono text-sm tabular-nums text-text-primary">
              {formatDurationMinutes(entry.minutes)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent/70"
              style={{
                width: `${Math.round((entry.minutes / maxMinutes) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
