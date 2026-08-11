import type { LeaveStatus } from '@fabxpert/shared';
import {
  countInclusiveLeaveDays,
  formatLeaveDateRange,
  formatLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  LEAVE_TYPE_OPTIONS,
  parseWorkDateString,
} from '@fabxpert/shared';

export {
  LEAVE_TYPE_OPTIONS,
  formatLeaveDateRange,
  formatLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
};

export function getLeaveStatusPillClassName(status: LeaveStatus): string {
  switch (status) {
    case 'IN_ASTEPTARE':
      return 'leave-status-pill leave-status-pill-pending';
    case 'APROBAT':
      return 'leave-status-pill leave-status-pill-approved';
    case 'RESPINS':
      return 'leave-status-pill leave-status-pill-rejected';
    default:
      return 'leave-status-pill';
  }
}

/** Working days from ISO date strings — must match backend leaveDays.ts. */
export function countLeaveDaysFromIso(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate || endDate < startDate) {
    return null;
  }

  return countInclusiveLeaveDays(
    parseWorkDateString(startDate),
    parseWorkDateString(endDate),
  );
}
