import { REQUESTABLE_LEAVE_TYPE_VALUES } from './dto/leave.dto';
import { formatOvertimeHours } from './overtime';
import type { LeaveStatus, LeaveType, RequestableLeaveType } from './dto/leave.dto';
import { parseWorkDateString } from './workDate';

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ODIHNA: 'Odihnă',
  MEDICAL: 'Medical',
  NEPLATIT: 'Neplătit',
  RECUPERARE: 'Recuperare',
};

/** Drives the type dropdowns. NEPLATIT is missing on purpose — old rows still label. */
export const LEAVE_TYPE_OPTIONS: { value: RequestableLeaveType; label: string }[] =
  REQUESTABLE_LEAVE_TYPE_VALUES.map((value) => ({ value, label: LEAVE_TYPE_LABELS[value] }));

export function getLeaveTypeLabel(type: LeaveType): string {
  return LEAVE_TYPE_LABELS[type] ?? type;
}

/** False for retired types (NEPLATIT), which only appear on old rows. */
export function isRequestableLeaveType(type: LeaveType): type is RequestableLeaveType {
  return REQUESTABLE_LEAVE_TYPE_VALUES.some((value) => value === type);
}

export function getLeaveStatusLabel(status: LeaveStatus): string {
  switch (status) {
    case 'IN_ASTEPTARE':
      return 'În așteptare';
    case 'APROBAT':
      return 'Aprobat';
    case 'RESPINS':
      return 'Respins';
    default:
      return status;
  }
}

/** How long a request is: "2 zile", or "2h 30m" when it was asked for in hours. */
export function formatLeaveDuration(request: {
  dayCount: number;
  durationMinutes: number | null;
}): string {
  return request.durationMinutes !== null
    ? formatOvertimeHours(request.durationMinutes)
    : formatLeaveDayCount(request.dayCount);
}

export function formatLeaveDayCount(count: number): string {
  if (count === 1) {
    return '1 zi';
  }

  return `${count} zile`;
}

type FormatLeaveDateRangeOptions = {
  includeYear?: boolean;
};

/** Romanian date range: "12–16 iul" or "12–16 iul 2026" with includeYear. */
export function formatLeaveDateRange(
  startDate: string,
  endDate: string,
  options: FormatLeaveDateRangeOptions = {},
): string {
  const start = parseWorkDateString(startDate);
  const end = parseWorkDateString(endDate);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');
  const endMonth = end.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');
  const yearSuffix = options.includeYear ? ` ${start.getFullYear()}` : '';

  if (startDate === endDate) {
    return `${startDay} ${startMonth}${yearSuffix}`;
  }

  if (startMonth === endMonth) {
    const endYear =
      options.includeYear && start.getFullYear() !== end.getFullYear()
        ? ` ${end.getFullYear()}`
        : yearSuffix;
    return `${startDay}–${endDay} ${startMonth}${endYear}`;
  }

  const startPart = `${startDay} ${startMonth}${options.includeYear ? ` ${start.getFullYear()}` : ''}`;
  const endPart = `${endDay} ${endMonth}${options.includeYear ? ` ${end.getFullYear()}` : ''}`;
  return `${startPart} – ${endPart}`;
}
