/** Contractual working day. Anything logged past it accrues as overtime. */
export const DAILY_WORK_MINUTES = 540; // 9h

/** A worked Saturday is paid as a 7.5h day; only what is logged past it is overtime. */
export const SATURDAY_WORK_MINUTES = 450;

/** One day a person logged time on, with everything that day is credited for. */
export type OvertimeDay = {
  /** Minutes logged that day. */
  loggedMinutes: number;
  /** Approved leave covering that day — a whole day off is DAILY_WORK_MINUTES. */
  leaveMinutes?: number;
  /** Weekend work is never a debt. Defaults to true. */
  isWorkingDay?: boolean;
  /**
   * A worked Saturday counts as a day at the Saturday norm, so only the hours
   * past SATURDAY_WORK_MINUTES are overtime. A Sunday stays hour for hour.
   */
  isSaturday?: boolean;
  /** Today, still being worked. It can earn overtime but cannot owe any yet. */
  isInProgress?: boolean;
};

/**
 * Running overtime over a set of days.
 *
 * A working day counts for what it is short of, or over, the contractual day:
 * ten hours is +1h, eight is −1h. A Saturday is paid as a worked day of 7.5h,
 * so only what is logged past that is overtime — nine hours on a Saturday is
 * +1h 30m, four hours is nothing. A Sunday has no norm at all: everything
 * logged on it is overtime.
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
      return (
        sum +
        (day.isSaturday
          ? Math.max(0, day.loggedMinutes - SATURDAY_WORK_MINUTES)
          : day.loggedMinutes)
      );
    }

    const delta = day.loggedMinutes + (day.leaveMinutes ?? 0) - DAILY_WORK_MINUTES;
    return sum + (day.isInProgress ? Math.max(0, delta) : delta);
  }, 0);
}

/** Saturdays with any time logged — each one is a worked Saturday, however short. */
export function countSaturdaysWorked(days: OvertimeDay[]): number {
  return days.filter(
    (day) => day.isWorkingDay === false && day.isSaturday === true && day.loggedMinutes > 0,
  ).length;
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

/** One person's month, as the pontaj for accounting reads it. */
export type AccountingHoursInput = {
  /** Every minute logged on timesheets that month. */
  loggedMinutes: number;
  /** Overtime the month produced, by the balance rule. Negative for a short month. */
  earnedMinutes: number;
  /** Paid at settlement. Null while the month is not approved yet. */
  paidMinutes: number | null;
};

export type AccountingHoursSplit = {
  normalMinutes: number;
  overtimeMinutes: number;
  totalMinutes: number;
};

/**
 * How a month's hours split on the pontaj sent to accounting.
 *
 * Normal hours are what was logged minus the overtime the month produced — a
 * short month is simply the hours logged. Overtime is only what the settlement
 * approved for payment; before approval it is zero, so an unapproved balance
 * never reaches accounting.
 */
export function accountingHours(input: AccountingHoursInput): AccountingHoursSplit {
  const normalMinutes = Math.max(
    input.loggedMinutes - Math.max(input.earnedMinutes, 0),
    0,
  );
  const overtimeMinutes = Math.max(input.paidMinutes ?? 0, 0);

  return {
    normalMinutes,
    overtimeMinutes,
    totalMinutes: normalMinutes + overtimeMinutes,
  };
}

/**
 * How many days before a month ends its settlement opens. The month is closed
 * in its last week, not after it: the last day can fall on a weekend, and the
 * hours have to be approved while there is someone in the office to approve
 * them. Seven days always cover a full Monday-to-Sunday week.
 */
export const SETTLEMENT_WINDOW_DAYS = 7;

/** First day the overtime of `month` can be approved. Any day of the month works. */
export function settlementOpensOn(month: Date): Date {
  return new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    1 - SETTLEMENT_WINDOW_DAYS,
    0,
    0,
    0,
    0,
  );
}

/** Whether the overtime of `month` can be approved yet. */
export function isMonthSettleable(month: Date, reference = new Date()): boolean {
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  return today.getTime() >= settlementOpensOn(month).getTime();
}

/**
 * The newest month open for approval — what the month-end flow is about: the
 * current month once its last week starts, the one before it until then.
 */
export function latestSettleableMonth(reference = new Date()): Date {
  const currentMonth = new Date(reference.getFullYear(), reference.getMonth(), 1, 0, 0, 0, 0);
  return isMonthSettleable(currentMonth, reference)
    ? currentMonth
    : new Date(reference.getFullYear(), reference.getMonth() - 1, 1, 0, 0, 0, 0);
}
