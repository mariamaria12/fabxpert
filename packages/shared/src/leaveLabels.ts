import type { LeaveStatus, LeaveType } from './dto/leave.dto';
import { parseWorkDateString } from './workDate';

export const LEAVE_TYPE_OPTIONS: { value: LeaveType; label: string }[] = [
  { value: 'ODIHNA', label: 'Odihnă' },
  { value: 'MEDICAL', label: 'Medical' },
  { value: 'NEPLATIT', label: 'Neplătit' },
];

export function getLeaveTypeLabel(type: LeaveType): string {
  return LEAVE_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
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
