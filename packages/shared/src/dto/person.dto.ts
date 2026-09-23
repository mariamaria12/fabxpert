import { z } from 'zod';
import { MAX_DAILY_WORK_MINUTES } from '../overtime';

const optionalString = z.string().optional();

const optionalEmail = z
  .union([z.string().email(), z.literal('')])
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const employeeRoleIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

export const createPersonSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: optionalEmail,
  phone: optionalString,
  employeeRoleId: employeeRoleIdSchema.optional(),
  /** Never logs time — read as present on every working day without leave. */
  autoPresence: z.boolean().optional(),
});

export const updatePersonSchema = createPersonSchema.partial().extend({
  annualLeaveDays: z.number().int().nonnegative().optional(),
  /** Contractual working day in minutes. Null goes back to the default 9h. */
  dailyWorkMinutes: z
    .number()
    .int('dailyWorkMinutes must be a whole number of minutes')
    .min(60, 'dailyWorkMinutes must be at least 60')
    .max(MAX_DAILY_WORK_MINUTES, `dailyWorkMinutes cannot exceed ${MAX_DAILY_WORK_MINUTES}`)
    .nullable()
    .optional(),
}).refine(
  (data) => data.firstName === undefined || data.firstName.trim().length > 0,
  { message: 'First name cannot be empty', path: ['firstName'] },
).refine(
  (data) => data.lastName === undefined || data.lastName.trim().length > 0,
  { message: 'Last name cannot be empty', path: ['lastName'] },
);

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

export type PersonEmployeeRoleDto = {
  id: string;
  name: string;
};

/** API-facing Person shape — deletedAt is an internal implementation detail. */
export type PersonDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  employeeRoleId: string | null;
  employeeRole: PersonEmployeeRoleDto | null;
  annualLeaveDays: number;
  autoPresence: boolean;
  /** Contractual working day in minutes; null means the default 9h. */
  dailyWorkMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

export const PERSON_LIST_SORT_BY_VALUES = ['name'] as const;

export type PersonListSortBy = (typeof PERSON_LIST_SORT_BY_VALUES)[number];
