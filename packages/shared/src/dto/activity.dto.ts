import { z } from 'zod';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value in the form #RRGGBB');

export const createActivitySchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  isActive: z.boolean().optional(),
  color: hexColorSchema.optional(),
});

export const updateActivitySchema = createActivitySchema.partial().refine(
  (data) => data.name === undefined || data.name.trim().length > 0,
  { message: 'Name cannot be empty', path: ['name'] },
);

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

/** API-facing Activity shape — deletedAt is an internal implementation detail. */
export type ActivityDto = {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
