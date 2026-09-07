/**
 * The pontaj workflow, in the order it runs: hours are logged, overtime
 * accrues, the month's payout is approved, and the pontaj goes to accounting.
 */
export const TIMESHEET_TABS = ['timesheets', 'overtime', 'approvals', 'accounting'] as const;

export type TimesheetTab = (typeof TIMESHEET_TABS)[number];

export const DEFAULT_TIMESHEET_TAB: TimesheetTab = 'timesheets';

export function parseTimesheetTab(value: string | null | undefined): TimesheetTab {
  if (value === 'overtime' || value === 'approvals' || value === 'accounting') {
    return value;
  }
  return DEFAULT_TIMESHEET_TAB;
}

export const TIMESHEET_TAB_ITEMS: { id: TimesheetTab; label: string; icon: string }[] = [
  { id: 'timesheets', label: 'Pontaj', icon: 'ti-clock' },
  { id: 'overtime', label: 'Ore suplimentare', icon: 'ti-flame' },
  { id: 'approvals', label: 'Aprobări', icon: 'ti-checks' },
  { id: 'accounting', label: 'Contabilitate', icon: 'ti-file-invoice' },
];
