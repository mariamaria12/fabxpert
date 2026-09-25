import { z } from 'zod';

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
   * work back when negative. Months settled late are folded in here too, and so
   * is anything logged in the last settled month after it was approved.
   */
  carriedInMinutes: number;
  /** Earned this month, computed live from timesheets. */
  earnedMinutes: number;
  /** RECUPERARE taken this month. */
  usedMinutes: number;
  /** Saturdays with time logged this month — paid as days, not as overtime. */
  saturdaysWorked: number;
  /** Approved for pay already: non-zero only once this month is approved before it ends. */
  paidMinutes: number;
  /** carriedInMinutes + earnedMinutes − usedMinutes − paidMinutes. */
  remainingMinutes: number;
  /** Whole days off `remainingMinutes` covers. */
  remainingDays: number;
  /** Last settled month as `YYYY-MM`; null when nothing is settled yet. */
  settledThroughMonth: string | null;
  /** The balance an admin last set by hand; null when it was never corrected. */
  correction: OvertimeCorrectionDto | null;
};

/**
 * A balance set by hand. It replaces everything before `effectiveDate`, a
 * month still waiting for approval included; days from then on count on top.
 */
export type OvertimeCorrectionDto = {
  id: string;
  /** First day counted on top of the correction, as `YYYY-MM-DD`. */
  effectiveDate: string;
  balanceMinutes: number;
  /** What the balance read just before it was corrected. */
  previousBalanceMinutes: number;
  note: string | null;
  createdAt: string;
  createdBy: { firstName: string; lastName: string } | null;
};

/** Signed hours an admin can set: a debt as low as a month of full days, overtime as high. */
export const MAX_OVERTIME_CORRECTION_MINUTES = 400 * 60;

export const createOvertimeCorrectionSchema = z.object({
  personId: z
    .string()
    .regex(
      /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Invalid UUID format',
    ),
  balanceMinutes: z
    .number()
    .int()
    .min(-MAX_OVERTIME_CORRECTION_MINUTES)
    .max(MAX_OVERTIME_CORRECTION_MINUTES),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export type CreateOvertimeCorrectionInput = z.infer<typeof createOvertimeCorrectionSchema>;

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
  /** Saturdays with time logged that month. */
  saturdaysWorked: number;
  /** carriedIn + earned − used: what the settlement splits. */
  balanceMinutes: number;
  /** Kept instead of paid. Zero unless an admin sets a reserve. */
  reserveMinutes: number;
  paidMinutes: number;
  carriedOutMinutes: number;
  /** When this person's month was approved, as ISO; null while it still waits. */
  settledAt: string | null;
  /** What the approval put up for pay; null while the month still waits. */
  approvedPaidMinutes: number | null;
  /**
   * How far the balance moved since the approval — hours logged after it or
   * pontaje corrected. Non-zero means the line waits to be approved again.
   */
  changeSinceApprovalMinutes: number;
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

/** People whose last complete month still waits for approval — the sidebar badge. */
export type OvertimeApprovalsPendingResponse = {
  month: string;
  count: number;
};

/**
 * Where one person's month stands on the pontaj for accounting. EXPORTAT is
 * month-wide: the document was generated and the month is closed until it is
 * reopened.
 */
export type AccountingTimesheetStatus = 'IN_PREGATIRE' | 'GATA_EXPORT' | 'EXPORTAT';

export type AccountingTimesheetLineDto = {
  person: OvertimeBalancePersonDto;
  /** External collaborator: on the pontaj, but with no fixed days — nothing reads as missing. */
  isExternal: boolean;
  /** Never logs time: read as present on every working day without leave. */
  isAutoPresent: boolean;
  /** Every minute logged that month. */
  loggedMinutes: number;
  normalMinutes: number;
  /** Overtime approved for payment. Zero until the month is approved. */
  overtimeMinutes: number;
  totalMinutes: number;
  /** Saturdays with time logged — paid as days, not as overtime. */
  saturdaysWorked: number;
  /**
   * One code per calendar day of the month (index 0 is the 1st): X, a leave
   * code, or '' for nothing. Weekends and public holidays stay '' — a Saturday
   * is counted in `saturdaysWorked`, anything else worked goes to overtime.
   */
  dayCodes: string[];
  /** Working days already past with neither a pontaj nor approved leave, as `YYYY-MM-DD`. */
  missingWorkingDays: string[];
  /** Balance still waiting for approval; null once approved, or when nothing needs it. */
  pendingBalanceMinutes: number | null;
  status: AccountingTimesheetStatus;
  settledAt: string | null;
};

/** Over the lines that reach the document — external collaborators are not in them. */
export type AccountingTimesheetTotals = {
  persons: number;
  normalMinutes: number;
  overtimeMinutes: number;
  totalMinutes: number;
  /** Lines still waiting for approval, and the hours they hold back. */
  pendingCount: number;
  pendingBalanceMinutes: number;
  /** People with at least one working day unaccounted for, and how many such days in all. */
  missingDaysPersons: number;
  missingDays: number;
};

/** The document was generated: the month is closed until someone reopens it. */
export type AccountingExportDto = {
  exportedAt: string;
  exportedBy: { firstName: string; lastName: string } | null;
};

/**
 * Everyone on the payroll pontaj: external collaborators included, office
 * staff left out.
 */
export type AccountingTimesheetResponse = {
  /** `YYYY-MM`. */
  month: string;
  /**
   * The month's approvals have opened — its last week, or later. Until then
   * nothing can be approved and every line is in preparation.
   */
  settlementOpen: boolean;
  /** Mon–Fri days in the month, holidays aside — the norm on the document. */
  workingDays: number;
  export: AccountingExportDto | null;
  lines: AccountingTimesheetLineDto[];
  totals: AccountingTimesheetTotals;
};

export type ReopenAccountingMonthResponse = {
  month: string;
  reopened: boolean;
};

/**
 * What an admin can put on a working day that has neither a pontaj nor
 * leave, while generating the pontaj: present (an X with no hours), or an
 * approved single-day leave of the given type.
 */
export const ACCOUNTING_DAY_RESOLUTIONS = [
  'PRESENT',
  'ODIHNA',
  'MEDICAL',
  'NEPLATIT',
  'RECUPERARE',
  'BLOOD_DONATION',
] as const;

export type AccountingDayResolution = (typeof ACCOUNTING_DAY_RESOLUTIONS)[number];

const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID format');

export const resolveAccountingDaysSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM'),
  resolutions: z
    .array(
      z.object({
        personId: uuidSchema,
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
        resolution: z.enum(ACCOUNTING_DAY_RESOLUTIONS),
      }),
    )
    .min(1),
});

export type ResolveAccountingDaysInput = z.infer<typeof resolveAccountingDaysSchema>;

export type ResolveAccountingDaysResponse = {
  /** Days written: presences marked plus leave created. */
  resolved: number;
  /** Days left alone — already covered by leave or a pontaj by the time this ran. */
  skipped: number;
};
