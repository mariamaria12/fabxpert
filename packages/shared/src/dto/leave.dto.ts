import { z } from 'zod';

export const LEAVE_TYPE_VALUES = ['ODIHNA', 'MEDICAL', 'NEPLATIT'] as const;
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

export const createLeaveRequestSchema = z
  .object({
    type: leaveTypeSchema,
    startDate: leaveDateSchema,
    endDate: leaveDateSchema,
    reason: z.string().optional(),
  })
  .superRefine(endDateOnOrAfterStartDate);

export const updateLeaveRequestSchema = z
  .object({
    type: leaveTypeSchema.optional(),
    startDate: leaveDateSchema.optional(),
    endDate: leaveDateSchema.optional(),
    reason: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
  .superRefine(endDateOnOrAfterStartDate);

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
  createdAt: string;
};

export type LeaveBalanceDto = {
  personId: string;
  annualLeaveDays: number;
  usedDays: number;
  remainingDays: number;
};

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
