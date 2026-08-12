import type { ReportPeriodKind } from './dto/report.dto';

// Interval selector for the Rapoarte page. Default is last month; the current
// month and a custom day range are the other choices. Membership is by a
// project's completion date, so these are calendar ranges, not workDate ranges.

export type ReportPeriod =
  | { kind: 'lastMonth' }
  | { kind: 'currentMonth' }
  | { kind: 'custom'; from: string; to: string };

export type ReportPeriodQueryParams = {
  period: ReportPeriodKind;
  from?: string;
  to?: string;
};

export const DEFAULT_REPORT_PERIOD: ReportPeriod = { kind: 'lastMonth' };

export function reportPeriodToQuery(period: ReportPeriod): ReportPeriodQueryParams {
  if (period.kind === 'custom') {
    return { period: 'custom', from: period.from, to: period.to };
  }
  return { period: period.kind };
}

/** Whether the period can be sent to the API (custom needs both dates). */
export function isReportPeriodReady(period: ReportPeriod): boolean {
  if (period.kind !== 'custom') {
    return true;
  }
  return period.from.trim().length > 0 && period.to.trim().length > 0;
}

export function reportPeriodsEqual(left: ReportPeriod, right: ReportPeriod): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'custom' && right.kind === 'custom') {
    return left.from === right.from && left.to === right.to;
  }
  return true;
}
