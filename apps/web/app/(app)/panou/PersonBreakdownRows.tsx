'use client';

import type { PersonSummaryActivityRow } from '@fabxpert/shared';
import {
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  PROJECT_TERMINAL_STATUSES,
} from '@fabxpert/shared';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { PanouActivityProgressBar } from './PanouActivityProgressBar';

/** A full bar is a 9-hour day, so lengths compare across rows and people. */
const FULL_BAR_MINUTES = 9 * 60;

export function PersonBreakdownRows({
  activities,
}: {
  activities: PersonSummaryActivityRow[];
}) {
  return (
    <div className="space-y-2.5">
      {activities.map((entry) => {
        const percent = Math.min(Math.round((entry.minutes / FULL_BAR_MINUTES) * 100), 100);

        return (
        <div key={`${entry.projectId}-${entry.activityId ?? 'none'}`} className="space-y-1.5">
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
                  <span className="font-mono">{entry.projectCode}</span>
                  {entry.projectDenumireLucrare && (
                    <>
                      <span className="px-1.5 text-text-muted" aria-hidden="true">
                        ·
                      </span>
                      {entry.projectDenumireLucrare}
                    </>
                  )}
                </span>
                {PROJECT_TERMINAL_STATUSES.includes(entry.projectStatus) && (
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${getProjectStatusBadgeClassName(entry.projectStatus)}`}
                  >
                    {getProjectStatusLabel(entry.projectStatus)}
                  </span>
                )}
              </div>
              <div className="truncate pl-[18px] text-xs text-text-muted">
                {entry.companyName}
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
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
              {formatDurationMinutes(entry.minutes)}
            </span>
          </div>
          <PanouActivityProgressBar
            className="ml-[18px] mr-4"
            color={entry.activityColor}
            percent={percent}
          />

          {entry.notes.length > 0 && (
            <ul className="ml-[18px] space-y-0.5">
              {entry.notes.map((note, index) => (
                <li
                  key={`${entry.projectId}-${entry.activityId ?? 'none'}-${index}`}
                  className="flex gap-1.5 text-[11px] text-text-muted"
                >
                  <i className="ti ti-message-2 mt-0.5 shrink-0 text-xs" aria-hidden="true" />
                  {/* Keeps the line breaks the worker typed on the pontaj. */}
                  <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{note}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        );
      })}
    </div>
  );
}
