'use client';

import { formatTaskCount } from '@fabxpert/shared';
import type { TaskDueFilter } from './taskFilters';

interface TaskAttentionSummaryProps {
  overdueCount: number;
  todayCount: number;
  thisWeekCount: number;
  /** The deadline filter in force, so its tile reads as pressed. */
  activeFilter: TaskDueFilter;
  onFilter: (filter: TaskDueFilter) => void;
}

/**
 * What needs looking at first. Shown only while something is overdue or due
 * today; each tile filters the list below to those tasks.
 */
export function TaskAttentionSummary({
  overdueCount,
  todayCount,
  thisWeekCount,
  activeFilter,
  onFilter,
}: TaskAttentionSummaryProps) {
  const attentionCount = overdueCount + todayCount;
  if (attentionCount === 0) {
    return null;
  }

  const details = [
    overdueCount > 0 ? `${overdueCount} ${overdueCount === 1 ? 'întârziat' : 'întârziate'}` : null,
    todayCount > 0
      ? `${todayCount} ${todayCount === 1 ? 'scadent astăzi' : 'scadente astăzi'}`
      : null,
  ].filter(Boolean);

  const tiles: {
    filter: Exclude<TaskDueFilter, '' | 'none'>;
    count: number;
    label: string;
    icon: string;
    tone: string;
  }[] = [
    {
      filter: 'overdue',
      count: overdueCount,
      label: 'Întârziate',
      icon: 'ti-alert-circle',
      tone: 'text-danger',
    },
    {
      filter: 'today',
      count: todayCount,
      label: 'Astăzi',
      icon: 'ti-clock-exclamation',
      tone: 'text-warning-text',
    },
    {
      filter: 'week',
      count: thisWeekCount,
      label: 'Săptămâna aceasta',
      icon: 'ti-calendar-week',
      tone: 'text-text-secondary',
    },
  ];

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface p-2 lg:flex-row lg:items-stretch">
      <div
        className={`flex min-w-0 flex-1 items-center gap-3 rounded px-3 py-2 ${
          overdueCount > 0 ? 'bg-danger-bg' : 'bg-warning-bg'
        }`}
      >
        <i
          className={`ti ti-alert-triangle shrink-0 text-xl ${
            overdueCount > 0 ? 'text-danger' : 'text-warning-text'
          }`}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">
            {attentionCount === 1
              ? '1 task necesită atenție'
              : `${formatTaskCount(attentionCount)} necesită atenție`}
          </p>
          <p className="text-xs text-text-secondary">{details.join(' · ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 lg:flex">
        {tiles.map((tile) => {
          const pressed = activeFilter === tile.filter;
          return (
            <button
              key={tile.filter}
              type="button"
              aria-pressed={pressed}
              onClick={() => onFilter(pressed ? '' : tile.filter)}
              className={`flex min-w-0 flex-col gap-1 rounded border px-3 py-2 text-left transition-colors sm:flex-row sm:items-center sm:gap-2.5 lg:min-w-[150px] ${
                pressed
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-border-subtle hover:bg-surface-hover'
              }`}
            >
              <i className={`ti ${tile.icon} shrink-0 text-lg ${tile.tone}`} aria-hidden="true" />
              <span className="min-w-0">
                <span
                  className={`block text-base font-medium tabular-nums leading-tight ${tile.tone}`}
                >
                  {tile.count}
                </span>
                <span className="block text-xs leading-tight text-text-secondary">
                  {tile.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
