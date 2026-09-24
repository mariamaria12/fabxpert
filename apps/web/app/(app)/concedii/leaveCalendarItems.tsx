'use client';

import {
  formatLeaveDuration,
  isWorkingDate,
  LEAVE_TYPE_OPTIONS,
  workDateToDayKey,
  type LeaveRequestDto,
  type LeaveType,
} from '@fabxpert/shared';
import type { CalendarItem } from '@/components/calendar/CalendarView';
import { getLeaveStatusLabel, getLeaveTypeLabel } from '@/utils/leaveFormat';

/** Each type keeps one palette, so a month reads at a glance. */
const TYPE_PALETTE: Record<LeaveType, string> = {
  ODIHNA: 'info',
  RECUPERARE: 'cyan',
  MEDICAL: 'danger',
  NEPLATIT: 'warning',
  BLOOD_DONATION: 'purple',
};

function typeChipStyle(type: LeaveType) {
  const palette = TYPE_PALETTE[type];
  return {
    backgroundColor: `var(--color-${palette}-bg)`,
    color: `var(--color-${palette}-text)`,
    borderColor: `var(--color-${palette}-border)`,
  };
}

/** The type's colour where a chip has no room for text — bars, year dots. */
export function leaveTypeColor(type: LeaveType): string {
  return `var(--color-${TYPE_PALETTE[type]}-text)`;
}

/** How a person sorts inside a day: last name, then first. */
export function personSortKey(person: { firstName: string; lastName: string }): string {
  return `${person.lastName} ${person.firstName}`;
}

/** "Ion P." — enough to tell people apart in a day cell. */
export function shortPersonName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName.charAt(0)}.`;
}

export function LeaveChip({
  request,
  onOpen,
}: {
  request: LeaveRequestDto;
  onOpen: (request: LeaveRequestDto) => void;
}) {
  const pending = request.status === 'IN_ASTEPTARE';
  const rejected = request.status === 'RESPINS';
  const hours = request.durationMinutes !== null ? ` · ${formatLeaveDuration(request)}` : '';
  const fullName = `${request.person.firstName} ${request.person.lastName}`;

  return (
    <button
      type="button"
      onClick={() => onOpen(request)}
      title={`${fullName} — ${getLeaveTypeLabel(request.type)}${hours} · ${getLeaveStatusLabel(request.status)}`}
      style={typeChipStyle(request.type)}
      className={`flex w-full min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-left text-[11px] font-medium leading-4 transition-opacity hover:opacity-80 ${
        pending ? 'border-dashed' : ''
      } ${rejected ? 'line-through opacity-50' : ''}`}
    >
      {pending ? <i className="ti ti-clock shrink-0 text-[11px]" aria-hidden="true" /> : null}
      <span className="truncate">
        {shortPersonName(request.person)}
        {hours}
      </span>
    </button>
  );
}

/**
 * Leave per working day of `days`, each with its sort key. Leave never counts
 * weekends or public holidays, so it is not drawn on them either.
 */
export function leaveItemsByDay(
  requests: LeaveRequestDto[],
  days: Date[],
  onOpen: (request: LeaveRequestDto) => void,
): Map<string, (CalendarItem & { sortKey: string })[]> {
  const byDay = new Map<string, (CalendarItem & { sortKey: string })[]>();
  for (const day of days) {
    if (!isWorkingDate(day)) {
      continue;
    }
    const key = workDateToDayKey(day);
    const items = requests
      .filter((request) => request.startDate <= key && request.endDate >= key)
      .map((request) => ({
        key: `leave-${request.id}`,
        sortKey: personSortKey(request.person),
        color: leaveTypeColor(request.type),
        node: <LeaveChip request={request} onOpen={onOpen} />,
      }));
    if (items.length > 0) {
      byDay.set(key, items);
    }
  }
  return byDay;
}

export function LeaveTypeLegend() {
  return (
    <>
      {LEAVE_TYPE_OPTIONS.map((option) => (
        <span key={option.value} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-sm border"
            style={typeChipStyle(option.value)}
            aria-hidden="true"
          />
          {option.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <i className="ti ti-clock text-xs" aria-hidden="true" />
        contur punctat: în așteptare
      </span>
    </>
  );
}
