/**
 * Overtime balance for one Person, in minutes (the UI divides by 60).
 *
 * Overtime settles monthly: at month end it is paid out, minus whatever reserve
 * the person keeps. So the balance is the current month's own activity plus
 * what was carried in — not a lifetime total. Months after the last settled one
 * are recomputed on every read, so a corrected timesheet shows up at once.
 */
export type OvertimeBalanceDto = {
  personId: string;
  /** The month these figures describe, as `YYYY-MM`. */
  month: string;
  /**
   * Brought in from the last settled month: a reserve when positive, a debt to
   * work back when negative. Months settled late are folded in here too.
   */
  carriedInMinutes: number;
  /** Earned this month, computed live from timesheets. */
  earnedMinutes: number;
  /** RECUPERARE taken this month. */
  usedMinutes: number;
  /** carriedInMinutes + earnedMinutes − usedMinutes. */
  remainingMinutes: number;
  /** Whole days off `remainingMinutes` covers. */
  remainingDays: number;
  /** Last settled month as `YYYY-MM`; null when nothing is settled yet. */
  settledThroughMonth: string | null;
};

export type OvertimeBalancePersonDto = {
  id: string;
  firstName: string;
  lastName: string;
  employeeRole: { name: string } | null;
};

export type OvertimeBalanceRowDto = {
  person: OvertimeBalancePersonDto;
  balance: OvertimeBalanceDto;
};

export type OvertimeBalancesResponse = {
  rows: OvertimeBalanceRowDto[];
};

/** One person's line in a month's settlement, before or after it is committed. */
export type OvertimeSettlementLineDto = {
  person: OvertimeBalancePersonDto;
  /** Carried in from the previous month. */
  carriedInMinutes: number;
  earnedMinutes: number;
  usedMinutes: number;
  /** carriedIn + earned − used: what the settlement splits. */
  balanceMinutes: number;
  /** Kept instead of paid. Zero unless an admin sets a reserve. */
  reserveMinutes: number;
  paidMinutes: number;
  carriedOutMinutes: number;
};

/** What a month would settle to, without committing anything. */
export type OvertimeSettlementPreviewResponse = {
  month: string;
  /** True when the month was settled before — settling again overwrites it. */
  alreadySettled: boolean;
  lines: OvertimeSettlementLineDto[];
  totalPaidMinutes: number;
  totalCarriedOutMinutes: number;
};

/** Result of settling one month for everyone. */
export type SettleOvertimeMonthResponse = {
  month: string;
  personsSettled: number;
  totalPaidMinutes: number;
  totalCarriedOutMinutes: number;
};
