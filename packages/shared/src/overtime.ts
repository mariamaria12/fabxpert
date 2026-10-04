/**
 * Default contractual working day, for anyone without a norm of their own.
 * Anything logged past a person's norm accrues as overtime.
 */
export const DAILY_WORK_MINUTES = 540; // 9h

/** Longest norm a contract can set — also the cap on hours off taken in one day. */
export const MAX_DAILY_WORK_MINUTES = 720; // 12h

/** A person's working day: their own norm, or the default when none is set. */
export function dailyWorkMinutesOf(norm: number | null | undefined): number {
  return norm ?? DAILY_WORK_MINUTES;
}

/**
 * What the pontaj app suggests for a Saturday entry. Not a norm: weekend hours
 * are counted as logged, apart from the balance. It is still the threshold of
 * the months approved before that split — see `weekendInBalance`.
 */
export const SATURDAY_WORK_MINUTES = 450;

/** One day a person logged time on, with everything that day is credited for. */
export type OvertimeDay = {
  /** Minutes logged that day. */
  loggedMinutes: number;
  /** Approved leave covering that day — a whole day off is the person's daily norm. */
  leaveMinutes?: number;
  /** False on a weekend or a public holiday — never a debt. Defaults to true. */
  isWorkingDay?: boolean;
  isSaturday?: boolean;
  /** A Sunday is counted in its own column, public holiday or not. */
  isSunday?: boolean;
  /** Today, still being worked. It can earn overtime but cannot owe any yet. */
  isInProgress?: boolean;
};

export type OvertimeBalanceOptions = {
  /**
   * How months approved before weekend hours were counted apart read: a
   * Saturday is a 7.5h day and only what is logged past it is overtime, a
   * Sunday or a public holiday is overtime hour for hour. Those months stay as
   * they were approved; everything after them leaves the weekend out.
   */
  weekendInBalance?: boolean;
};

/**
 * Running overtime over a set of days.
 *
 * A working day counts for what it is short of, or over, the person's daily
 * norm: on the default 9h, ten hours is +1h and eight is −1h; on a 6h contract,
 * seven hours is +1h. Saturdays, Sundays and public holidays have no norm and
 * add nothing here: their hours are counted as logged, in columns of their own
 * (see `weekendMinutes`).
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
export function overtimeBalanceMinutes(
  days: OvertimeDay[],
  dailyWorkMinutes = DAILY_WORK_MINUTES,
  options: OvertimeBalanceOptions = {},
): number {
  return days.reduce((sum, day) => {
    if (day.isWorkingDay === false) {
      if (!options.weekendInBalance) {
        return sum;
      }
      return (
        sum +
        (day.isSaturday
          ? Math.max(0, day.loggedMinutes - SATURDAY_WORK_MINUTES)
          : day.loggedMinutes)
      );
    }

    const delta = day.loggedMinutes + (day.leaveMinutes ?? 0) - dailyWorkMinutes;
    return sum + (day.isInProgress ? Math.max(0, delta) : delta);
  }, 0);
}

/** Saturdays with any time logged — each one is a worked Saturday, however short. */
export function countSaturdaysWorked(days: OvertimeDay[]): number {
  return days.filter(
    (day) => day.isWorkingDay === false && day.isSaturday === true && day.loggedMinutes > 0,
  ).length;
}

/** A day off that is not a Sunday: a Saturday, or a public holiday in the week. */
function isSaturdayOrHoliday(day: OvertimeDay): boolean {
  return day.isWorkingDay === false && day.isSunday !== true;
}

/** Saturdays and public holidays with any time logged — the days behind `saturdayMinutes`. */
export function countSaturdaysAndHolidaysWorked(days: OvertimeDay[]): number {
  return days.filter((day) => isSaturdayOrHoliday(day) && day.loggedMinutes > 0).length;
}

export type WeekendMinutes = {
  /** Logged on Saturdays and on public holidays that fall in the week. */
  saturdayMinutes: number;
  /** Logged on Sundays, a public holiday or not. */
  sundayMinutes: number;
};

/**
 * Hours logged on days off, exactly as logged. They are no part of the
 * overtime balance: nothing is kept in reserve from them and no time off is
 * taken out of them — they go to accounting as they are, to be priced there.
 */
export function weekendMinutes(days: OvertimeDay[]): WeekendMinutes {
  let saturdayMinutes = 0;
  let sundayMinutes = 0;

  for (const day of days) {
    if (day.isWorkingDay !== false) {
      continue;
    }
    if (day.isSunday === true) {
      sundayMinutes += day.loggedMinutes;
    } else {
      saturdayMinutes += day.loggedMinutes;
    }
  }

  return { saturdayMinutes, sundayMinutes };
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

/** A month as it was approved: what it earned and spent then, and what it carried on. */
export type ApprovedMonth = {
  earnedMinutes: number;
  usedMinutes: number;
  carriedOutMinutes: number;
};

/**
 * What an approved month carries on once its hours moved after the approval:
 * days logged after an early approval, a pontaj corrected, time off taken.
 * The pay stays as approved, so the difference rides along with the carry and
 * is never lost — a reapproval pays it, a later approval takes it on.
 */
export function approvedMonthCarry(
  approved: ApprovedMonth,
  live: { earnedMinutes: number; usedMinutes: number },
): number {
  return (
    approved.carriedOutMinutes +
    (live.earnedMinutes - approved.earnedMinutes) -
    (live.usedMinutes - approved.usedMinutes)
  );
}

/** A settlement line waits while it was never approved, or its hours moved since. */
export function isOvertimeLineAwaitingApproval(line: {
  settledAt: string | null;
  changeSinceApprovalMinutes: number;
}): boolean {
  return line.settledAt === null || line.changeSinceApprovalMinutes !== 0;
}

/** Whole days off a balance covers — one day off costs a full day of the person's norm. */
export function overtimeDaysAvailable(
  balanceMinutes: number,
  dailyWorkMinutes = DAILY_WORK_MINUTES,
): number {
  return Math.floor(balanceMinutes / dailyWorkMinutes);
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
  /**
   * Of those, the minutes logged on days off that are counted in the Saturday
   * and Sunday columns. Zero on a month approved with the weekend in the balance.
   */
  weekendMinutes?: number;
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
 * Normal hours are what was logged on working days minus the overtime the month
 * produced — a short month is simply the hours logged. Weekend hours are not
 * normal hours; they have their own columns. Overtime is only what the settlement
 * approved for payment; before approval it is zero, so an unapproved balance
 * never reaches accounting.
 */
export function accountingHours(input: AccountingHoursInput): AccountingHoursSplit {
  const normalMinutes = Math.max(
    input.loggedMinutes - (input.weekendMinutes ?? 0) - Math.max(input.earnedMinutes, 0),
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
