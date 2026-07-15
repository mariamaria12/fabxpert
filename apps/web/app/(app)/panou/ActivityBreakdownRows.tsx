'use client';

import type { ProjectSummaryActivityRow } from '@fabxpert/shared';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { PanouActivityProgressBar } from './PanouActivityProgressBar';

export function ActivityBreakdownRows({
  activities,
}: {
  activities: ProjectSummaryActivityRow[];
}) {
  const maxActivityMinutes = Math.max(...activities.map((activity) => activity.minutes), 1);

  return (
    <div className="space-y-2">
      {activities.map((activity) => {
        const percent = Math.round((activity.minutes / maxActivityMinutes) * 100);
        const dotColor = activity.activityColor ?? 'var(--color-border-subtle)';

        return (
          <div
            key={activity.activityId ?? 'none'}
            className="grid grid-cols-[auto_minmax(0,8rem)_1fr_auto] items-center gap-x-2.5"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
              aria-hidden="true"
            />
            <span className="truncate text-xs text-text-secondary">{activity.activityName}</span>
            <PanouActivityProgressBar
              className="min-w-0 w-full"
              color={activity.activityColor}
              percent={percent}
            />
            <span className="font-mono text-[11px] tabular-nums text-text-muted">
              {formatDurationMinutes(activity.minutes)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
