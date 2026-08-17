import { z } from 'zod';
import { DAILY_WORK_MINUTES } from '../overtime';
import type { TimesheetSummaryPeriod } from './timesheet.dto';

export const LEAVE_TYPE_VALUES = ['ODIHNA', 'MEDICAL', 'NEPLATIT', 'RECUPERARE'] as const;
export const LEAVE_STATUS_VALUES = [
  'IN_ASTEPTARE',
  'APROBAT',
  'RESPINS',
] as const;

export type LeaveType = (typeof LEAVE_TYPE_VALUES)[number];
export type LeaveStatus = (typeof LEAVE_STATUS_VALUES)[number];

const leaveDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/** UUID-like id (accepts seed person ids with `p` prefix). */
const uuidSchema = z
  .string()
  .regex(
    /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const leaveTypeSchema = z.enum(LEAVE_TYPE_VALUES);
const reviewStatusSchema = z.enum(['APROBAT', 'RESPINS']);

function endDateOnOrAfterStartDate(
  data: { startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
) {
  if (data.startDate === undefined || data.endDate === undefined) {
    return;
  }
  if (data.endDate < data.startDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'endDate must be on or after startDate',
      path: ['endDate'],
    });
  }
}

/** Partial-day RECUPERARE, capped at one working day (9h). */
const durationMinutesSchema = z
  .number()
  .int('durationMinutes must be a whole number of minutes')
  .min(15, 'durationMinutes must be at least 15')
  .max(DAILY_WORK_MINUTES, `durationMinutes cannot exceed ${DAILY_WORK_MINUTES}`);

/** Hours off happen on a single day, so the range must not span dates. */
function partialDayIsSingleDate(
  data: { durationMinutes?: number; startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
) {
  if (data.durationMinutes === undefined) {
    return;
  }
  if (data.startDate !== undefined && data.endDate !== undefined && data.startDate !== data.endDate) {
    ctx.addIssue({
      code: 'custom',
      message: 'A request in hours must start and end on the same date',
      path: ['endDate'],
    });
  }
}

/** Only RECUPERARE can be taken in hours; the rest are whole days. */
function hoursOnlyForRecuperare(
  data: { durationMinutes?: number; type?: LeaveType },
  ctx: z.RefinementCtx,
) {
  if (data.durationMinutes !== undefined && data.type !== undefined && data.type !== 'RECUPERARE') {
    ctx.addIssue({
      code: 'custom',
      message: 'Only RECUPERARE can be requested in hours',
      path: ['durationMinutes'],
    });
  }
}

export const createLeaveRequestSchema = z
  .object({
    type: leaveTypeSchema,
    startDate: leaveDateSchema,
    endDate: leaveDateSchema,
    reason: z.string().optional(),
    /** Hours off instead of whole days. Omit for a normal day-range request. */
    durationMinutes: durationMinutesSchema.optional(),
    /** Admin only — creates the request on behalf of that person. */
    personId: uuidSchema.optional(),
  })
  .superRefine(endDateOnOrAfterStartDate)
  .superRefine(partialDayIsSingleDate)
  .superRefine(hoursOnlyForRecuperare);

export const updateLeaveRequestSchema = z
  .object({
    type: leaveTypeSchema.optional(),
    startDate: leaveDateSchema.optional(),
    endDate: leaveDateSchema.optional(),
    reason: z.string().optional(),
    /** Null switches a request back to whole days. */
    durationMinutes: durationMinutesSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
  .superRefine(endDateOnOrAfterStartDate)
  .superRefine((data, ctx) => {
    if (data.durationMinutes === null) {
      return;
    }
    partialDayIsSingleDate({ ...data, durationMinutes: data.durationMinutes }, ctx);
    hoursOnlyForRecuperare({ ...data, durationMinutes: data.durationMinutes }, ctx);
  });

export const reviewLeaveRequestSchema = z.object({
  status: reviewStatusSchema,
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;
export type ReviewLeaveRequestInput = z.infer<typeof reviewLeaveRequestSchema>;

export type LeaveRequestPersonDto = {
  id: string;
  firstName: string;
  lastName: string;
};

export type LeaveRequestReviewerDto = {
  id: string;
  email: string;
};

export type LeaveRequestDto = {
  id: string;
  person: LeaveRequestPersonDto;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  reason: string | null;
  reviewedBy: LeaveRequestReviewerDto | null;
  reviewedAt: string | null;
  dayCount: number;
  /** Minutes off when the request is in hours; null when it is in whole days. */
  durationMinutes: number | null;
  createdAt: string;
};

export type LeaveBalanceDto = {
  personId: string;
  annualLeaveDays: number;
  usedDays: number;
  remainingDays: number;
};

export type LeaveBalancePersonDto = {
  id: string;
  firstName: string;
  lastName: string;
  annualLeaveDays: number;
  employeeRole: { name: string } | null;
};

export type LeaveBalanceRowDto = {
  person: LeaveBalancePersonDto;
  balance: LeaveBalanceDto;
};

export type LeaveBalancesResponse = {
  year: number;
  rows: LeaveBalanceRowDto[];
};

export type OnLeaveResponse = {
  period: TimesheetSummaryPeriod;
  requests: LeaveRequestDto[];
};

/** @deprecated Use OnLeaveResponse */
export type OnLeaveTodayResponse = OnLeaveResponse;

/** Employee create/update responses include current balance for UI warnings. */
export type EmployeeLeaveRequestResponse = {
  leaveRequest: LeaveRequestDto;
  balance: LeaveBalanceDto;
};

/** Admin review response; overBalanceWarning when approving ODIHNA beyond entitlement. */
export type ReviewLeaveRequestResponse = {
  leaveRequest: LeaveRequestDto;
  overBalanceWarning?: boolean;
};
