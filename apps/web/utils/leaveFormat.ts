import type { LeaveStatus } from '@fabxpert/shared';
import {
  formatDateDisplay,
  formatLeaveDateRange,
  formatLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
} from '@fabxpert/shared';

export {
  formatLeaveDateRange,
  formatLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
};

export function getLeaveStatusBadgeClassName(status: LeaveStatus): string {
  switch (status) {
    case 'IN_ASTEPTARE':
      return 'bg-status-in-productie-bg text-status-in-productie-text';
    case 'APROBAT':
      return 'bg-status-livrat-bg text-status-livrat-text';
    case 'RESPINS':
      return 'bg-status-anulat-bg text-status-anulat-text';
    default:
      return 'bg-status-ciorna-bg text-status-ciorna-text';
  }
}

export function formatReviewedAt(iso: string): string {
  return formatDateDisplay(iso);
}

export function truncateReason(reason: string, maxLength = 48): string {
  if (reason.length <= maxLength) {
    return reason;
  }

  return `${reason.slice(0, maxLength).trimEnd()}…`;
}
