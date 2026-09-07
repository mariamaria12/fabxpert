import type { AccountingTimesheetStatus } from '@fabxpert/shared';

/** Same shape as the leave status badges, so the two screens read alike. */
export const STATUS_BADGE_CLASS = 'inline-flex rounded px-2 py-0.5 text-xs font-medium';

export const ACCOUNTING_STATUS_LABELS: Record<AccountingTimesheetStatus, string> = {
  IN_PREGATIRE: 'În pregătire',
  GATA_EXPORT: 'Gata pentru export',
  EXPORTAT: 'Exportat',
};

export function accountingStatusBadgeClassName(status: AccountingTimesheetStatus): string {
  switch (status) {
    case 'GATA_EXPORT':
      return 'bg-status-castigat-bg text-status-castigat-text';
    case 'EXPORTAT':
      return 'bg-status-livrat-bg text-status-livrat-text';
    default:
      return 'bg-status-ciorna-bg text-status-ciorna-text';
  }
}

/** A settlement line is either approved (a row exists) or still waiting. */
export function approvalBadge(settledAt: string | null): { label: string; className: string } {
  return settledAt === null
    ? { label: 'În așteptare', className: 'bg-status-in-productie-bg text-status-in-productie-text' }
    : { label: 'Aprobat', className: 'bg-status-livrat-bg text-status-livrat-text' };
}
