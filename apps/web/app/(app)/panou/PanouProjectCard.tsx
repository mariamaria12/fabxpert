'use client';

import type { ProjectStatus } from '@fabxpert/shared';
import {
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
} from '@fabxpert/shared';
import type { ReactNode } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { panouAccentTint } from './panouColors';

export type PanouProjectCardTimeline = {
  daysText: string;
  daysClassName: string;
  dateRange: string;
  overdue: boolean;
};

export function PanouProjectCard({
  accentColor,
  title,
  status,
  subtitle,
  timeline,
  totalMinutes,
  expanded,
  onToggle,
  leadingSlot,
  expandedContent,
}: {
  accentColor: string | null;
  title: string;
  status?: ProjectStatus;
  subtitle: string;
  timeline?: PanouProjectCardTimeline | null;
  totalMinutes: number;
  expanded: boolean;
  onToggle: () => void;
  leadingSlot?: ReactNode;
  expandedContent?: ReactNode;
}) {
  const color = accentColor ?? '#8c8a80';

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm shadow-black/10">
      <div className="flex items-stretch">
        <span
          className="w-0.5 shrink-0 self-stretch"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5">
          {leadingSlot ?? (
            <span
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
              style={{
                backgroundColor: panouAccentTint(accentColor, '24%'),
                color,
              }}
              aria-hidden="true"
            >
              <i className="ti ti-briefcase text-base" />
            </span>
          )}

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-start gap-2.5 text-left transition-colors hover:opacity-90"
          >
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-medium text-text-primary" title={title}>
                  {title}
                </span>
              {status && (
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${getProjectStatusBadgeClassName(status)}`}
                >
                  {getProjectStatusLabel(status)}
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-text-muted">{subtitle}</span>
            {timeline && (
              <span className="mt-1.5 block space-y-0.5">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] ${timeline.daysClassName}`}
                >
                  <i className="ti ti-calendar text-xs" aria-hidden="true" />
                  {timeline.daysText}
                </span>
                <span className="block text-[10px] text-text-muted">{timeline.dateRange}</span>
              </span>
            )}
          </span>

          <span className="flex shrink-0 items-center gap-1.5 self-start">
            <span className="text-right">
              <span className="block font-mono text-xs font-medium tabular-nums text-text-primary">
                {formatDurationMinutes(totalMinutes)}
              </span>
              <span className="block text-[10px] text-text-muted">total logat</span>
            </span>
            <i
              className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-sm text-text-muted`}
              aria-hidden="true"
            />
          </span>
          </button>
        </div>
      </div>

      {expanded && expandedContent && (
        <div className="border-t border-border-subtle px-3 py-2">{expandedContent}</div>
      )}
    </div>
  );
}
