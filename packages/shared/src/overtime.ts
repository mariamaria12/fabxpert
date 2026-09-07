/** Contractual working day. Anything logged past it accrues as overtime. */
export const DAILY_WORK_MINUTES = 540; // 9h

/** One day a person logged time on, with everything that day is credited for. */
export type OvertimeDay = {
  /** Minutes logged that day. */
  loggedMinutes: number;
  /** Approved leave covering that day — a whole day off is DAILY_WORK_MINUTES. */
  leaveMinutes?: number;
  /** Weekend work is overtime hour for hour, never a debt. Defaults to true. */
  isWorkingDay?: boolean;
  /** Today, still being worked. It can earn overtime but cannot owe any yet. */
  isInProgress?: boolean;
};

/**
 * Running overtime over a set of days.
 *
 * A working day counts for what it is short of, or over, the contractual day:
 * ten hours is +1h, eight is −1h. A weekend day has no contractual hours to
 * meet, so everything logged on it is overtime — four hours on a Saturday is
 * +4h.
 *
 * Only days the person logged time on are passed in — a day with no timesheet
 * at all is not a debt, it is simply not counted.
 *
 * Today is the exception: it is charged for nothing until it is over, because
 * the first pontaj of the morning would otherwise open the whole contractual
 * day as a debt and the balance would sink on its way back up. Time already
 * logged past the norm today still counts.
 *
 * Leave already covering a day is credited before the comparison, so an hour
 * of RECUPERARE is charged once (against the balance) and not a second time as
 * a short day.
 */
export function overtimeBalanceMinutes(days: OvertimeDay[]): number {
  return days.reduce((sum, day) => {
    if (day.isWorkingDay === false) {
      return sum + day.loggedMinutes;
    }

    const delta = day.loggedMinutes + (day.leaveMinutes ?? 0) - DAILY_WORK_MINUTES;
    return sum + (day.isInProgress ? Math.max(0, delta) : delta);
  }, 0);
}

/** How a month's balance splits when it is settled. */
export type OvertimeSettlementSplit = {
  /** Paid out. Never negative — a debt is carried, never paid. */
  paidMinutes: number;
  /** Rolls into the next month: the reserve, or the debt. */
  carriedOutMinutes: number;
};

/**
 * Splits a month's balance into what is paid and what carries on.
 *
 * Everything is paid by default. A reserve is what the person keeps instead,
 * so they can still take a day off next month; it is capped at the balance,
 * because you cannot keep more than you earned.
 *
 * A debt is never paid — it carries whole into the next month and is worked
 * back there.
 */
export function settleOvertimeBalance(
  balanceMinutes: number,
  reserveMinutes = 0,
): OvertimeSettlementSplit {
  if (balanceMinutes <= 0) {
    return { paidMinutes: 0, carriedOutMinutes: balanceMinutes };
  }

  const reserve = Math.min(Math.max(reserveMinutes, 0), balanceMinutes);
  return { paidMinutes: balanceMinutes - reserve, carriedOutMinutes: reserve };
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
