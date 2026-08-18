/** Contractual working day. Anything logged past it accrues as overtime. */
export const DAILY_WORK_MINUTES = 540; // 9h

/** One day a person logged time on, with everything that day is credited for. */
export type OvertimeDay = {
  /** Minutes logged that day. */
  loggedMinutes: number;
  /** Approved leave covering that day — a whole day off is DAILY_WORK_MINUTES. */
  leaveMinutes?: number;
  /** Weekends can only add overtime; a short Saturday is not a debt. Defaults to true. */
  isWorkingDay?: boolean;
};

/**
 * Running overtime over a set of days: a working day counts for what it is
 * short of, or over, the contractual day. Ten hours is +1h, eight is −1h.
 *
 * Only days the person logged time on are passed in — a day with no timesheet
 * at all is not a debt, it is simply not counted.
 *
 * Leave already covering a day is credited before the comparison, so an hour
 * of RECUPERARE is charged once (against the balance) and not a second time as
 * a short day.
 */
export function overtimeBalanceMinutes(days: OvertimeDay[]): number {
  return days.reduce((sum, day) => {
    if (day.isWorkingDay === false) {
      return sum + Math.max(0, day.loggedMinutes - DAILY_WORK_MINUTES);
    }

    return sum + day.loggedMinutes + (day.leaveMinutes ?? 0) - DAILY_WORK_MINUTES;
  }, 0);
}

/** Whole days off a balance covers — one day off costs a full working day. */
export function overtimeDaysAvailable(balanceMinutes: number): number {
  return Math.floor(balanceMinutes / DAILY_WORK_MINUTES);
}

/** Minutes as hours, no sign: "12h", "12h 30m", "30m". */
export function formatOvertimeHours(minutes: number): string {
  const total = Math.abs(Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;

  if (total === 0) {
    return '0h';
  }
  if (hours === 0) {
    return `${rest}m`;
  }

  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * A balance always carries its sign: "+12h 30m" when there is time to take off,
 * "−4h" when a day was taken before it was earned and has to be worked back.
 */
export function formatOvertimeBalance(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded === 0) {
    return '0h';
  }

  return `${rounded > 0 ? '+' : '−'}${formatOvertimeHours(rounded)}`;
}
