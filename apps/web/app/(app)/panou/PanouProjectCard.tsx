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
  titleSubline,
  hideLeadingIcon,
  infoLine,
  subtitle,
  metaLine,
  metaContent,
  timeline,
  totalMinutes,
  expanded,
  onToggle,
  onTitleClick,
  leadingSlot,
  expandedContent,
  durationTopActions,
}: {
  accentColor: string | null;
  title: string;
  status?: ProjectStatus;
  /** Sits between the title and the subtitle; skipped when empty. */
  titleSubline?: string | null;
  /** Drop the leading icon entirely (no slot, no fallback) to free up width. */
  hideLeadingIcon?: boolean;
  /** Extra line between the title row and the subtitle (finisaj on pinned cards). */
  infoLine?: string | null;
  subtitle: string;
  metaLine?: string;
  metaContent?: ReactNode;
  timeline?: PanouProjectCardTimeline | null;
  totalMinutes: number;
  expanded: boolean;
  onToggle: () => void;
  /** Defaults to `onToggle`. Use for opening edit while keeping expand on hours/chevron. */
  onTitleClick?: () => void;
  leadingSlot?: ReactNode;
  expandedContent?: ReactNode;
  durationTopActions?: ReactNode;
}) {
  const color = accentColor ?? '#8c8a80';
  const handleTitleClick = onTitleClick ?? onToggle;
  // Null or blank leaves the row exactly as it was — no orphan separator.
  const subline = titleSubline?.trim() ? titleSubline.trim() : null;
  const info = infoLine?.trim() ? infoLine.trim() : null;
  const totalBlock = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="text-right transition-colors hover:opacity-90"
      >
        <span className="block font-mono text-xs font-medium tabular-nums text-text-primary">
          {formatDurationMinutes(totalMinutes)}
        </span>
        <span className="block text-[10px] text-text-muted">total logat</span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Restrânge detaliile' : 'Extinde detaliile'}
        className="flex size-6 shrink-0 items-center justify-center text-text-muted transition-colors hover:text-text-secondary"
      >
        <i
          className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-sm`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
  const meta =
    metaContent ??
    (metaLine ? (
      <span className="block text-[11px] text-text-muted [overflow-wrap:anywhere]">
        {metaLine}
      </span>
    ) : null);
  // Cards without roles/timeline (the hours view) keep the hours block top right.
  const hasFooter = Boolean(meta || timeline);

  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm shadow-black/10">
      <div className="flex items-stretch">
        <span
          className="w-0.5 shrink-0 self-stretch"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1 px-3 py-2.5">
          <div className="flex items-start gap-2.5">
          {leadingSlot ??
            (hideLeadingIcon ? null : (
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
            ))}

          <button
            type="button"
            onClick={handleTitleClick}
            aria-expanded={onTitleClick ? undefined : expanded}
            className="min-w-0 flex-1 text-left transition-colors hover:opacity-90"
          >
            <span className="min-w-0 flex-1">
              {/* Phones wrap: code + status on one line, denumire on the next,
                  nothing clipped. From `md` up it stays a single line. */}
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 md:flex-nowrap">
                <span
                  className="text-sm font-medium text-text-primary [overflow-wrap:anywhere] md:shrink-0 md:whitespace-nowrap"
                  title={title}
                >
                  {title}
                </span>
                {subline && (
                  <span
                    className="order-2 min-w-0 basis-full text-xs text-text-secondary [overflow-wrap:anywhere] md:order-none md:basis-auto md:flex-1 md:truncate md:text-text-muted"
                    title={subline}
                  >
                    · {subline}
                  </span>
                )}
                {status && (
                  <span
                    className={`order-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium md:order-none ${getProjectStatusBadgeClassName(status)}`}
                  >
                    {getProjectStatusLabel(status)}
                  </span>
                )}
              </span>
            {info && (
              <span className="mt-0.5 block text-[11px] text-text-secondary [overflow-wrap:anywhere] md:truncate">
                {info}
              </span>
            )}
            <span className="mt-0.5 block text-[11px] text-text-muted [overflow-wrap:anywhere] md:truncate">
              {subtitle}
            </span>
          </span>
          </button>

          <div className="flex shrink-0 flex-col items-end gap-0.5 self-start">
            {durationTopActions}
            {!hasFooter && totalBlock}
          </div>
          </div>

          {hasFooter && (
            /* Bottom row across the card: roles on the left, then the timeline
               and — bottom right — the hours toggle. On phones the roles get the
               whole width and this stacks. */
            <div className="mt-1.5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between md:gap-4">
              <div className="min-w-0">{meta}</div>
              <div className="flex shrink-0 items-end justify-between gap-3 md:justify-end">
                {timeline && (
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] ${timeline.daysClassName}`}
                    >
                      <i className="ti ti-calendar text-xs" aria-hidden="true" />
                      {timeline.daysText}
                    </span>
                    <span className="text-[10px] text-text-muted">{timeline.dateRange}</span>
                  </div>
                )}
                {totalBlock}
              </div>
            </div>
          )}
        </div>
      </div>

      {expanded && expandedContent && (
        <div className="border-t border-border-subtle px-3 py-2">{expandedContent}</div>
      )}
    </div>
  );
}
