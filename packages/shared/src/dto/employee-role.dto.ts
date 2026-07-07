import { z } from 'zod';

export const createEmployeeRoleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  isActive: z.boolean().optional(),
});

export const updateEmployeeRoleSchema = createEmployeeRoleSchema.partial().refine(
  (data) => data.name === undefined || data.name.trim().length > 0,
  { message: 'Name cannot be empty', path: ['name'] },
);

export type CreateEmployeeRoleInput = z.infer<typeof createEmployeeRoleSchema>;
export type UpdateEmployeeRoleInput = z.infer<typeof updateEmployeeRoleSchema>;

/** API-facing EmployeeRole shape — deletedAt is an internal implementation detail. */
export type EmployeeRoleDto = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
