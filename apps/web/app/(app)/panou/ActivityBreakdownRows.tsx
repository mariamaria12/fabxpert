'use client';

import type { ProjectSummaryActivityRow } from '@fabxpert/shared';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';

export function ActivityBreakdownRows({
  activities,
}: {
  activities: ProjectSummaryActivityRow[];
}) {
  const maxActivityMinutes = Math.max(...activities.map((activity) => activity.minutes), 1);

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.activityId ?? 'none'}
          className="grid grid-cols-[auto_minmax(0,7rem)_1fr_auto] items-center gap-3"
        >
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{
              background: activity.activityColor ?? 'var(--color-border-subtle)',
            }}
            aria-hidden="true"
          />
          <span className="truncate text-sm text-text-secondary">{activity.activityName}</span>
          <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent/70"
              style={{
                width: `${Math.round((activity.minutes / maxActivityMinutes) * 100)}%`,
              }}
            />
          </div>
          <span className="font-mono text-sm tabular-nums text-text-primary">
            {formatDurationMinutes(activity.minutes)}
          </span>
        </div>
      ))}
    </div>
  );
}
