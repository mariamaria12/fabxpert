import type { TimesheetSummaryPeriod } from './dto/timesheet.dto';

export type Period =
  | { kind: 'today' }
  | { kind: 'week' }
  | { kind: 'month' }
  | { kind: 'custom'; from: string; to: string };

export type PeriodQueryParams = {
  period: TimesheetSummaryPeriod;
  from?: string;
  to?: string;
};

export function periodToQuery(period: Period): PeriodQueryParams {
  if (period.kind === 'custom') {
    return {
      period: 'custom',
      from: period.from,
      to: period.to,
    };
  }

  return { period: period.kind };
}

/** Whether the period can be sent to the API (custom requires both dates). */
export function isPeriodQueryReady(period: Period): boolean {
  if (period.kind !== 'custom') {
    return true;
  }

  return period.from.trim().length > 0 && period.to.trim().length > 0;
}

export function periodsEqual(left: Period, right: Period): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === 'custom' && right.kind === 'custom') {
    return left.from === right.from && left.to === right.to;
  }

  return true;
}
